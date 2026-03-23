import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response.js';
import { AuthenticatedUser } from '../types/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return sendError(res, 'Access token required', undefined, 401);
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, secret) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Token verification failed';
    return sendError(res, 'Invalid or expired token', errorMessage, 403);
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Authentication required', undefined, 401);
    }

    if (!roles.includes(req.user.role)) {
      return sendError(res, 'Insufficient permissions', undefined, 403);
    }

    next();
  };
};

export const restrictAdminCreation = (req: Request, res: Response, next: NextFunction) => {
  const { role } = req.body;

  if (role === 'ADMIN' && (!req.user || req.user.role !== 'ADMIN')) {
    return sendError(res, 'Only admins can create admin users', undefined, 403);
  }

  next();
};

export const restrictAdminCreationForPublic = (req: Request, res: Response, next: NextFunction) => {
  const { role } = req.body;
  
  // If role is specified and it's ADMIN, reject the request
  if (role === 'ADMIN') {
    return sendError(res, 'Admin accounts cannot be created through public registration', undefined, 403);
  }
  
  // For public registration, force role to STUDENT if not specified
  if (!role) {
    req.body.role = 'STUDENT';
  }
  
  next();
};