/**
 * API Key Management Endpoints
 * Production-ready CRUD operations for API keys with audit logging
 */

import express, { type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermission, getSupabaseClient } from '../middleware/auth';
import { apiKeyCreationRateLimiter, apiRateLimiter } from '../middleware/rateLimit';
import {
  createApiKey,
  revokeApiKey,
  listApiKeys,
  Permissions,
  ApiKeyCreateSchema,
  type ApiKeyInfo,
} from '../../../shared/lib/auth';
import type { AuthenticatedUser } from '../../../shared/lib/auth';
import type { Database } from '../../../shared/types/database';

type ApiKeyRow = Database['public']['Tables']['api_keys']['Row'];

const router = express.Router();

function getAuthenticatedUser(req: Request, res: Response): AuthenticatedUser | null {
  const user = req.user;
  if (!user) {
    res.status(401).json({
      error: {
        code: 'not_authenticated',
        message: 'Authentication required',
      },
    });
    return null;
  }

  return user;
}

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const CreateApiKeyRequestSchema = z.object({
  name: z.string().min(3).max(100),
  scopes: z.array(z.string()).min(1).max(20),
  expiresInDays: z.number().min(1).max(365).optional(),
});

const RevokeApiKeyRequestSchema = z.object({
  keyId: z.string().uuid(),
});

// =====================================================
// LIST API KEYS
// =====================================================

/**
 * GET /api/apikeys
 * List all API keys for the authenticated user's tenant
 */
const listApiKeysHandler: RequestHandler = async (req, res) => {
  try {
    const user = getAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    const supabase = getSupabaseClient();

    const keys: ApiKeyInfo[] = await listApiKeys(supabase, user.tenantId);

    res.json({
      data: keys.map((key: ApiKeyInfo) => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        scopes: key.scopes,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt,
        // Don't return full key or hash
      })),
    });
  } catch (error: unknown) {
    console.error('[API Keys] List error:', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Failed to list API keys',
      },
    });
  }
};

router.get(
  '/',
  apiRateLimiter,
  requireAuth,
  requirePermission(Permissions.API_KEYS_VIEW),
  listApiKeysHandler
);

// =====================================================
// GET SINGLE API KEY
// =====================================================

/**
 * GET /api/apikeys/:id
 * Get details for a specific API key
 */
const getApiKeyHandler: RequestHandler = async (req, res) => {
  try {
    const user = getAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    const supabase = getSupabaseClient();
    const keyId = req.params.id;

    if (!z.string().uuid().safeParse(keyId).success) {
      res.status(400).json({
        error: {
          code: 'invalid_id',
          message: 'Invalid API key ID',
        },
      });
      return;
    }

    const { data: key, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, tenant_id, user_id, expires_at, last_used_at, created_at, usage_count')
      .eq('id', keyId)
      .eq('tenant_id', user.tenantId)
      .eq('is_active', true)
      .single();

    const keyRecord = key as ApiKeyRow | null;

    if (error || !keyRecord) {
      res.status(404).json({
        error: {
          code: 'not_found',
          message: 'API key not found',
        },
      });
      return;
    }

    res.json({
      data: {
        id: keyRecord.id,
        name: keyRecord.name,
        keyPrefix: keyRecord.key_prefix,
        scopes: keyRecord.scopes as string[],
        expiresAt: keyRecord.expires_at,
        lastUsedAt: keyRecord.last_used_at,
        createdAt: keyRecord.created_at,
        usageCount: keyRecord.usage_count || 0,
      },
    });
  } catch (error: unknown) {
    console.error('[API Keys] Get error:', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Failed to get API key',
      },
    });
  }
};

router.get(
  '/:id',
  apiRateLimiter,
  requireAuth,
  requirePermission(Permissions.API_KEYS_VIEW),
  getApiKeyHandler
);

// =====================================================
// CREATE API KEY
// =====================================================

/**
 * POST /api/apikeys
 * Create a new API key
 */
