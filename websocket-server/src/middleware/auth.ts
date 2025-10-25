/**
 * Production-Grade Authentication Middleware
 * Handles JWT and API key authentication for HTTP and WebSocket connections
 */

import type { Request, Response, NextFunction } from 'express';
import type { IncomingMessage } from 'http';
import { createServiceClient } from '../../../shared/lib/supabase-client';
import type { AuditLogInsert } from '../../../shared/types/database';
import {
  verifyToken,
  verifyApiKey,
  extractToken,
  hasPermission,
  hasAnyPermission,
  hasRole,
  loadAuthContext,
  AuthError,
  AuthErrors,
  type AuthenticatedUser,
  type AuthContext,
} from '../../../shared/lib/auth';

// =====================================================
// EXTEND EXPRESS REQUEST TYPE
// =====================================================

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      authContext?: AuthContext;
    }
  }
}

// =====================================================
// SUPABASE CLIENT INITIALIZATION
// =====================================================

let supabaseClient: ReturnType<typeof createServiceClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
    }

    supabaseClient = createServiceClient(supabaseUrl, supabaseServiceKey);
  }

  return supabaseClient;
}

// =====================================================
// HTTP AUTHENTICATION MIDDLEWARE
// =====================================================

/**
 * Require authentication for HTTP requests
 * Supports both JWT (Bearer token) and API keys
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      error: {
        code: 'missing_token',
        message: 'Authorization header is required',
      },
    });
    return;
  }

  authenticateRequest(req, res, next);
}

/**
 * Optional authentication - sets user if present but doesn't require it
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  authenticateRequest(req, res, next);
}

/**
 * Core authentication logic
 */
async function authenticateRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next();
    }

    const tokenInfo = extractToken(authHeader);

    if (!tokenInfo) {
      res.status(401).json({
        error: {
          code: 'invalid_auth_header',
          message: 'Authorization header must be in format: Bearer <token> or ApiKey <key>',
        },
      });
      return;
    }

    let user: AuthenticatedUser | null = null;

    if (tokenInfo.type === 'bearer') {
      // JWT authentication
      user = await verifyToken(supabase, tokenInfo.token);
    } else if (tokenInfo.type === 'apikey') {
      // API key authentication
      user = await verifyApiKey(supabase, tokenInfo.token);
    }

    if (!user) {
      res.status(401).json({
        error: {
          code: 'invalid_token',
          message: 'Invalid or expired authentication credentials',
        },
      });
      return;
    }

    // Check if user is active
    if (user.status !== 'active') {
      res.status(403).json({
        error: {
          code: 'user_inactive',
          message: 'User account is not active',
        },
      });
      return;
    }

    // Attach user to request
    req.user = user;

    // Optionally load full auth context (tenant info)
    const authContext = await loadAuthContext(supabase, user);
    if (authContext) {
      req.authContext = authContext;
    }

    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error);

    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'An error occurred during authentication',
      },
    });
    return;
  }
}

// =====================================================
// PERMISSION MIDDLEWARE
// =====================================================

/**
 * Require specific permission
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'not_authenticated',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!hasPermission(req.user, permission)) {
      res.status(403).json({
        error: {
          code: 'insufficient_permissions',
          message: `Permission required: ${permission}`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Require any of the specified permissions
 */
