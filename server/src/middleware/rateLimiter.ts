import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

/**
 * In-memory sliding window rate limiter complying with OWASP API4 guidelines.
 * No external dependencies required.
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
}) {
  const store: RateLimitStore = {};
  const { windowMs, max, message = 'Too many requests, please try again later.' } = options;

  // Periodic cleanup of stale entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const key in store) {
      if (store[key].resetTime <= now) {
        delete store[key];
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    // Determine client identifier (IP address, handling proxy headers)
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown-client';

    const now = Date.now();
    const clientRecord = store[ip];

    if (!clientRecord || clientRecord.resetTime <= now) {
      // Initialize or reset window
      store[ip] = {
        count: 1,
        resetTime: now + windowMs,
      };

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
      return next();
    }

    if (clientRecord.count >= max) {
      const retryAfterSeconds = Math.ceil((clientRecord.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil(clientRecord.resetTime / 1000));

      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: retryAfterSeconds,
      });
    }

    clientRecord.count++;
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - clientRecord.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(clientRecord.resetTime / 1000));

    next();
  };
}

