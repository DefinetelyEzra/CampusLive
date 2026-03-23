import { Request, Response, NextFunction } from 'express';
import { requireRoleType } from './role.middleware.js';
import { RoleType } from '@prisma/client';
import { AuthenticatedUser } from '../types/index.js';

interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
}

// Middleware that allows FACULTY/ADMIN user roles OR MODERATOR app role
export const canManageEvents = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    // Check if user has FACULTY or ADMIN user role
    if (req.user?.role === 'FACULTY' || req.user?.role === 'ADMIN') {
        return next();
    }

    // Otherwise, require MODERATOR app role
    return requireRoleType([RoleType.MODERATOR])(req, res, next);
};