-- Row Level Security (RLS) Policies
-- Enforces strict tenant isolation at the database level

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE function_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTIONS FOR RLS
-- =====================================================

-- Get current tenant ID from session context
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get current user ID from session context
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.user_id', TRUE), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if current user is tenant admin
CREATE OR REPLACE FUNCTION is_tenant_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = get_current_user_id()
      AND tenant_id = get_current_tenant_id()
      AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if current user has specific permission
CREATE OR REPLACE FUNCTION has_permission(permission TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = get_current_user_id()
      AND tenant_id = get_current_tenant_id()
      AND (
        role IN ('owner', 'admin')
        OR permissions @> jsonb_build_array(permission)
      )
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- TENANTS POLICIES
-- =====================================================

-- Users can only see their own tenant
CREATE POLICY tenant_isolation ON tenants
  FOR SELECT
  USING (id = get_current_tenant_id());

-- Only tenant admins can update tenant settings
CREATE POLICY tenant_update ON tenants
  FOR UPDATE
  USING (id = get_current_tenant_id() AND is_tenant_admin());

-- Service role can bypass (for migrations, admin operations)
CREATE POLICY tenant_service_role ON tenants
  FOR ALL
  USING (current_setting('role') = 'service_role');

-- =====================================================
-- USERS POLICIES
-- =====================================================

-- Users can see other users in their tenant
CREATE POLICY users_select ON users
  FOR SELECT
  USING (tenant_id = get_current_tenant_id());

-- Users can update their own profile
CREATE POLICY users_update_self ON users
  FOR UPDATE
  USING (id = get_current_user_id());

-- Admins can manage users in their tenant
CREATE POLICY users_admin ON users
  FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

-- =====================================================
-- CALL SESSIONS POLICIES
-- =====================================================

-- Users can view call sessions in their tenant
CREATE POLICY sessions_select ON call_sessions
  FOR SELECT
  USING (tenant_id = get_current_tenant_id());

-- Users can create call sessions in their tenant
CREATE POLICY sessions_insert ON call_sessions
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant_id());

-- Users can update their own call sessions
CREATE POLICY sessions_update ON call_sessions
  FOR UPDATE
  USING (
    tenant_id = get_current_tenant_id()
    AND (user_id = get_current_user_id() OR is_tenant_admin())
  );

-- Admins can delete call sessions
CREATE POLICY sessions_delete ON call_sessions
  FOR DELETE
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

-- =====================================================
-- TRANSCRIPTS POLICIES
-- =====================================================

-- Users can view transcripts for sessions in their tenant
CREATE POLICY transcripts_select ON transcripts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM call_sessions
      WHERE call_sessions.id = transcripts.session_id
        AND call_sessions.tenant_id = get_current_tenant_id()
    )
  );

-- System can insert transcripts
CREATE POLICY transcripts_insert ON transcripts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM call_sessions
      WHERE call_sessions.id = transcripts.session_id
        AND call_sessions.tenant_id = get_current_tenant_id()
    )
  );

-- =====================================================
-- FUNCTION CALLS POLICIES
-- =====================================================

-- Users can view function calls for sessions in their tenant
CREATE POLICY function_calls_select ON function_calls
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM call_sessions
      WHERE call_sessions.id = function_calls.session_id
        AND call_sessions.tenant_id = get_current_tenant_id()
    )
  );

-- System can insert function calls
CREATE POLICY function_calls_insert ON function_calls
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM call_sessions
      WHERE call_sessions.id = function_calls.session_id
        AND call_sessions.tenant_id = get_current_tenant_id()
    )
  );

-- System can update function call results
CREATE POLICY function_calls_update ON function_calls
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM call_sessions
      WHERE call_sessions.id = function_calls.session_id
        AND call_sessions.tenant_id = get_current_tenant_id()
    )
  );

-- =====================================================
-- USAGE METRICS POLICIES
-- =====================================================

-- Users can view usage metrics for their tenant
CREATE POLICY usage_select ON usage_metrics
  FOR SELECT
  USING (tenant_id = get_current_tenant_id());

-- System can insert usage metrics
CREATE POLICY usage_insert ON usage_metrics
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant_id());

-- Admins can view detailed usage
CREATE POLICY usage_admin ON usage_metrics
  FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

-- =====================================================
-- AUDIT LOGS POLICIES
-- =====================================================

-- Admins can view audit logs for their tenant
CREATE POLICY audit_select ON audit_logs
  FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

-- System can insert audit logs
CREATE POLICY audit_insert ON audit_logs
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant_id());

-- =====================================================
-- API KEYS POLICIES
-- =====================================================

-- Users can view API keys in their tenant
CREATE POLICY api_keys_select ON api_keys
  FOR SELECT
  USING (tenant_id = get_current_tenant_id());

-- Users can create their own API keys
CREATE POLICY api_keys_insert ON api_keys
  FOR INSERT
  WITH CHECK (
    tenant_id = get_current_tenant_id()
    AND user_id = get_current_user_id()
  );

-- Users can revoke their own API keys
CREATE POLICY api_keys_update ON api_keys
  FOR UPDATE
  USING (
    tenant_id = get_current_tenant_id()
    AND (user_id = get_current_user_id() OR is_tenant_admin())
  );

-- Admins can delete API keys
CREATE POLICY api_keys_delete ON api_keys
  FOR DELETE
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

-- =====================================================
-- WEBHOOKS POLICIES
-- =====================================================

-- Users can view webhooks in their tenant
CREATE POLICY webhooks_select ON webhooks
  FOR SELECT
  USING (tenant_id = get_current_tenant_id());

-- Admins can manage webhooks
CREATE POLICY webhooks_admin ON webhooks
  FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

-- =====================================================
-- WEBHOOK EVENTS POLICIES
-- =====================================================

-- Users can view webhook events for their webhooks
CREATE POLICY webhook_events_select ON webhook_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM webhooks
      WHERE webhooks.id = webhook_events.webhook_id
        AND webhooks.tenant_id = get_current_tenant_id()
    )
  );

-- System can insert webhook events
CREATE POLICY webhook_events_insert ON webhook_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM webhooks
      WHERE webhooks.id = webhook_events.webhook_id
        AND webhooks.tenant_id = get_current_tenant_id()
    )
  );

-- =====================================================
-- SERVICE ROLE BYPASS (for backend operations)
-- =====================================================

-- Create bypass policies for service role on all tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('tenants') -- Already has service role policy
  LOOP
    EXECUTE format('
      CREATE POLICY %I ON %I
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)',
      t || '_service_role',
      t
    );
  END LOOP;
END $$;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant full access to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- =====================================================
-- SECURITY COMMENTS
-- =====================================================
COMMENT ON FUNCTION get_current_tenant_id() IS 'Returns the tenant ID from the current session context';
COMMENT ON FUNCTION get_current_user_id() IS 'Returns the user ID from the current session context';
COMMENT ON FUNCTION is_tenant_admin() IS 'Checks if the current user is an admin in their tenant';
COMMENT ON FUNCTION has_permission(TEXT) IS 'Checks if the current user has a specific permission';
