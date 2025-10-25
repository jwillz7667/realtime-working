/**
 * Production-Grade Security Middleware
 * Implements security best practices with Helmet, CORS, and CSP
 */

import type { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';

// =====================================================
// HELMET CONFIGURATION (Security Headers)
// =====================================================

/**
 * Configure Helmet with production-ready security headers
 */
export function configureSecurityHeaders(app: Application): void {
  app.use(
    helmet({
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for some widgets
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: [
            "'self'",
            'https://api.openai.com',
            'wss://api.openai.com',
            'https://*.supabase.co',
            'wss://*.supabase.co',
          ],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },

      // Strict-Transport-Security: Force HTTPS
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },

      // X-Frame-Options: Prevent clickjacking
      frameguard: {
        action: 'deny',
      },

      // X-Content-Type-Options: Prevent MIME sniffing
      noSniff: true,

      // X-XSS-Protection: Enable browser XSS filter
      xssFilter: true,

      // Referrer-Policy: Control referrer information
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },

      // X-DNS-Prefetch-Control: Control DNS prefetching
      dnsPrefetchControl: {
        allow: false,
      },

      // X-Download-Options: Prevent opening downloads in IE
      ieNoOpen: true,

      // X-Permitted-Cross-Domain-Policies: Control Adobe Flash/PDF
      permittedCrossDomainPolicies: {
        permittedPolicies: 'none',
      },
    })
  );

  console.log('[Security] Helmet security headers configured');
}

// =====================================================
// CORS CONFIGURATION
// =====================================================

/**
 * Configure CORS with production-ready settings
 */
export function configureCors(app: Application): void {
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:8081',
    'https://localhost:3000',
    'https://verbio.app',
  ];

  const allowedOrigins = new Set<string>(
    process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
      : defaultOrigins
  );

  // Always allow the production frontend by default
  allowedOrigins.add('https://verbio.app');

  // Add production frontend URL if set (overrides default if custom)
  const productionUrl = process.env.FRONTEND_URL;
  if (productionUrl) {
    allowedOrigins.add(productionUrl.trim());
  }

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
          return callback(null, true);
        }

        if (allowedOrigins.has(origin) || allowedOrigins.has('*')) {
          return callback(null, true);
        }

        console.warn(`[CORS] Blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Tenant-ID',
        'X-Request-ID',
      ],
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-Request-ID',
      ],
      maxAge: 86400, // 24 hours
    })
  );

  console.log(
    `[Security] CORS configured for origins: ${Array.from(allowedOrigins).join(', ')}`
  );
}

// =====================================================
// REQUEST ID MIDDLEWARE
// =====================================================

/**
 * Add unique request ID to each request for tracing
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId =
    req.headers['x-request-id']?.toString() ||
    `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
}

// =====================================================
// REQUEST LOGGING MIDDLEWARE
// =====================================================

/**
 * Log HTTP requests for monitoring
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || 'unknown';

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const user = (req as any).user?.email || 'anonymous';

    console.log(
      `[HTTP] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - User: ${user} - ReqID: ${requestId}`
    );
  });

  next();
}

// =====================================================
// ERROR HANDLING MIDDLEWARE
// =====================================================

/**
 * Global error handler
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  const requestId = req.headers['x-request-id'] || 'unknown';

  console.error(`[Error] ReqID: ${requestId}`, {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: (req as any).user?.id || 'anonymous',
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.statusCode || 500).json({
    error: {
      code: err.code || 'internal_error',
      message: isDevelopment ? err.message : 'An internal error occurred',
      ...(isDevelopment && { stack: err.stack }),
      requestId,
    },
  });
}

// =====================================================
// INPUT SANITIZATION MIDDLEWARE
// =====================================================

/**
 * Sanitize request body to prevent injection attacks
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  if (req.body) {
    sanitizeObject(req.body);
  }

  if (req.query) {
    sanitizeObject(req.query);
  }

  if (req.params) {
    sanitizeObject(req.params);
  }

  next();
}

function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove null bytes
      obj[key] = obj[key].replace(/\0/g, '');

      // Trim whitespace
      obj[key] = obj[key].trim();
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

// =====================================================
// HEALTH CHECK ENDPOINT
// =====================================================

/**
 * Health check endpoint for load balancers
 */
export function healthCheck(req: Request, res: Response): void {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
}

// =====================================================
// SECURITY AUDIT MIDDLEWARE
// =====================================================

/**
 * Log security-sensitive operations
 */
export function securityAuditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const sensitiveEndpoints = [
    '/api/auth/login',
    '/api/auth/signup',
    '/api/auth/logout',
    '/api/apikeys',
    '/api/users',
  ];

  const isSensitive = sensitiveEndpoints.some(endpoint => req.path.startsWith(endpoint));

  if (isSensitive) {
    const user = (req as any).user?.id || 'anonymous';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    console.log(`[Security Audit] ${req.method} ${req.path} - User: ${user} - IP: ${ip}`);
  }

  next();
}

// =====================================================
// APPLY ALL SECURITY MIDDLEWARE
// =====================================================

/**
 * Apply all security middleware to Express app
 */
export function applySecurityMiddleware(app: Application): void {
  // Security headers
  configureSecurityHeaders(app);

  // CORS
  configureCors(app);

  // Request ID
  app.use(requestIdMiddleware);

  // Input sanitization
  app.use(sanitizeInput);

  // Security audit logging
  app.use(securityAuditMiddleware);

  // Request logging
  if (process.env.LOG_HTTP_REQUESTS !== 'false') {
    app.use(requestLoggingMiddleware);
  }

  // Health check
  app.get('/health', healthCheck);
  app.get('/ping', (_req: Request, res: Response) => {
    res.send('pong');
  });

  console.log('[Security] All security middleware applied');
}
