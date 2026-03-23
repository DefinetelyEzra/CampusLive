import { Request, Response, NextFunction } from 'express';
import { RoleManagementService } from '../services/roleManagement.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { RoleType } from '@prisma/client';
import { AuthenticatedUser } from '../types/index.js';

interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
}

export class RoleController {
    static async generateModeratorTokens(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const adminUserId = req.user?.id;
            const { count = 1 } = req.body;

            if (!adminUserId) {
                return sendError(res, 'Authentication required', undefined, 401);
            }

            if (count > 10) {
                return sendError(res, 'Maximum 10 tokens can be generated at once', undefined, 400);
            }

            const tokens = await RoleManagementService.generateModeratorToken(adminUserId, count);

            logger.info(`Generated ${tokens.length} moderator tokens by admin ${adminUserId}`);
            return sendSuccess(res, 'Moderator tokens generated successfully', tokens);
        } catch (error) {
            logger.error('Generate moderator tokens error:', error);
            next(error);
        }
    }

    static async registerRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            const { roleType, token } = req.body;

            if (!userId) {
                return sendError(res, 'Authentication required', undefined, 401);
            }

            if (!Object.values(RoleType).includes(roleType)) {
                return sendError(res, 'Invalid role type', undefined, 400);
            }

            const userRole = await RoleManagementService.registerUserRole(userId, roleType, token);

            logger.info(`User ${userId} registered for role ${roleType}`);
            return sendSuccess(res, `Successfully registered as ${roleType}`, userRole);
        } catch (error) {
            logger.error('Register role error:', error);

            if (error instanceof Error) {
                return sendError(res, 'Role registration failed', error.message, 400);
            }

            next(error);
        }
    }

    static async getCurrentRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;

            if (!userId) {
                return sendError(res, 'Authentication required', undefined, 401);
            }

            const currentRole = await RoleManagementService.getCurrentAppRole(userId);

            // Ensure we always return an object, even if currentRole is null
            return sendSuccess(res, 'Current role retrieved successfully', currentRole || null);
        } catch (error) {
            logger.error('Get current role error:', error);
            return sendError(res, 'Failed to retrieve current role', error instanceof Error ? error.message : undefined, 500);
        }
    }

    static async deregisterRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            const { roleType } = req.body;

            if (!userId) {
                return sendError(res, 'Authentication required', undefined, 401);
            }

            if (!Object.values(RoleType).includes(roleType)) {
                return sendError(res, 'Invalid role type', undefined, 400);
            }

            await RoleManagementService.deregisterFromRole(userId, roleType);

            logger.info(`User ${userId} deregistered from role ${roleType}`);
            return sendSuccess(res, `Successfully deregistered from ${roleType}`);
        } catch (error) {
            logger.error('Deregister role error:', error);

            if (error instanceof Error) {
                return sendError(res, 'Role deregistration failed', error.message, 400);
            }

            next(error);
        }
    }

    static async getMyRoles(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;

            if (!userId) {
                return sendError(res, 'Authentication required', undefined, 401);
            }

            const roles = await RoleManagementService.getUserActiveRoles(userId);

            // Ensure we always return an array
            return sendSuccess(res, 'User roles retrieved successfully', roles || []);
        } catch (error) {
            logger.error('Get user roles error:', error);
            return sendError(res, 'Failed to retrieve user roles', error instanceof Error ? error.message : undefined, 500);
        }
    }
}