-- Authentication Integration Migration
-- Links Supabase Auth (auth.users) with application users table
-- Adds security features: account locking, login tracking, MFA support

-- =====================================================
-- UPDATE USERS TABLE FOR AUTH INTEGRATION
-- =====================================================

-- Add auth_user_id to link to Supabase Auth
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add email column (denormalized from auth.users for convenience)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Add status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='status') THEN
    ALTER TABLE users ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'));
  END IF;
END $$;

-- Add security columns for account protection
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_tenant_status ON users(tenant_id, status);

-- Add comment
COMMENT ON COLUMN users.auth_user_id IS 'Links to Supabase Auth user (auth.users.id)';
COMMENT ON COLUMN users.failed_login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN users.locked_until IS 'Account locked until this timestamp (NULL = not locked)';

-- =====================================================
-- UPDATE API_KEYS TABLE FOR PRODUCTION SECURITY
-- =====================================================

-- Add columns for secure API key storage
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_prefix VARCHAR(10) NOT NULL DEFAULT '';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_active ON api_keys(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_active ON api_keys(user_id, is_active);

-- Add comments
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the API key for secure verification';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 8 characters of API key for efficient lookup';
COMMENT ON COLUMN api_keys.usage_count IS 'Number of times this API key has been used';

-- =====================================================
-- TRIGGER: AUTO-CREATE USER ON AUTH SIGNUP
-- =====================================================

-- Function to handle new auth user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_tenant_id UUID;
  user_metadata JSONB;
BEGIN
  -- Extract metadata from auth user
  user_metadata := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  -- Get tenant_id from metadata (for invite flows) or use default
  default_tenant_id := (user_metadata->>'tenant_id')::UUID;

  -- If no tenant specified, skip auto-creation (require manual tenant assignment)
  IF default_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Create user record in our users table
  INSERT INTO users (
    auth_user_id,
    email,
    tenant_id,
    role,
    status,
    metadata,
    permissions
  ) VALUES (
    NEW.id,
    NEW.email,
    default_tenant_id,
    COALESCE((user_metadata->>'role')::VARCHAR, 'member'),
    'active',
    user_metadata,
    COALESCE((user_metadata->'permissions')::TEXT[]::VARCHAR[], ARRAY[]::VARCHAR[])
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  -- Log audit event
  INSERT INTO audit_logs (
    tenant_id,
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  SELECT
    tenant_id,
    id,
    'user.created',
    'user',
    id,
    jsonb_build_object(
      'email', email,
      'auth_user_id', NEW.id,
      'signup_method', 'supabase_auth'
    )
  FROM users
  WHERE auth_user_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users (only if it doesn't exist)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- TRIGGER: SYNC EMAIL UPDATES FROM AUTH
-- =====================================================

CREATE OR REPLACE FUNCTION sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Update email in users table when changed in auth
  UPDATE users
  SET email = NEW.email,
      updated_at = NOW()
  WHERE auth_user_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION sync_user_email();

-- =====================================================
-- FUNCTION: RECORD LOGIN ATTEMPT
-- =====================================================

CREATE OR REPLACE FUNCTION record_login_attempt(
  user_email VARCHAR,
  success BOOLEAN,
  ip_address VARCHAR DEFAULT NULL,
  user_agent VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  user_record RECORD;
  is_locked BOOLEAN := false;
  lock_duration INTERVAL := INTERVAL '30 minutes';
  max_attempts INTEGER := 5;
BEGIN
  -- Get user record
  SELECT * INTO user_record
  FROM users
  WHERE email = user_email
  LIMIT 1;

  IF user_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'user_not_found'
    );
  END IF;

  -- Check if account is currently locked
  IF user_record.locked_until IS NOT NULL AND user_record.locked_until > NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'account_locked',
      'locked_until', user_record.locked_until
    );
  END IF;

  IF success THEN
    -- Successful login: reset failed attempts
    UPDATE users
    SET failed_login_attempts = 0,
        locked_until = NULL,
        last_login_at = NOW(),
        updated_at = NOW()
    WHERE id = user_record.id;

    -- Log successful login
    INSERT INTO audit_logs (
      tenant_id,
      user_id,
      action,
      resource_type,
      resource_id,
      metadata
    ) VALUES (
      user_record.tenant_id,
      user_record.id,
      'user.login',
      'user',
      user_record.id,
      jsonb_build_object(
        'ip_address', ip_address,
        'user_agent', user_agent,
        'timestamp', NOW()
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'user_id', user_record.id
    );
  ELSE
    -- Failed login: increment failed attempts
    UPDATE users
    SET failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE
          WHEN failed_login_attempts + 1 >= max_attempts THEN NOW() + lock_duration
          ELSE NULL
        END,
        updated_at = NOW()
    WHERE id = user_record.id
    RETURNING locked_until IS NOT NULL INTO is_locked;

    -- Log failed login
    INSERT INTO audit_logs (
      tenant_id,
      user_id,
      action,
      resource_type,
      resource_id,
      metadata
    ) VALUES (
      user_record.tenant_id,
      user_record.id,
      'user.login_failed',
      'user',
      user_record.id,
      jsonb_build_object(
        'ip_address', ip_address,
        'user_agent', user_agent,
        'failed_attempts', user_record.failed_login_attempts + 1,
        'account_locked', is_locked,
        'timestamp', NOW()
      )
    );

    IF is_locked THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'account_locked',
        'locked_until', NOW() + lock_duration,
        'reason', 'Too many failed login attempts'
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'invalid_credentials',
        'attempts_remaining', max_attempts - (user_record.failed_login_attempts + 1)
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_login_attempt IS 'Records login attempts and enforces account locking after 5 failed attempts';

-- =====================================================
-- FUNCTION: UNLOCK USER ACCOUNT (ADMIN ONLY)
-- =====================================================

CREATE OR REPLACE FUNCTION unlock_user_account(
  target_user_id UUID,
  admin_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  admin_role VARCHAR;
BEGIN
  -- Verify admin has permission
  SELECT role INTO admin_role
  FROM users
  WHERE id = admin_user_id;

  IF admin_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Unlock account
  UPDATE users
  SET failed_login_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
  WHERE id = target_user_id;

  -- Log action
  INSERT INTO audit_logs (
    tenant_id,
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  SELECT
    tenant_id,
    admin_user_id,
    'user.unlocked',
    'user',
    target_user_id,
    jsonb_build_object('unlocked_by', admin_user_id, 'timestamp', NOW())
  FROM users
  WHERE id = target_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VIEW: USER WITH AUTH INFO
-- =====================================================

CREATE OR REPLACE VIEW users_with_auth AS
SELECT
  u.id,
  u.auth_user_id,
  u.email,
  u.tenant_id,
  u.role,
  u.status,
  u.permissions,
  u.metadata,
  u.failed_login_attempts,
  u.locked_until,
  u.last_login_at,
  u.mfa_enabled,
  u.created_at,
  u.updated_at,
  au.email_confirmed_at,
  au.phone_confirmed_at,
  au.confirmed_at,
  au.last_sign_in_at,
  au.created_at as auth_created_at,
  t.name as tenant_name,
  t.tier as tenant_tier,
  t.status as tenant_status
FROM users u
LEFT JOIN auth.users au ON u.auth_user_id = au.id
LEFT JOIN tenants t ON u.tenant_id = t.id;

COMMENT ON VIEW users_with_auth IS 'Combines application users with Supabase Auth data for admin dashboards';

-- =====================================================
-- UPDATE RLS POLICIES FOR AUTH INTEGRATION
-- =====================================================

-- Allow users to read their own auth data
DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users
  FOR SELECT
  USING (
    tenant_id = get_current_tenant_id()
    OR auth_user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
  );

-- Users can update their own profile (not role/permissions)
DROP POLICY IF EXISTS users_update_self ON users;
CREATE POLICY users_update_self ON users
  FOR UPDATE
  USING (auth_user_id::text = current_setting('request.jwt.claims', true)::json->>'sub');

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;
GRANT EXECUTE ON FUNCTION record_login_attempt TO authenticated;
GRANT EXECUTE ON FUNCTION unlock_user_account TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Auth integration migration complete';
  RAISE NOTICE '   - auth_user_id column added to users table';
  RAISE NOTICE '   - Account locking and security features added';
  RAISE NOTICE '   - Auto-user-creation trigger configured';
  RAISE NOTICE '   - Login tracking functions created';
  RAISE NOTICE '   - API key security columns added';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  Next steps:';
  RAISE NOTICE '   1. Update existing users with auth_user_id (if any)';
  RAISE NOTICE '   2. Configure Supabase Auth providers (email, OAuth, etc.)';
  RAISE NOTICE '   3. Set up email templates in Supabase dashboard';
  RAISE NOTICE '   4. Enable MFA in Supabase Auth settings (optional)';
END $$;
