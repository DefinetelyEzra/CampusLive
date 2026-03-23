import { ZodObject, ZodRawShape, ZodError } from "zod"; 
import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";

// Interface for formatted error response
interface FormattedError {
  field: string;
  message: string;
}

export const validateRequest = (
  schema: ZodObject<ZodRawShape>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      // Replace req.body with validated data to ensure type safety
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod errors into a more readable structure
        const errors: FormattedError[] = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }));

        logger.warn('Validation failed:', {
          path: req.path,
          errors
        });

        return sendError(
          res,
          'Validation failed',
          errors.map((e: FormattedError) => `${e.field}: ${e.message}`).join('; '),
          400
        );
      }

      logger.error('Unexpected validation error:', error);
      return sendError(res, "Validation failed", "Unknown validation error", 400);
    }
  };
};

// Optional validation middleware for query parameters
export const validateQuery = (
  schema: ZodObject<ZodRawShape>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: FormattedError[] = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }));

        logger.warn('Query validation failed:', {
          path: req.path,
          errors
        });

        return sendError(
          res,
          'Query validation failed',
          errors.map((e: FormattedError) => `${e.field}: ${e.message}`).join('; '),
          400
        );
      }

      logger.error('Unexpected query validation error:', error);
      return sendError(res, "Query validation failed", "Unknown validation error", 400);
    }
  };
};

// Validation middleware for URL parameters
export const validateParams = (
  schema: ZodObject<ZodRawShape>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: FormattedError[] = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }));

        logger.warn('Params validation failed:', {
          path: req.path,
          errors
        });

        return sendError(
          res,
          'URL parameter validation failed',
          errors.map((e: FormattedError) => `${e.field}: ${e.message}`).join('; '),
          400
        );
      }

      logger.error('Unexpected params validation error:', error);
      return sendError(res, "Params validation failed", "Unknown validation error", 400);
    }
  };
};