const createApiKeyHandler: RequestHandler = async (req, res) => {
  try {
    const user = getAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    const supabase = getSupabaseClient();

    // Validate request body
    const validation = CreateApiKeyRequestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: {
          code: 'validation_error',
          message: 'Invalid request body',
          details: validation.error.errors,
        },
      });
      return;
    }

    const { name, scopes, expiresInDays } = validation.data;

    // Validate scopes against available permissions
    const invalidScopes = scopes.filter(
      scope => !Object.values(Permissions).includes(scope as any)
    );

    if (invalidScopes.length > 0) {
      res.status(400).json({
        error: {
          code: 'invalid_scopes',
          message: `Invalid scopes: ${invalidScopes.join(', ')}`,
        },
      });
      return;
    }

    // Check if user has permission to grant these scopes
    const unauthorizedScopes = scopes.filter(
      scope => !user.permissions.includes(scope) && user.role !== 'owner'
    );

    if (unauthorizedScopes.length > 0) {
      res.status(403).json({
        error: {
          code: 'insufficient_permissions',
          message: `You don't have permission to grant these scopes: ${unauthorizedScopes.join(', ')}`,
        },
      });
      return;
    }

    // Create API key
    const result = await createApiKey(supabase, user.id, user.tenantId, {
      name,
      scopes,
      expiresInDays,
    });

    if (!result) {
      res.status(500).json({
        error: {
          code: 'creation_failed',
          message: 'Failed to create API key',
        },
      });
      return;
    }

    // IMPORTANT: This is the only time the full API key is returned
    res.status(201).json({
      data: {
        apiKey: result.apiKey, // Full key - only shown once!
        id: result.keyInfo.id,
        name: result.keyInfo.name,
        keyPrefix: result.keyInfo.keyPrefix,
        scopes: result.keyInfo.scopes,
        expiresAt: result.keyInfo.expiresAt,
        createdAt: result.keyInfo.createdAt,
      },
      warning: 'Save this API key securely. It will not be shown again.',
    });
  } catch (error: unknown) {
    console.error('[API Keys] Create error:', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Failed to create API key',
      },
    });
  }
};

router.post(
  '/',
  apiKeyCreationRateLimiter,
  requireAuth,
  requirePermission(Permissions.API_KEYS_CREATE),
  createApiKeyHandler
);

// =====================================================
// REVOKE API KEY
// =====================================================

/**
 * DELETE /api/apikeys/:id
 * Revoke (deactivate) an API key
 */
const revokeApiKeyHandler: RequestHandler = async (req, res) => {
  try {
    const user = getAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    const supabase = getSupabaseClient();
    const keyId = req.params.id;

    if (!z.string().uuid().safeParse(keyId).success) {
      res.status(400).json({
        error: {
          code: 'invalid_id',
          message: 'Invalid API key ID',
        },
      });
      return;
    }

    // Check if key exists and belongs to tenant
    const { data: key, error: fetchError } = await supabase
      .from('api_keys')
      .select('id, user_id, tenant_id')
      .eq('id', keyId)
      .eq('tenant_id', user.tenantId)
      .single();

    const keyRecord = key as ApiKeyRow | null;

    if (fetchError || !keyRecord) {
      res.status(404).json({
        error: {
          code: 'not_found',
          message: 'API key not found',
        },
      });
      return;
    }

    // Only owner/admin can revoke other users' keys
    if (keyRecord.user_id !== user.id && !['owner', 'admin'].includes(user.role)) {
      res.status(403).json({
        error: {
          code: 'forbidden',
          message: 'You can only revoke your own API keys',
        },
      });
      return;
    }

    // Revoke key
    const success = await revokeApiKey(supabase, keyId, user.id, user.tenantId);

    if (!success) {
      res.status(500).json({
        error: {
          code: 'revocation_failed',
          message: 'Failed to revoke API key',
        },
      });
      return;
    }

    res.json({
      data: {
        id: keyId,
        revoked: true,
        revokedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('[API Keys] Revoke error:', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Failed to revoke API key',
      },
    });
  }
};

router.delete(
  '/:id',
  apiRateLimiter,
  requireAuth,
  requirePermission(Permissions.API_KEYS_REVOKE),
  revokeApiKeyHandler
);

// =====================================================
// ROTATE API KEY (ADVANCED)
// =====================================================

/**
 * POST /api/apikeys/:id/rotate
 * Rotate an API key (create new, revoke old)
 */
const rotateApiKeyHandler: RequestHandler = async (req, res) => {
  try {
    const user = getAuthenticatedUser(req, res);
    if (!user) {
      return;
    }
    const supabase = getSupabaseClient();
    const keyId = req.params.id;

    if (!z.string().uuid().safeParse(keyId).success) {
      res.status(400).json({
        error: {
          code: 'invalid_id',
          message: 'Invalid API key ID',
        },
      });
      return;
    }

    // Get existing key
    const { data: oldKey, error: fetchError } = await supabase
      .from('api_keys')
      .select('id, name, scopes, tenant_id, user_id, expires_at')
      .eq('id', keyId)
      .eq('tenant_id', user.tenantId)
      .eq('is_active', true)
      .single();

    const oldKeyRecord = oldKey as ApiKeyRow | null;

    if (fetchError || !oldKeyRecord) {
      res.status(404).json({
        error: {
          code: 'not_found',
          message: 'API key not found or already revoked',
        },
      });
      return;
    }

    // Only owner/admin can rotate other users' keys
    if (oldKeyRecord.user_id !== user.id && !['owner', 'admin'].includes(user.role)) {
      res.status(403).json({
        error: {
          code: 'forbidden',
          message: 'You can only rotate your own API keys',
        },
      });
      return;
    }

    // Calculate expiry for new key
    let expiresInDays: number | undefined;
    if (oldKeyRecord.expires_at) {
      const expiryDate = new Date(oldKeyRecord.expires_at);
      const now = new Date();
      const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expiresInDays = Math.max(1, daysRemaining);
    }

    // Create new key with same settings
    const result = await createApiKey(supabase, user.id, user.tenantId, {
      name: `${oldKeyRecord.name} (rotated)`,
      scopes: (oldKeyRecord.scopes as string[]) || [],
      expiresInDays,
    });

    if (!result) {
      res.status(500).json({
        error: {
          code: 'rotation_failed',
          message: 'Failed to create new API key',
        },
      });
      return;
    }

    // Revoke old key
    await revokeApiKey(supabase, keyId, user.id, user.tenantId);

    res.status(201).json({
      data: {
        apiKey: result.apiKey,
        id: result.keyInfo.id,
        name: result.keyInfo.name,
        keyPrefix: result.keyInfo.keyPrefix,
        scopes: result.keyInfo.scopes,
        expiresAt: result.keyInfo.expiresAt,
        createdAt: result.keyInfo.createdAt,
        oldKeyId: keyId,
        rotated: true,
      },
      warning: 'Save this API key securely. It will not be shown again. The old key has been revoked.',
    });
  } catch (error: unknown) {
    console.error('[API Keys] Rotate error:', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Failed to rotate API key',
      },
    });
  }
};

