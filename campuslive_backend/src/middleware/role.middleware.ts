import { Request, Response, NextFunction } from 'express';
import { RoleManagementService } from '../services/roleManagement.service.js';
import { GeolocationService } from '../services/geolocation.service.js';
import { RoleType } from '@prisma/client';
import { sendError } from '../utils/response.js';
import { AuthenticatedUser } from '../types/index.js';

interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
}

export const requireRoleType = (roles: RoleType[]) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id;

            if (!userId) {
                return sendError(res, 'Authentication required', undefined, 401);
            }

            const userRoles = await RoleManagementService.getUserActiveRoles(userId);
            const hasRequiredRole = userRoles.some(role => roles.includes(role.roleType));

            if (!hasRequiredRole) {
                return sendError(res, `Required role: ${roles.join(' or ')}`, undefined, 403);
            }

            next();
        } catch (error) {
            console.error('Role check error:', error);
            return sendError(res, 'Role verification failed', undefined, 500);
        }
    };
};

export const validateLocation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { eventId } = req.params;
        const { latitude, longitude } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return sendError(res, 'Authentication required', undefined, 401);
        }

        if (!latitude || !longitude) {
            return sendError(res, 'Location coordinates required', undefined, 400);
        }

        const validation = await GeolocationService.validateUserLocation(eventId, latitude, longitude);

        if (!validation.isWithinBounds) {
            return sendError(res,
                `You must be within ${validation.radiusMeters}m of the event location. Current distance: ${Math.round(validation.distance)}m`,
                undefined,
                403
            );
        }

        // Update user's last location check
        await GeolocationService.updateUserLocation(eventId, userId);

        next();
    } catch (error) {
        console.error('Location validation error:', error);
        return sendError(res, 'Location validation failed', undefined, 500);
    }
};