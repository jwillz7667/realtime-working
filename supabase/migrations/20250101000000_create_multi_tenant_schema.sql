-- Multi-Tenant Voice Assistant Database Schema
-- This migration creates the core enterprise multi-tenant architecture

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.tenant_id" TO '';

-- =====================================================
-- TENANTS TABLE
-- =====================================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  tier VARCHAR(50) NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),

  -- API Configuration
  openai_api_key_encrypted TEXT,
  twilio_account_sid VARCHAR(100),
  twilio_auth_token_encrypted TEXT,

  -- Settings & Configuration
  settings JSONB DEFAULT '{}',
  features JSONB DEFAULT '{}',

  -- Billing
  stripe_customer_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100),

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes
  CONSTRAINT tenants_name_check CHECK (char_length(name) >= 2),
  CONSTRAINT tenants_slug_check CHECK (slug ~* '^[a-z0-9-]+$')
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_tier ON tenants(tier);

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Auth (can integrate with Supabase Auth)
  auth_user_id UUID, -- Reference to auth.users if using Supabase Auth
  email VARCHAR(255) NOT NULL,

  -- Profile
  full_name VARCHAR(255),
  avatar_url TEXT,

  -- Role & Permissions
  role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  permissions JSONB DEFAULT '[]',

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited')),

  -- Metadata
  metadata JSONB DEFAULT '{}',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX idx_users_tenant_role ON users(tenant_id, role);

-- =====================================================
-- CALL SESSIONS TABLE
-- =====================================================
CREATE TABLE call_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Twilio Identifiers
  call_sid VARCHAR(100) NOT NULL,
  stream_sid VARCHAR(100),

  -- Call Details
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number VARCHAR(20),
  to_number VARCHAR(20),

  -- Status & Timing
  status VARCHAR(50) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'cancelled')),
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answer_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Session Configuration
  model VARCHAR(100),
  voice VARCHAR(50),
  config JSONB DEFAULT '{}',

  -- Quality Metrics
  quality_score DECIMAL(3,2), -- 0.00 to 5.00
  latency_avg_ms INTEGER,
  interruption_count INTEGER DEFAULT 0,

  -- Recording
  recording_sid VARCHAR(100),
  recording_url TEXT,
  recording_duration INTEGER,

  -- Error Handling
  error_code VARCHAR(50),
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(call_sid)
);

CREATE INDEX idx_sessions_tenant_id ON call_sessions(tenant_id);
CREATE INDEX idx_sessions_user_id ON call_sessions(user_id);
CREATE INDEX idx_sessions_call_sid ON call_sessions(call_sid);
CREATE INDEX idx_sessions_status ON call_sessions(status);
CREATE INDEX idx_sessions_tenant_status ON call_sessions(tenant_id, status);
CREATE INDEX idx_sessions_start_time ON call_sessions(start_time DESC);
CREATE INDEX idx_sessions_tenant_start_time ON call_sessions(tenant_id, start_time DESC);

-- =====================================================
-- TRANSCRIPTS TABLE
-- =====================================================
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,

  -- Transcript Details
  speaker VARCHAR(50) NOT NULL CHECK (speaker IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- Timing
  timestamp TIMESTAMPTZ NOT NULL,
  sequence_number INTEGER NOT NULL,

  -- Quality
  confidence DECIMAL(4,3), -- 0.000 to 1.000

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(session_id, sequence_number)
);

CREATE INDEX idx_transcripts_session_id ON transcripts(session_id);
CREATE INDEX idx_transcripts_timestamp ON transcripts(timestamp);
CREATE INDEX idx_transcripts_session_sequence ON transcripts(session_id, sequence_number);
CREATE INDEX idx_transcripts_content_fts ON transcripts USING gin(to_tsvector('english', content));

-- =====================================================
-- FUNCTION CALLS TABLE
-- =====================================================
CREATE TABLE function_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,

  -- Function Details
  function_name VARCHAR(255) NOT NULL,
  arguments JSONB NOT NULL,
  result JSONB,

  -- Status & Timing
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'success', 'failed')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  execution_time_ms INTEGER,

  -- Error Handling
  error_code VARCHAR(50),
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_function_calls_session_id ON function_calls(session_id);
CREATE INDEX idx_function_calls_function_name ON function_calls(function_name);
CREATE INDEX idx_function_calls_status ON function_calls(status);
CREATE INDEX idx_function_calls_timestamp ON function_calls(timestamp DESC);

