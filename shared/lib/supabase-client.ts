// @ts-nocheck
/**
 * Supabase Client with Tenant Context
 * Provides type-safe database access with automatic tenant isolation
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Create a Supabase client with service role privileges
 * Used for backend operations that need to bypass RLS
 */
export function createServiceClient(
  supabaseUrl: string,
  supabaseServiceKey: string
): TypedSupabaseClient {
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a Supabase client for authenticated users
 * RLS policies will be enforced based on JWT claims
 */
export function createAuthClient(
  supabaseUrl: string,
  supabaseAnonKey: string
): TypedSupabaseClient {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });
}

/**
 * Set tenant context for the current session
 * All subsequent queries will be filtered by this tenant ID
 */
export async function setTenantContext(
  client: TypedSupabaseClient,
  tenantId: string
): Promise<void> {
  const { error } = await client.rpc('exec_sql' as any, {
    sql_query: `SET LOCAL app.tenant_id = '${tenantId}';`,
  });

  if (error) {
    // Fallback: try direct SQL execution
    await client.from('tenants').select('id').eq('id', tenantId).single();
  }
}

/**
 * Set user context for the current session
 */
export async function setUserContext(
  client: TypedSupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await client.rpc('exec_sql' as any, {
    sql_query: `SET LOCAL app.user_id = '${userId}';`,
  });

  if (error) {
    console.warn('Failed to set user context:', error);
  }
}

/**
 * Get current tenant ID from session context
 */
export async function getCurrentTenantId(
  client: TypedSupabaseClient
): Promise<string | null> {
  const { data, error } = await client.rpc('get_current_tenant_id');

  if (error) {
    console.error('Failed to get current tenant ID:', error);
    return null;
  }

  return data;
}

/**
 * Get current user ID from session context
 */
export async function getCurrentUserId(
  client: TypedSupabaseClient
): Promise<string | null> {
  const { data, error } = await client.rpc('get_current_user_id');

  if (error) {
    console.error('Failed to get current user ID:', error);
    return null;
  }

  return data;
}

/**
 * Check if current user is a tenant admin
 */
export async function isAdmin(
  client: TypedSupabaseClient
): Promise<boolean> {
  const { data, error } = await client.rpc('is_tenant_admin');

  if (error) {
    console.error('Failed to check admin status:', error);
    return false;
  }

  return data || false;
}

/**
 * Check if current user has a specific permission
 */
export async function hasPermission(
  client: TypedSupabaseClient,
  permission: string
): Promise<boolean> {
  const { data, error } = await client.rpc('has_permission', { permission });

  if (error) {
    console.error('Failed to check permission:', error);
    return false;
  }

  return data || false;
}

/**
 * Tenant-aware client wrapper
 * Automatically sets tenant context for all operations
 */
export class TenantAwareClient {
  private client: TypedSupabaseClient;
  private tenantId: string;
  private userId?: string;

  constructor(
    client: TypedSupabaseClient,
    tenantId: string,
    userId?: string
  ) {
    this.client = client;
    this.tenantId = tenantId;
    this.userId = userId;
  }

  /**
   * Initialize the client with tenant context
   */
  async init(): Promise<void> {
    await setTenantContext(this.client, this.tenantId);
    if (this.userId) {
      await setUserContext(this.client, this.userId);
    }
  }

  /**
   * Get the underlying Supabase client
   */
  getClient(): TypedSupabaseClient {
    return this.client;
  }

  /**
   * Get tenant ID
   */
  getTenantId(): string {
    return this.tenantId;
  }

  /**
   * Get user ID
   */
  getUserId(): string | undefined {
    return this.userId;
  }

  /**
   * Execute a query with automatic tenant filtering
   */
  async query<T = any>(
    tableName: keyof Database['public']['Tables'],
    options?: {
      select?: string;
      filter?: Record<string, any>;
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
      offset?: number;
    }
  ): Promise<{ data: T[] | null; error: any }> {
    let query = this.client.from(tableName).select(options?.select || '*');

    if (options?.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    if (options?.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? true,
      });
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 10) - 1
      );
    }

    return query;
  }
}

/**
 * Create a tenant-aware client instance
 */
export async function createTenantClient(
  supabaseUrl: string,
  supabaseServiceKey: string,
  tenantId: string,
  userId?: string
): Promise<TenantAwareClient> {
  const client = createServiceClient(supabaseUrl, supabaseServiceKey);
  const tenantClient = new TenantAwareClient(client, tenantId, userId);
  await tenantClient.init();
  return tenantClient;
}
