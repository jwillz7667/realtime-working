// @ts-nocheck
/**
 * Database Helper Functions
 * Provides high-level abstractions for common database operations
 */

import type { TypedSupabaseClient } from './supabase-client';
import type {
  Tenant,
  User,
  CallSession,
  Transcript,
  FunctionCall,
  UsageMetric,
  AuditLog,
  TenantInsert,
  UserInsert,
  CallSessionInsert,
  TranscriptInsert,
  FunctionCallInsert,
  UsageMetricInsert,
  AuditLogInsert,
  CallSessionUpdate,
  FunctionCallUpdate,
} from '../types/database';

// =====================================================
// TENANT OPERATIONS
// =====================================================

export class TenantService {
  constructor(private client: TypedSupabaseClient) {}

  async create(tenant: TenantInsert): Promise<Tenant | null> {
    const { data, error } = await this.client
      .from('tenants')
      .insert(tenant)
      .select()
      .single();

    if (error) {
      console.error('Failed to create tenant:', error);
      return null;
    }

    return data;
  }

  async getById(id: string): Promise<Tenant | null> {
    const { data, error } = await this.client
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to get tenant:', error);
      return null;
    }

    return data;
  }

  async getBySlug(slug: string): Promise<Tenant | null> {
    const { data, error } = await this.client
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      console.error('Failed to get tenant by slug:', error);
      return null;
    }

    return data;
  }

  async update(id: string, updates: Partial<TenantInsert>): Promise<Tenant | null> {
    const { data, error } = await this.client
      .from('tenants')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update tenant:', error);
      return null;
    }

    return data;
  }

  async listActive(): Promise<Tenant[]> {
    const { data, error } = await this.client
      .from('tenants')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to list tenants:', error);
      return [];
    }

    return data || [];
  }
}

// =====================================================
// USER OPERATIONS
// =====================================================

export class UserService {
  constructor(private client: TypedSupabaseClient) {}

  async create(user: UserInsert): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .insert(user)
      .select()
      .single();

    if (error) {
      console.error('Failed to create user:', error);
      return null;
    }

    return data;
  }

  async getById(id: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to get user:', error);
      return null;
    }

    return data;
  }

  async getByEmail(tenantId: string, email: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .single();

    if (error) {
      console.error('Failed to get user by email:', error);
      return null;
    }

    return data;
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to list users:', error);
      return [];
    }

    return data || [];
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.client
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userId);
  }
}

// =====================================================
// CALL SESSION OPERATIONS
// =====================================================

export class CallSessionService {
  constructor(private client: TypedSupabaseClient) {}

  async create(session: CallSessionInsert): Promise<CallSession | null> {
    const { data, error } = await this.client
      .from('call_sessions')
      .insert(session)
      .select()
      .single();

    if (error) {
      console.error('Failed to create call session:', error);
      return null;
    }

    return data;
  }

  async getById(id: string): Promise<CallSession | null> {
    const { data, error } = await this.client
      .from('call_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to get call session:', error);
      return null;
    }

    return data;
  }

  async getByCallSid(callSid: string): Promise<CallSession | null> {
    const { data, error } = await this.client
      .from('call_sessions')
      .select('*')
      .eq('call_sid', callSid)
      .single();

    if (error) {
      console.error('Failed to get call session by call_sid:', error);
      return null;
    }

    return data;
  }

  async update(id: string, updates: CallSessionUpdate): Promise<CallSession | null> {
    const { data, error } = await this.client
      .from('call_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update call session:', error);
      return null;
    }

    return data;
  }

  async endSession(id: string): Promise<CallSession | null> {
    return this.update(id, {
      status: 'completed',
      end_time: new Date().toISOString(),
    });
  }

  async listByTenant(
    tenantId: string,
    options?: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<CallSession[]> {
    let query = this.client
      .from('call_sessions')
      .select('*')
      .eq('tenant_id', tenantId);

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    query = query.order('start_time', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 10) - 1
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to list call sessions:', error);
      return [];
    }

    return data || [];
  }

  async getActiveSessions(tenantId: string): Promise<CallSession[]> {
    const { data, error } = await this.client
      .from('call_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'in_progress')
      .order('start_time', { ascending: false });

    if (error) {
      console.error('Failed to get active sessions:', error);
      return [];
    }

    return data || [];
  }
}

