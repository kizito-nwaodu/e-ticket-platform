import { Request, Response, NextFunction } from 'express';

/**
 * Enterprise HTTP Security Headers Middleware (OWASP Secure Headers Project)
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Clickjacking defense
  res.setHeader('X-Frame-Options', 'DENY');

  // Disable obsolete and vulnerable browser XSS auditors in favor of CSP
  res.setHeader('X-XSS-Protection', '0');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Feature / Permissions Policy (Allow camera for gate scanning, restrict others)
  res.setHeader('Permissions-Policy', 'camera=*, geolocation=(), microphone=()');

  // Strict Transport Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Cross-Domain Policy
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  next();
}

/**
 * Standard structured request latency logger
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/health') {
      const color = res.statusCode >= 500 ? '\x1b[31m' : res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
      console.log(`[HTTP] ${req.method} ${req.originalUrl} ${color}${res.statusCode}\x1b[0m ${duration}ms`);
    }
  });
  next();
}

