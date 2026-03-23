import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Request, RequestHandler } from 'express';

// General API rate limiter (IP-based): 500 requests / 15 minutes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, 
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path.includes('/health');
  }
});

// Authentication limiter (IP-based): 5 failed attempts / 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
  },
});

// File uploads: 20 uploads / hour
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Upload limit exceeded. Try again later.',
  },
});

// Post creation: 10 posts / 5 minutes
export const postLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'You are posting too frequently. Please slow down.',
  },
});

// Slow down bursty clients: delay after 50 requests / 15 mins
export const speedLimiter: RequestHandler = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: () => 500,
});

// User-based rate limiter (by user ID or IP fallback)
export const createUserBasedLimiter = (
  maxRequests: number,
  windowMs: number = 15 * 60 * 1000
): RequestHandler => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    keyGenerator: (req: Request): string => {
      const userId = (req as any).user?.id;
      // use userId when present, otherwise use express-rate-limit's ipKeyGenerator
      return userId ? String(userId) : ipKeyGenerator(req as any);
    },
    message: {
      success: false,
      message: 'Rate limit exceeded for this user.',
    },
  });
};