router.post(
  '/:id/rotate',
  apiKeyCreationRateLimiter,
  requireAuth,
  requirePermission(Permissions.API_KEYS_CREATE),
  rotateApiKeyHandler
);

// =====================================================
// GET AVAILABLE SCOPES
// =====================================================

/**
 * GET /api/apikeys/scopes
 * Get list of available permission scopes
 */
const getScopesHandler: RequestHandler = async (req, res) => {
  try {
    const user = getAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const permissionEntries = Object.entries(Permissions) as Array<
      [keyof typeof Permissions, (typeof Permissions)[keyof typeof Permissions]]
    >;

    const allScopes = permissionEntries.map(([key, value]) => ({
      key,
      value,
      description: getScopeDescription(value),
      category: getScopeCategory(value),
    }));

    // Filter to only scopes the user has permission to grant
    const grantableScopes = user.role === 'owner'
      ? allScopes
      : allScopes.filter(scope => user.permissions.includes(scope.value));

    res.json({
      data: {
        all: allScopes,
        grantable: grantableScopes,
        userPermissions: user.permissions,
        userRole: user.role,
      },
    });
  } catch (error: unknown) {
    console.error('[API Keys] Scopes error:', error);
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Failed to get scopes',
      },
    });
  }
};

router.get(
  '/meta/scopes',
  apiRateLimiter,
  requireAuth,
  getScopesHandler
);

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function getScopeDescription(scope: string): string {
  const descriptions: Record<string, string> = {
    'calls:view': 'View call sessions',
    'calls:create': 'Create new call sessions',
    'calls:update': 'Update call sessions',
    'calls:delete': 'Delete call sessions',
    'calls:record': 'Record call sessions',
    'transcripts:view': 'View transcripts',
    'transcripts:search': 'Search transcripts',
    'transcripts:export': 'Export transcripts',
    'users:view': 'View users',
    'users:create': 'Create new users',
    'users:update': 'Update users',
    'users:delete': 'Delete users',
    'settings:view': 'View settings',
    'settings:update': 'Update settings',
    'api_keys:view': 'View API keys',
    'api_keys:create': 'Create API keys',
    'api_keys:revoke': 'Revoke API keys',
    'usage:view': 'View usage metrics',
    'billing:view': 'View billing information',
    'billing:update': 'Update billing settings',
    'audit:view': 'View audit logs',
    'webhooks:view': 'View webhooks',
    'webhooks:create': 'Create webhooks',
    'webhooks:update': 'Update webhooks',
    'webhooks:delete': 'Delete webhooks',
  };

  return descriptions[scope] || scope;
}

function getScopeCategory(scope: string): string {
  const category = scope.split(':')[0];
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export default router;
