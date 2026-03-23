import { ParsedQs } from 'qs';

declare global {
  namespace Express {
    interface Request {
      sanitizedQuery?: ParsedQs | Record<string, any>;
      sanitizedParams?: Record<string, any>;
      cleanQuery?: Record<string, any>;
      cleanParams?: Record<string, any>;
      validatedQuery?: Record<string, any>;
      validatedParams?: Record<string, any>;
      userId?: string;
    }
  }
}

export {};