-- =====================================================
-- USAGE METRICS TABLE
-- =====================================================
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID REFERENCES call_sessions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Metric Details
  metric_type VARCHAR(100) NOT NULL CHECK (metric_type IN (
    'audio_input_seconds',
    'audio_output_seconds',
    'input_tokens',
    'output_tokens',
    'cached_tokens',
    'api_call',
    'function_call',
    'transcription_seconds',
    'recording_seconds'
  )),
  quantity NUMERIC(15, 6) NOT NULL,

  -- Cost
  unit_cost NUMERIC(10, 6),
  total_cost_usd NUMERIC(10, 4),

  -- Timing
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_tenant_id ON usage_metrics(tenant_id);
CREATE INDEX idx_usage_session_id ON usage_metrics(session_id);
CREATE INDEX idx_usage_metric_type ON usage_metrics(metric_type);
CREATE INDEX idx_usage_timestamp ON usage_metrics(timestamp DESC);
CREATE INDEX idx_usage_tenant_timestamp ON usage_metrics(tenant_id, timestamp DESC);
CREATE INDEX idx_usage_tenant_type_timestamp ON usage_metrics(tenant_id, metric_type, timestamp DESC);

-- =====================================================
-- AUDIT LOGS TABLE
-- =====================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Action Details
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,

  -- Changes
  old_values JSONB,
  new_values JSONB,

  -- Request Context
  ip_address INET,
  user_agent TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_tenant_created_at ON audit_logs(tenant_id, created_at DESC);

-- =====================================================
-- API KEYS TABLE (for tenant API keys)
-- =====================================================
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Key Details
  name VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL, -- e.g., "va_live_" or "va_test_"
  key_hash TEXT NOT NULL, -- bcrypt hash of the actual key

  -- Permissions
  scopes JSONB DEFAULT '[]',

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),

  -- Usage
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,

  -- Expiration
  expires_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(key_hash)
);

CREATE INDEX idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_status ON api_keys(status);

-- =====================================================
-- WEBHOOKS TABLE
-- =====================================================
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Webhook Details
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL, -- Array of event types to subscribe to

  -- Security
  secret TEXT NOT NULL, -- For HMAC signature verification

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'failed')),

  -- Stats
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_failure_reason TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_tenant_id ON webhooks(tenant_id);
CREATE INDEX idx_webhooks_status ON webhooks(status);

-- =====================================================
-- WEBHOOK EVENTS TABLE
-- =====================================================
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,

  -- Event Details
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,

  -- Delivery
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,

  -- Response
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_webhook_events_webhook_id ON webhook_events(webhook_id);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_next_retry ON webhook_events(next_retry_at) WHERE status = 'retrying';

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_sessions_updated_at BEFORE UPDATE ON call_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Function to calculate call duration on end
CREATE OR REPLACE FUNCTION calculate_call_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.end_time IS NOT NULL AND NEW.answer_time IS NOT NULL THEN
    NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.end_time - NEW.answer_time))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_session_duration BEFORE UPDATE ON call_sessions
  FOR EACH ROW
  WHEN (NEW.end_time IS NOT NULL AND OLD.end_time IS NULL)
  EXECUTE FUNCTION calculate_call_duration();

-- Function to calculate function call execution time
CREATE OR REPLACE FUNCTION calculate_execution_time()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.execution_time_ms = EXTRACT(MILLISECONDS FROM (NEW.completed_at - NEW.started_at))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_function_execution_time BEFORE UPDATE ON function_calls
  FOR EACH ROW
  WHEN (NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL)
  EXECUTE FUNCTION calculate_execution_time();

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE tenants IS 'Multi-tenant organizations using the voice assistant platform';
COMMENT ON TABLE users IS 'Users belonging to tenant organizations';
COMMENT ON TABLE call_sessions IS 'Voice call sessions with Twilio and OpenAI Realtime API';
COMMENT ON TABLE transcripts IS 'Real-time transcripts of voice conversations';
COMMENT ON TABLE function_calls IS 'Function/tool calls made during conversations';
COMMENT ON TABLE usage_metrics IS 'Usage tracking for billing and analytics';
COMMENT ON TABLE audit_logs IS 'Audit trail of all significant actions';
COMMENT ON TABLE api_keys IS 'API keys for programmatic access';
COMMENT ON TABLE webhooks IS 'Webhook endpoints for event notifications';
COMMENT ON TABLE webhook_events IS 'Individual webhook delivery attempts';