// =====================================================
// TRANSCRIPT OPERATIONS
// =====================================================

export class TranscriptService {
  constructor(private client: TypedSupabaseClient) {}

  async create(transcript: TranscriptInsert): Promise<Transcript | null> {
    const { data, error } = await this.client
      .from('transcripts')
      .insert(transcript)
      .select()
      .single();

    if (error) {
      console.error('Failed to create transcript:', error);
      return null;
    }

    return data;
  }

  async createBatch(transcripts: TranscriptInsert[]): Promise<Transcript[]> {
    const { data, error } = await this.client
      .from('transcripts')
      .insert(transcripts)
      .select();

    if (error) {
      console.error('Failed to create transcripts:', error);
      return [];
    }

    return data || [];
  }

  async listBySession(sessionId: string): Promise<Transcript[]> {
    const { data, error } = await this.client
      .from('transcripts')
      .select('*')
      .eq('session_id', sessionId)
      .order('sequence_number', { ascending: true });

    if (error) {
      console.error('Failed to list transcripts:', error);
      return [];
    }

    return data || [];
  }

  async search(
    tenantId: string,
    query: string,
    limit: number = 50
  ): Promise<Transcript[]> {
    // Full-text search across transcripts
    const { data, error } = await this.client
      .from('transcripts')
      .select(
        `
        *,
        call_session:call_sessions!inner(tenant_id)
      `
      )
      .eq('call_session.tenant_id', tenantId)
      .textSearch('content', query)
      .limit(limit);

    if (error) {
      console.error('Failed to search transcripts:', error);
      return [];
    }

    return data || [];
  }
}

// =====================================================
// FUNCTION CALL OPERATIONS
// =====================================================

export class FunctionCallService {
  constructor(private client: TypedSupabaseClient) {}

  async create(functionCall: FunctionCallInsert): Promise<FunctionCall | null> {
    const { data, error } = await this.client
      .from('function_calls')
      .insert(functionCall)
      .select()
      .single();

    if (error) {
      console.error('Failed to create function call:', error);
      return null;
    }

    return data;
  }

  async update(id: string, updates: FunctionCallUpdate): Promise<FunctionCall | null> {
    const { data, error } = await this.client
      .from('function_calls')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update function call:', error);
      return null;
    }

    return data;
  }

  async markStarted(id: string): Promise<FunctionCall | null> {
    return this.update(id, {
      status: 'in_progress',
      started_at: new Date().toISOString(),
    });
  }

  async markCompleted(
    id: string,
    result: any
  ): Promise<FunctionCall | null> {
    return this.update(id, {
      status: 'success',
      result,
      completed_at: new Date().toISOString(),
    });
  }

  async markFailed(
    id: string,
    errorCode: string,
    errorMessage: string
  ): Promise<FunctionCall | null> {
    return this.update(id, {
      status: 'failed',
      error_code: errorCode,
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    });
  }

  async listBySession(sessionId: string): Promise<FunctionCall[]> {
    const { data, error } = await this.client
      .from('function_calls')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Failed to list function calls:', error);
      return [];
    }

    return data || [];
  }
}

// =====================================================
// USAGE METRICS OPERATIONS
// =====================================================

export class UsageMetricService {
  constructor(private client: TypedSupabaseClient) {}

  async track(metric: UsageMetricInsert): Promise<UsageMetric | null> {
    const { data, error } = await this.client
      .from('usage_metrics')
      .insert(metric)
      .select()
      .single();

    if (error) {
      console.error('Failed to track usage metric:', error);
      return null;
    }

    return data;
  }

  async trackBatch(metrics: UsageMetricInsert[]): Promise<UsageMetric[]> {
    const { data, error } = await this.client
      .from('usage_metrics')
      .insert(metrics)
      .select();

    if (error) {
      console.error('Failed to track usage metrics:', error);
      return [];
    }

    return data || [];
  }

