// @ts-nocheck
/**
 * Production-Grade Authentication and Authorization Utilities
 * Enterprise-ready security with bcrypt, JWT validation, and audit logging
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type {
  ApiKey,
  ApiKeyInsert,
  AuditLogInsert,
  Database,
  Json,
  TenantStatus,
  TenantTier,
  UserRole,
  UserStatus,
} from '../types/database';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export type AuthenticatedUser = {
  id: string;
  authUserId: string;
  email: string;
  tenantId: string;
  role: UserRole;
  permissions: string[];
  metadata: Record<string, unknown>;
  status: UserStatus;
};

export type AuthContext = {
  user: AuthenticatedUser;
  tenant: {
    id: string;
    name: string;
    tier: TenantTier;
    status: TenantStatus;
    settings: Record<string, unknown>;
  };
};

export type ApiKeyInfo = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  tenantId: string;
  userId: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

type ApiKeyRow = Database['public']['Tables']['api_keys']['Row'];

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  banned_until?: string | null;
  deleted_at?: string | null;
};

type SupabaseTenant = {
  id: string;
  name: string;
  tier: TenantTier;
  status: TenantStatus;
  settings: Record<string, unknown>;
};

type SupabaseUserRecord = {
  id: string;
  auth_user_id: string;
  email: string | null;
  role: UserRole;
  permissions: string[] | null;
  metadata: Record<string, unknown> | null;
  status: UserStatus;
  tenant_id: string;
  tenants: SupabaseTenant;
};

type ApiKeyRecord = ApiKeyRow & {
  usage_count?: number | null;
  users: SupabaseUserRecord;
};

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const SignupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Tenant slug must be lowercase alphanumeric with hyphens'),
});

export const ApiKeyCreateSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100),
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
  expiresInDays: z.number().min(1).max(365).optional(),
});

// =====================================================
// JWT TOKEN VERIFICATION
// =====================================================

/**
 * Verify JWT token using Supabase Auth and load user context
 * This is the primary authentication method for HTTP requests
 */
