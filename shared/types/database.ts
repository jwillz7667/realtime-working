// Database Types for Multi-Tenant Voice Assistant Platform
// Auto-generated from Supabase schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// =====================================================
// ENUMS
// =====================================================
export type TenantTier = 'free' | 'pro' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'cancelled';
export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';
export type UserStatus = 'active' | 'inactive' | 'invited';
export type CallDirection = 'inbound' | 'outbound';
export type CallStatus =
  | 'initiated'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'no_answer'
  | 'busy'
  | 'cancelled';
export type Speaker = 'user' | 'assistant' | 'system';
export type FunctionCallStatus = 'pending' | 'in_progress' | 'success' | 'failed';
export type MetricType =
  | 'audio_input_seconds'
  | 'audio_output_seconds'
  | 'input_tokens'
  | 'output_tokens'
  | 'cached_tokens'
  | 'api_call'
  | 'function_call'
  | 'transcription_seconds'
  | 'recording_seconds';
export type ApiKeyStatus = 'active' | 'revoked' | 'expired';
export type WebhookStatus = 'active' | 'disabled' | 'failed';
export type WebhookEventStatus = 'pending' | 'success' | 'failed' | 'retrying';

// =====================================================
// TABLE TYPES
// =====================================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  tier: TenantTier;
  openai_api_key_encrypted: string | null;
  twilio_account_sid: string | null;
  twilio_auth_token_encrypted: string | null;
  settings: Json;
  features: Json;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: TenantStatus;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  permissions: Json;
  status: UserStatus;
  metadata: Json;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallSession {
  id: string;
  tenant_id: string;
  user_id: string | null;
  call_sid: string;
  stream_sid: string | null;
  direction: CallDirection;
  from_number: string | null;
  to_number: string | null;
  status: CallStatus;
  start_time: string;
  answer_time: string | null;
  end_time: string | null;
  duration_seconds: number | null;
  model: string | null;
  voice: string | null;
  config: Json;
  quality_score: number | null;
  latency_avg_ms: number | null;
  interruption_count: number;
  recording_sid: string | null;
  recording_url: string | null;
  recording_duration: number | null;
  error_code: string | null;
  error_message: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface Transcript {
  id: string;
  session_id: string;
  speaker: Speaker;
  content: string;
  timestamp: string;
  sequence_number: number;
  confidence: number | null;
  metadata: Json;
  created_at: string;
}

export interface FunctionCall {
  id: string;
  session_id: string;
  function_name: string;
  arguments: Json;
  result: Json | null;
  status: FunctionCallStatus;
  timestamp: string;
  started_at: string | null;
  completed_at: string | null;
  execution_time_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  metadata: Json;
  created_at: string;
}

export interface UsageMetric {
  id: string;
  tenant_id: string;
  session_id: string | null;
  user_id: string | null;
  metric_type: MetricType;
  quantity: number;
  unit_cost: number | null;
  total_cost_usd: number | null;
  timestamp: string;
  metadata: Json;
  created_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  old_values: Json | null;
  new_values: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Json;
  created_at: string;
}

export interface ApiKey {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  status: ApiKeyStatus;
  is_active: boolean;
  last_used_at: string | null;
  usage_count: number | null;
  expires_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface Webhook {
  id: string;
  tenant_id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  status: WebhookStatus;
  success_count: number;
  failure_count: number;
  last_triggered_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_failure_reason: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Json;
  status: WebhookEventStatus;
  attempts: number;
  max_attempts: number;
  next_retry_at: string | null;
  response_status: number | null;
  response_body: string | null;
  response_time_ms: number | null;
  created_at: string;
  delivered_at: string | null;
}

// =====================================================
// INSERT TYPES (for creating new records)
// =====================================================

export type TenantInsert = Omit<Tenant, 'id' | 'created_at' | 'updated_at'>;
export type UserInsert = Omit<User, 'id' | 'created_at' | 'updated_at'>;
export type CallSessionInsert = Omit<CallSession, 'id' | 'created_at' | 'updated_at'>;
export type TranscriptInsert = Omit<Transcript, 'id' | 'created_at'>;
export type FunctionCallInsert = Omit<FunctionCall, 'id' | 'created_at'>;
export type UsageMetricInsert = Omit<UsageMetric, 'id' | 'created_at'>;
export type AuditLogInsert = Omit<AuditLog, 'id' | 'created_at'>;
export type ApiKeyInsert = Omit<ApiKey, 'id' | 'created_at' | 'updated_at'>;
export type WebhookInsert = Omit<Webhook, 'id' | 'created_at' | 'updated_at'>;
export type WebhookEventInsert = Omit<WebhookEvent, 'id' | 'created_at'>;

// =====================================================
// UPDATE TYPES (for updating existing records)
// =====================================================

export type TenantUpdate = Partial<Omit<Tenant, 'id' | 'created_at' | 'updated_at'>>;
export type UserUpdate = Partial<Omit<User, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>;
export type CallSessionUpdate = Partial<Omit<CallSession, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>;
export type FunctionCallUpdate = Partial<Omit<FunctionCall, 'id' | 'session_id' | 'created_at'>>;
export type ApiKeyUpdate = Partial<Omit<ApiKey, 'id' | 'tenant_id' | 'user_id' | 'created_at' | 'updated_at'>>;
export type WebhookUpdate = Partial<Omit<Webhook, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>;

// =====================================================
// DATABASE TYPE (for Supabase client)
// =====================================================

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: Tenant;
        Insert: TenantInsert;
        Update: TenantUpdate;
        Relationships: [];
      };
      users: {
        Row: User;
        Insert: UserInsert;
        Update: UserUpdate;
        Relationships: [];
      };
      call_sessions: {
        Row: CallSession;
        Insert: CallSessionInsert;
        Update: CallSessionUpdate;
        Relationships: [];
      };
      transcripts: {
        Row: Transcript;
        Insert: TranscriptInsert;
        Update: never;
        Relationships: [];
      };
      function_calls: {
        Row: FunctionCall;
        Insert: FunctionCallInsert;
        Update: FunctionCallUpdate;
        Relationships: [];
      };
      usage_metrics: {
        Row: UsageMetric;
        Insert: UsageMetricInsert;
        Update: never;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: AuditLogInsert;
        Update: never;
        Relationships: [];
      };
      api_keys: {
        Row: ApiKey;
        Insert: ApiKeyInsert;
        Update: ApiKeyUpdate;
        Relationships: [];
      };
      webhooks: {
        Row: Webhook;
        Insert: WebhookInsert;
        Update: WebhookUpdate;
        Relationships: [];
      };
      webhook_events: {
        Row: WebhookEvent;
        Insert: WebhookEventInsert;
        Update: never;
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      get_current_tenant_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_current_user_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      is_tenant_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      has_permission: {
        Args: { permission: string };
        Returns: boolean;
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
}