  async getMonthlyUsage(
    tenantId: string,
    year: number,
    month: number
  ): Promise<{ type: string; total: number; cost: number }[]> {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 1).toISOString();

    const { data, error } = await this.client
      .from('usage_metrics')
      .select('metric_type, quantity, total_cost_usd')
      .eq('tenant_id', tenantId)
      .gte('timestamp', startDate)
      .lt('timestamp', endDate);

    if (error) {
      console.error('Failed to get monthly usage:', error);
      return [];
    }

    const metrics = (data || []) as {
      metric_type: string;
      quantity: number | string;
      total_cost_usd: number | string | null;
    }[];

    // Aggregate by metric type
    const aggregated = metrics.reduce(
      (
        acc: { type: string; total: number; cost: number }[],
        curr: { metric_type: string; quantity: number | string; total_cost_usd: number | string | null }
      ) => {
      const existing = acc.find((item) => item.type === curr.metric_type);
      if (existing) {
        existing.total += Number(curr.quantity);
        existing.cost += Number(curr.total_cost_usd || 0);
      } else {
        acc.push({
          type: curr.metric_type,
          total: Number(curr.quantity),
          cost: Number(curr.total_cost_usd || 0),
        });
      }
      return acc;
    },
      [] as { type: string; total: number; cost: number }[]
    );

    return aggregated;
  }

  async getTotalCost(tenantId: string, startDate: string, endDate: string): Promise<number> {
    const { data, error } = await this.client
      .from('usage_metrics')
      .select('total_cost_usd')
      .eq('tenant_id', tenantId)
      .gte('timestamp', startDate)
      .lt('timestamp', endDate);

    if (error) {
      console.error('Failed to get total cost:', error);
      return 0;
    }

    const records = (data || []) as { total_cost_usd: number | string | null }[];

    return records.reduce(
      (sum: number, item: { total_cost_usd: number | string | null }) =>
        sum + Number(item.total_cost_usd || 0),
      0
    );
  }
}

// =====================================================
// AUDIT LOG OPERATIONS
// =====================================================

export class AuditLogService {
  constructor(private client: TypedSupabaseClient) {}

  async log(auditLog: AuditLogInsert): Promise<AuditLog | null> {
    const { data, error } = await this.client
      .from('audit_logs')
      .insert(auditLog)
      .select()
      .single();

    if (error) {
      console.error('Failed to create audit log:', error);
      return null;
    }

    return data;
  }

  async listByTenant(
    tenantId: string,
    options?: {
      action?: string;
      resourceType?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<AuditLog[]> {
    let query = this.client
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', tenantId);

    if (options?.action) {
      query = query.eq('action', options.action);
    }

    if (options?.resourceType) {
      query = query.eq('resource_type', options.resourceType);
    }

    query = query.order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 10) - 1
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to list audit logs:', error);
      return [];
    }

    return data || [];
  }

  async listByUser(userId: string, limit: number = 100): Promise<AuditLog[]> {
    const { data, error } = await this.client
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to list user audit logs:', error);
      return [];
    }

    return data || [];
  }
}

// =====================================================
// COMBINED SERVICE FACTORY
// =====================================================

export class DatabaseServices {
  public tenants: TenantService;
  public users: UserService;
  public callSessions: CallSessionService;
  public transcripts: TranscriptService;
  public functionCalls: FunctionCallService;
  public usageMetrics: UsageMetricService;
  public auditLogs: AuditLogService;

  constructor(client: TypedSupabaseClient) {
    this.tenants = new TenantService(client);
    this.users = new UserService(client);
    this.callSessions = new CallSessionService(client);
    this.transcripts = new TranscriptService(client);
    this.functionCalls = new FunctionCallService(client);
    this.usageMetrics = new UsageMetricService(client);
    this.auditLogs = new AuditLogService(client);
  }
}

/**
 * Create a database services instance
 */
export function createDatabaseServices(
  client: TypedSupabaseClient
): DatabaseServices {
  return new DatabaseServices(client);
}
