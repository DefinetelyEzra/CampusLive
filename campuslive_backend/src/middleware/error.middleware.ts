import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { sendError } from '../utils/response.js';
import { Prisma } from '@prisma/client';

// Helper function to handle Prisma-specific errors
const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError | Prisma.PrismaClientInitializationError, res: Response) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const errorMap: { [key: string]: { title: string; message: string; status: number } } = {
      'P2002': { title: 'Duplicate Entry', message: 'A record with this information already exists', status: 409 },
      'P2025': { title: 'Not Found', message: 'The requested record was not found', status: 404 },
      'P2003': { title: 'Invalid Reference', message: 'Referenced record does not exist', status: 400 },
    };
    const { title, message, status } = errorMap[error.code] || {
      title: 'Database Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'A database error occurred',
      status: 500,
    };
    return sendError(res, title, message, status);
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return sendError(res, 'Validation Error',
      process.env.NODE_ENV === 'development' ? error.message : 'Invalid data provided',
      400
    );
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    logger.error('Prisma initialization error - database connection failed');
    return sendError(res, 'Service Unavailable', 'Database connection failed', 503);
  }
};

// Helper function to handle standard errors
const handleStandardError = (error: Error, res: Response) => {
  const errorMap: { [key: string]: { title: string; message: string; status: number } } = {
    'ValidationError': { title: 'Validation Error', message: error.message, status: 400 },
    'UnauthorizedError': { title: 'Unauthorized', message: error.message, status: 401 },
    'JsonWebTokenError': { title: 'Invalid Token', message: 'Authentication token is invalid', status: 401 },
    'TokenExpiredError': { title: 'Token Expired', message: 'Authentication token has expired', status: 401 },
  };
  const { title, message, status } = errorMap[error.name] || {
    title: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    status: 500,
  };
  return sendError(res, title, message, status);
};

// Main error handler middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Unhandled error:', {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    path: req.path,
    method: req.method
  });

  if (error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientInitializationError) {
    return handlePrismaError(error, res);
  }

  return handleStandardError(error, res);
};

// Not found handler
export const notFoundHandler = (req: Request, res: Response) => {
  return sendError(res, 'Route not found', `Route ${req.originalUrl} not found`, 404);
};