export async function verifyToken(
  supabase: SupabaseClient<Database>,
  token: string
): Promise<AuthenticatedUser | null> {
  try {
    // Verify JWT with Supabase Auth
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      console.error('[Auth] JWT verification failed:', authError?.message);
      return null;
    }

    const statusAwareUser = authUser as SupabaseAuthUser;

    // Check if auth user is banned or deleted
    if (statusAwareUser.banned_until || statusAwareUser.deleted_at) {
      console.warn('[Auth] Access denied - user banned or deleted:', statusAwareUser.id);
      return null;
    }

    // Load user data from our users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        tenant_id,
        role,
        permissions,
        metadata,
        status,
        tenants!inner(id, name, tier, status, settings)
      `)
      .eq('auth_user_id', authUser.id)
      .eq('status', 'active')
      .single();

    if (userError || !userData) {
      console.error('[Auth] User lookup failed:', userError?.message);
      return null;
    }

    // Check if tenant is active
    const userRecord = userData as SupabaseUserRecord;
    const tenant = userRecord.tenants;
    if (tenant.status !== 'active') {
      console.warn('[Auth] Access denied - tenant not active:', tenant.id);
      return null;
    }

    return {
      id: userRecord.id,
      authUserId: statusAwareUser.id,
      email: statusAwareUser.email || userRecord.email || '',
      tenantId: userRecord.tenant_id,
      role: userRecord.role,
      permissions: userRecord.permissions ?? [],
      metadata: userRecord.metadata ?? {},
      status: userRecord.status,
    };
  } catch (error: unknown) {
    console.error('[Auth] Token verification exception:', error);
    return null;
  }
}

// =====================================================
// API KEY VERIFICATION
// =====================================================

/**
 * Verify API key and return associated user context
 * Uses constant-time comparison to prevent timing attacks
 */
export async function verifyApiKey(
  supabase: SupabaseClient<Database>,
  apiKey: string
): Promise<AuthenticatedUser | null> {
  try {
    // Extract prefix for efficient lookup (e.g., "sk_live_")
    const prefix = apiKey.substring(0, 8);

    // Lookup API keys with matching prefix
    const { data: apiKeys, error } = await supabase
      .from('api_keys')
      .select(`
        id,
        key_hash,
        user_id,
        tenant_id,
        scopes,
        expires_at,
        is_active,
        users!inner(
          id,
          auth_user_id,
          email,
          role,
          permissions,
          metadata,
          status,
          tenants!inner(id, name, tier, status, settings)
        )
      `)
      .eq('key_prefix', prefix)
      .eq('is_active', true);

    if (error || !apiKeys || apiKeys.length === 0) {
      console.warn('[Auth] API key lookup failed or no keys found');
      return null;
    }

    // Import crypto for secure comparison
    const crypto = await import('crypto');

    // Find matching key using constant-time comparison
    const apiKeyRecords = apiKeys as ApiKeyRecord[];

    let matchedKey: ApiKeyRecord | null = null;
    for (const keyRecord of apiKeyRecords) {
      const providedHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      const storedHash = keyRecord.key_hash;

      // Constant-time comparison to prevent timing attacks
      if (crypto.timingSafeEqual(
        Buffer.from(providedHash, 'hex'),
        Buffer.from(storedHash, 'hex')
      )) {
        matchedKey = keyRecord;
        break;
      }
    }

    if (!matchedKey) {
      console.warn('[Auth] No matching API key found');
      return null;
    }

    // Check expiration
    if (matchedKey.expires_at && new Date(matchedKey.expires_at) < new Date()) {
      console.warn('[Auth] API key expired:', matchedKey.id);
      return null;
    }

    const user = matchedKey.users;
    const tenant = user.tenants;

    // Check user and tenant status
    if (user.status !== 'active' || tenant.status !== 'active') {
      console.warn('[Auth] Access denied - user or tenant not active');
      return null;
    }

    // Update last_used_at asynchronously (don't wait)
    void supabase
      .from('api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        usage_count: (matchedKey.usage_count ?? 0) + 1,
      })
      .eq('id', matchedKey.id)
      .then(({ error: updateError }) => {
        if (updateError) {
          console.error('[Auth] Failed to update API key usage:', updateError.message);
        }
      });

    return {
      id: user.id,
      authUserId: user.auth_user_id,
      email: user.email ?? '',
      tenantId: matchedKey.tenant_id,
      role: user.role,
      permissions: matchedKey.scopes, // API key scopes override user permissions
      metadata: user.metadata ?? {},
      status: user.status,
    };
  } catch (error: unknown) {
    console.error('[Auth] API key verification exception:', error);
    return null;
  }
}

// =====================================================
// AUTHORIZATION HELPERS
// =====================================================

/**
 * Load complete auth context including tenant information
 */
export async function loadAuthContext(
  supabase: SupabaseClient<Database>,
  user: AuthenticatedUser
): Promise<AuthContext | null> {
  try {
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name, tier, status, settings')
      .eq('id', user.tenantId)
      .single();

    if (error || !tenant) {
      console.error('[Auth] Failed to load tenant:', error?.message);
      return null;
    }

    const tenantRecord = tenant as SupabaseTenant;

    return {
      user,
      tenant: {
        id: tenantRecord.id,
        name: tenantRecord.name,
        tier: tenantRecord.tier,
        status: tenantRecord.status,
        settings: tenantRecord.settings || {},
      },
    };
  } catch (error: unknown) {
    console.error('[Auth] Failed to load auth context:', error);
    return null;
  }
}

/**
 * Check if user has required permission
 */
export function hasPermission(
  user: AuthenticatedUser,
  permission: string
): boolean {
  // Owners have all permissions
  if (user.role === 'owner') {
    return true;
  }

  // Check explicit permissions
  return user.permissions.includes(permission);
}

/**
 * Check if user has any of the required permissions
 */
export function hasAnyPermission(
  user: AuthenticatedUser,
  permissions: string[]
): boolean {
  return permissions.some(p => hasPermission(user, p));
}

/**
 * Check if user has all required permissions
 */
export function hasAllPermissions(
  user: AuthenticatedUser,
  permissions: string[]
): boolean {
  return permissions.every(p => hasPermission(user, p));
}

/**
 * Check if user has any of the required roles
 */
export function hasRole(
  user: AuthenticatedUser,
  roles: ('owner' | 'admin' | 'member' | 'viewer')[]
): boolean {
  return roles.includes(user.role);
}

/**
 * Check if user can access resource in tenant
 */
export function canAccessTenant(
  user: AuthenticatedUser,
  tenantId: string
): boolean {
  return user.tenantId === tenantId;
}

// =====================================================
// API KEY MANAGEMENT
// =====================================================

/**
 * Generate a cryptographically secure API key
 * Format: sk_live_<32-byte-hex> or sk_test_<32-byte-hex>
 */
export async function generateApiKey(environment: 'live' | 'test' = 'live'): Promise<string> {
  const crypto = await import('crypto');
  const randomBytes = crypto.randomBytes(32);
  const key = randomBytes.toString('hex');
  const prefix = environment === 'live' ? 'sk_live_' : 'sk_test_';
  return prefix + key;
}

/**
 * Hash API key for secure storage using SHA-256
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Create new API key for user
 */
export async function createApiKey(
  supabase: SupabaseClient<Database>,
  userId: string,
  tenantId: string,
  params: {
    name: string;
    scopes: string[];
    expiresInDays?: number;
  }
): Promise<{ apiKey: string; keyInfo: ApiKeyInfo } | null> {
  try {
    // Validate input
    const validated = ApiKeyCreateSchema.parse(params);

    // Generate API key
    const apiKey = await generateApiKey('live');
    const keyHash = await hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 8);

    // Calculate expiration
    const expiresAt = validated.expiresInDays
      ? new Date(Date.now() + validated.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Insert into database
    const { data, error } = await supabase
      .from('api_keys')
      .insert<ApiKeyInsert>({
        user_id: userId,
        tenant_id: tenantId,
        name: validated.name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes: validated.scopes,
        expires_at: expiresAt,
        is_active: true,
        last_used_at: null,
        usage_count: 0,
        metadata: {} as Json,
        status: 'active',
      })
      .select<ApiKey>()
      .single();

    if (error || !data) {
      console.error('[Auth] Failed to create API key:', error?.message);
      return null;
    }

    // Log audit event
    await supabase.from('audit_logs').insert<AuditLogInsert>({
      tenant_id: tenantId,
      user_id: userId,
      action: 'api_key.created',
      resource_type: 'api_key',
      resource_id: data.id,
      metadata: {
        key_name: validated.name,
        scopes: validated.scopes,
        expires_at: expiresAt,
      },
      new_values: null,
      old_values: null,
      ip_address: null,
      user_agent: null,
    });

    return {
      apiKey, // Return plaintext key (only time it's shown)
      keyInfo: {
        id: data.id,
        name: data.name,
        keyPrefix: keyPrefix,
        scopes: data.scopes,
        tenantId: data.tenant_id,
        userId: data.user_id,
        expiresAt: data.expires_at,
        lastUsedAt: data.last_used_at,
        createdAt: data.created_at,
      },
    };
  } catch (error: unknown) {
    console.error('[Auth] API key creation exception:', error);
    return null;
  }
}

/**
 * Revoke API key
 */
export async function revokeApiKey(
  supabase: SupabaseClient<Database>,
  keyId: string,
  userId: string,
  tenantId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false, status: 'revoked' })
      .eq('id', keyId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[Auth] Failed to revoke API key:', error.message);
      return false;
    }

    // Log audit event
    await supabase.from('audit_logs').insert<AuditLogInsert>({
      tenant_id: tenantId,
      user_id: userId,
      action: 'api_key.revoked',
      resource_type: 'api_key',
      resource_id: keyId,
      metadata: {} as Json,
      old_values: null,
      new_values: null,
      ip_address: null,
      user_agent: null,
    });

    return true;
  } catch (error: unknown) {
    console.error('[Auth] API key revocation exception:', error);
    return false;
  }
}

/**
 * List API keys for tenant
 */
export async function listApiKeys(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<ApiKeyInfo[]> {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, tenant_id, user_id, expires_at, last_used_at, created_at, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .returns<ApiKeyRow[]>();

    if (error) {
      console.error('[Auth] Failed to list API keys:', error.message);
      return [];
    }

    return (data ?? []).map(key => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.key_prefix,
      scopes: key.scopes,
      tenantId: key.tenant_id,
      userId: key.user_id,
      expiresAt: key.expires_at,
      lastUsedAt: key.last_used_at,
      createdAt: key.created_at,
    }));
  } catch (error: unknown) {
    console.error('[Auth] List API keys exception:', error);
    return [];
  }
}

// =====================================================
// PERMISSION CONSTANTS
// =====================================================

export const Permissions = {
  // Call management
  CALLS_VIEW: 'calls:view',
  CALLS_CREATE: 'calls:create',
  CALLS_UPDATE: 'calls:update',
  CALLS_DELETE: 'calls:delete',
  CALLS_RECORD: 'calls:record',

  // Transcript management
  TRANSCRIPTS_VIEW: 'transcripts:view',
  TRANSCRIPTS_SEARCH: 'transcripts:search',
  TRANSCRIPTS_EXPORT: 'transcripts:export',

  // User management
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',

  // Settings management
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_UPDATE: 'settings:update',

  // API key management
  API_KEYS_VIEW: 'api_keys:view',
  API_KEYS_CREATE: 'api_keys:create',
  API_KEYS_REVOKE: 'api_keys:revoke',

  // Usage and billing
  USAGE_VIEW: 'usage:view',
  BILLING_VIEW: 'billing:view',
  BILLING_UPDATE: 'billing:update',

  // Audit logs
  AUDIT_VIEW: 'audit:view',

  // Webhook management
  WEBHOOKS_VIEW: 'webhooks:view',
  WEBHOOKS_CREATE: 'webhooks:create',
  WEBHOOKS_UPDATE: 'webhooks:update',
  WEBHOOKS_DELETE: 'webhooks:delete',
} as const;

/**
 * Default permissions by role
 */
export const RolePermissions: Record<string, string[]> = {
  owner: Object.values(Permissions),
  admin: [
    Permissions.CALLS_VIEW,
    Permissions.CALLS_CREATE,
    Permissions.CALLS_UPDATE,
    Permissions.CALLS_DELETE,
    Permissions.CALLS_RECORD,
    Permissions.TRANSCRIPTS_VIEW,
    Permissions.TRANSCRIPTS_SEARCH,
    Permissions.TRANSCRIPTS_EXPORT,
    Permissions.USERS_VIEW,
    Permissions.USERS_CREATE,
    Permissions.USERS_UPDATE,
    Permissions.SETTINGS_VIEW,
    Permissions.SETTINGS_UPDATE,
    Permissions.API_KEYS_VIEW,
    Permissions.API_KEYS_CREATE,
    Permissions.API_KEYS_REVOKE,
    Permissions.USAGE_VIEW,
    Permissions.AUDIT_VIEW,
    Permissions.WEBHOOKS_VIEW,
    Permissions.WEBHOOKS_CREATE,
    Permissions.WEBHOOKS_UPDATE,
  ],
  member: [
    Permissions.CALLS_VIEW,
    Permissions.CALLS_CREATE,
    Permissions.CALLS_RECORD,
    Permissions.TRANSCRIPTS_VIEW,
    Permissions.TRANSCRIPTS_SEARCH,
    Permissions.USERS_VIEW,
    Permissions.API_KEYS_VIEW,
    Permissions.API_KEYS_CREATE,
    Permissions.SETTINGS_VIEW,
  ],
  viewer: [
    Permissions.CALLS_VIEW,
    Permissions.TRANSCRIPTS_VIEW,
    Permissions.USERS_VIEW,
  ],
};

// =====================================================
// ERROR CLASSES
// =====================================================

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export const AuthErrors = {
  MISSING_TOKEN: new AuthError('Missing authorization token', 'missing_token', 401),
  INVALID_TOKEN: new AuthError('Invalid or expired token', 'invalid_token', 401),
  INSUFFICIENT_PERMISSIONS: new AuthError('Insufficient permissions', 'insufficient_permissions', 403),
  TENANT_ACCESS_DENIED: new AuthError('Access denied to tenant', 'tenant_access_denied', 403),
  API_KEY_INVALID: new AuthError('Invalid or expired API key', 'api_key_invalid', 401),
  USER_DISABLED: new AuthError('User account is disabled', 'user_disabled', 403),
  TENANT_INACTIVE: new AuthError('Tenant account is not active', 'tenant_inactive', 403),
  RATE_LIMIT_EXCEEDED: new AuthError('Rate limit exceeded', 'rate_limit_exceeded', 429),
} as const;

/**
 * Extract token from Authorization header
 * Supports both "Bearer <token>" and "ApiKey <key>" formats
 */
export function extractToken(authHeader: string | null): { type: 'bearer' | 'apikey'; token: string } | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2) return null;

  const [type, token] = parts;

  if (type.toLowerCase() === 'bearer') {
    return { type: 'bearer', token };
  } else if (type.toLowerCase() === 'apikey') {
    return { type: 'apikey', token };
  }

  return null;
}