export function requireAnyPermission(permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'not_authenticated',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!hasAnyPermission(req.user, permissions)) {
      res.status(403).json({
        error: {
          code: 'insufficient_permissions',
          message: `One of these permissions required: ${permissions.join(', ')}`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Require specific role
 */
export function requireRole(roles: ('owner' | 'admin' | 'member' | 'viewer')[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'not_authenticated',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!hasRole(req.user, roles)) {
      res.status(403).json({
        error: {
          code: 'insufficient_role',
          message: `One of these roles required: ${roles.join(', ')}`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Require tenant ownership (user must belong to specified tenant)
 */
export function requireTenantAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'not_authenticated',
        message: 'Authentication required',
      },
    });
    return;
  }

  // Extract tenant ID from request (URL param, body, or query)
  const tenantId = req.params.tenantId || req.body?.tenantId || req.query.tenantId;

  if (!tenantId) {
    res.status(400).json({
      error: {
        code: 'missing_tenant_id',
        message: 'Tenant ID is required',
      },
    });
    return;
  }

  if (req.user.tenantId !== tenantId) {
    res.status(403).json({
      error: {
        code: 'tenant_access_denied',
        message: 'Access denied to this tenant',
      },
    });
    return;
  }

  next();
}

// =====================================================
// WEBSOCKET AUTHENTICATION
// =====================================================

/**
 * Authenticate WebSocket connection
 * Extracts token from query parameter or Sec-WebSocket-Protocol header
 */
export async function authenticateWebSocket(
  req: IncomingMessage,
  protocols: string[] = []
): Promise<AuthenticatedUser | null> {
  try {
    const supabase = getSupabaseClient();

    // Method 1: Token in query parameter (?token=xxx)
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    let token = url.searchParams.get('token');
    let tokenType: 'bearer' | 'apikey' = 'bearer';

    // Method 2: Token in Sec-WebSocket-Protocol header
    if (!token && protocols.length > 0) {
      // Format: ["Bearer", "eyJhbGc..."] or ["ApiKey", "sk_live_..."]
      if (protocols[0] === 'Bearer' && protocols[1]) {
        token = protocols[1];
        tokenType = 'bearer';
      } else if (protocols[0] === 'ApiKey' && protocols[1]) {
        token = protocols[1];
        tokenType = 'apikey';
      }
    }

    // Method 3: API key in query parameter (?apikey=xxx)
    if (!token) {
      const apiKey = url.searchParams.get('apikey');
      if (apiKey) {
        token = apiKey;
        tokenType = 'apikey';
      }
    }

    if (!token) {
      console.warn('[WS Auth] No authentication token provided');
      return null;
    }

    let user: AuthenticatedUser | null = null;

    if (tokenType === 'bearer') {
      user = await verifyToken(supabase, token);
    } else {
      user = await verifyApiKey(supabase, token);
    }

    if (!user) {
      console.warn('[WS Auth] Token verification failed');
      return null;
    }

    if (user.status !== 'active') {
      console.warn('[WS Auth] User not active:', user.id);
      return null;
    }

    console.log(`[WS Auth] Authenticated: ${user.email} (${user.id}) - Tenant: ${user.tenantId}`);

    return user;
  } catch (error) {
    console.error('[WS Auth] Authentication error:', error);
    return null;
  }
}

/**
 * WebSocket authentication middleware for ws library
 * Usage: wss.on('connection', websocketAuthMiddleware(async (ws, req, user) => { ... }))
 */
export function websocketAuthMiddleware<T = any>(
  handler: (ws: T, req: IncomingMessage, user: AuthenticatedUser) => void | Promise<void>,
  required: boolean = true
) {
  return async (ws: T, req: IncomingMessage, ...protocols: string[]) => {
    const user = await authenticateWebSocket(req, protocols);

    if (!user && required) {
      console.warn('[WS] Unauthenticated connection rejected');
      // Close connection with auth error
      if (typeof (ws as any).close === 'function') {
        (ws as any).close(1008, 'Authentication required'); // Policy Violation
      }
      return;
    }

    // Attach user to request for downstream handlers
    (req as any).user = user;

    await handler(ws, req, user!);
  };
}

// =====================================================
// AUDIT LOGGING HELPERS
// =====================================================

/**
 * Log authentication event to audit log
 */
export async function logAuthEvent(
  userId: string,
  tenantId: string,
  action: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const entry: AuditLogInsert = {
      tenant_id: tenantId,
      user_id: userId,
      action,
      resource_type: 'auth',
      resource_id: userId,
      old_values: null,
      new_values: null,
      ip_address: null,
      user_agent: null,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    };

    await (supabase.from('audit_logs') as any).insert(entry);
  } catch (error) {
    console.error('[Auth] Failed to log audit event:', error);
  }
}

// =====================================================
// UTILITY EXPORTS
// =====================================================

export { getSupabaseClient };
