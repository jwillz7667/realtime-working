/**
 * Production-Ready Rate Limiting Middleware
 * Prevents abuse with configurable limits per IP, user, and API key
 * Uses sliding window algorithm for accurate rate limiting
 */

import type { Request, Response, NextFunction } from 'express';

// =====================================================
// RATE LIMIT CONFIGURATION
// =====================================================

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string; // Custom error message
  statusCode?: number; // HTTP status code (default: 429)
  keyGenerator?: (req: Request) => string; // Custom key generator
  skip?: (req: Request) => boolean; // Skip rate limiting for certain requests
  onLimitReached?: (req: Request, key: string) => void; // Callback when limit reached
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
  requests: number[]; // Timestamps of requests (for sliding window)
}

// =====================================================
// IN-MEMORY STORE WITH LRU EVICTION
// =====================================================

class RateLimitStore {
  private store: Map<string, RateLimitRecord> = new Map();
  private readonly maxSize: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;

    // Cleanup expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if request is within rate limit
   */
  hit(key: string, windowMs: number, maxRequests: number): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    let record = this.store.get(key);

    if (!record) {
      // First request
      record = {
        count: 1,
        resetTime: now + windowMs,
        requests: [now],
      };
      this.store.set(key, record);

      // Enforce max size (LRU eviction)
      if (this.store.size > this.maxSize) {
        const firstKey = this.store.keys().next().value;
        if (firstKey) {
          this.store.delete(firstKey);
        }
      }

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: record.resetTime,
      };
    }

    // Sliding window: Remove requests outside the window
    record.requests = record.requests.filter(timestamp => timestamp > now - windowMs);
    record.count = record.requests.length;

    // Check if limit exceeded
    if (record.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.requests[0] + windowMs,
      };
    }

    // Add new request
    record.requests.push(now);
    record.count++;
    record.resetTime = record.requests[0] + windowMs;

    this.store.set(key, record);

    return {
      allowed: true,
      remaining: maxRequests - record.count,
      resetTime: record.resetTime,
    };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, record] of this.store.entries()) {
      if (record.resetTime < now) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.store.delete(key);
    }

    if (keysToDelete.length > 0) {
      console.log(`[RateLimit] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Get current stats
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.store.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Global store instance
const globalStore = new RateLimitStore();

// =====================================================
// RATE LIMIT MIDDLEWARE FACTORY
// =====================================================

/**
 * Create rate limit middleware with custom configuration
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    statusCode = 429,
    keyGenerator = defaultKeyGenerator,
    skip = () => false,
    onLimitReached,
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip if configured
    if (skip(req)) {
      return next();
    }

    // Generate rate limit key
    const key = keyGenerator(req);

    // Check rate limit
    const result = globalStore.hit(key, windowMs, maxRequests);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      // Rate limit exceeded
      if (onLimitReached) {
        onLimitReached(req, key);
      }

      console.warn(`[RateLimit] Limit exceeded for key: ${key}`);

      res.status(statusCode).json({
        error: {
          code: 'rate_limit_exceeded',
          message,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        },
      });
      return;
    }

    // Allow request
    next();
  };
}

// =====================================================
// KEY GENERATORS
// =====================================================

/**
 * Default key generator (by IP address)
 */
function defaultKeyGenerator(req: Request): string {
  // Support various proxy headers
  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.headers['x-real-ip']?.toString() ||
    req.socket.remoteAddress ||
    'unknown';

  return `ip:${ip}`;
}

/**
 * Key generator by authenticated user
 */
export function userKeyGenerator(req: Request): string {
  // Assumes req.user is populated by auth middleware
  const userId = (req as any).user?.id;
  if (userId) {
    return `user:${userId}`;
  }

  // Fallback to IP if not authenticated
  return defaultKeyGenerator(req);
}

/**
 * Key generator by tenant
 */
export function tenantKeyGenerator(req: Request): string {
  const tenantId = (req as any).user?.tenantId;
  if (tenantId) {
    return `tenant:${tenantId}`;
  }

  // Fallback to user or IP
  return userKeyGenerator(req);
}

/**
 * Key generator by API key
 */
export function apiKeyGenerator(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('ApiKey ')) {
    const key = authHeader.substring(7);
    // Use first 8 chars as prefix for rate limiting
    return `apikey:${key.substring(0, 8)}`;
  }

  // Fallback to user or IP
  return userKeyGenerator(req);
}

// =====================================================
// PRESET RATE LIMITERS
// =====================================================

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per 15 minutes per IP
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many login attempts, please try again later',
  statusCode: 429,
  keyGenerator: defaultKeyGenerator,
  onLimitReached: (req, key) => {
    console.warn(`[Auth] Rate limit exceeded for ${key} - IP: ${req.ip}`);
  },
});

/**
 * General API rate limiter
 * 100 requests per 15 minutes per user
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'API rate limit exceeded',
  keyGenerator: userKeyGenerator,
});

/**
 * Strict rate limiter for API key creation
 * 3 requests per hour per user
 */
export const apiKeyCreationRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  message: 'Too many API key creation attempts',
  keyGenerator: userKeyGenerator,
});

/**
 * Rate limiter for WebSocket connections
 * 10 connections per minute per IP
 */
export const websocketRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Too many connection attempts',
  keyGenerator: defaultKeyGenerator,
});

/**
 * Rate limiter for phone calls (Twilio webhook)
 * 30 calls per hour per tenant
 */
export const callRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 30,
  message: 'Call rate limit exceeded for tenant',
  keyGenerator: tenantKeyGenerator,
  skip: (req) => {
    // Skip for health checks
    return req.path === '/health' || req.path === '/ping';
  },
});

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Reset rate limit for a specific key (admin only)
 */
export function resetRateLimit(key: string): void {
  globalStore.reset(key);
}

/**
 * Get rate limit store stats
 */
export function getRateLimitStats(): { size: number; maxSize: number } {
  return globalStore.getStats();
}

/**
 * Cleanup rate limit store (call on server shutdown)
 */
export function cleanupRateLimitStore(): void {
  globalStore.destroy();
}

// =====================================================
// EXPORT STORE FOR TESTING
// =====================================================

export { RateLimitStore, globalStore };
