import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { AuthenticatedUser } from '../types/index.js';
import { RoleType } from '@prisma/client';

interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
}

export class AdminController {
    static async getAllUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const users = await prisma.user.findMany({
                select: {
                    id: true,
                    username: true,
                    email: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true,
                    _count: {
                        select: {
                            organizedEvents: true,
                            posts: true,
                            participants: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            const usersWithStats = users.map(user => ({
                ...user,
                stats: {
                    eventsOrganized: user._count.organizedEvents,
                    postsCreated: user._count.posts,
                    eventsAttended: user._count.participants
                },
                _count: undefined
            }));

            logger.info(`Admin ${req.user!.id} retrieved all users list`);
            return sendSuccess(res, 'Users retrieved successfully', usersWithStats);
        } catch (error) {
            logger.error('Get all users error:', error);
            next(error);
        }
    }

    static async getAllModeratorTokens(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const tokens = await prisma.moderatorToken.findMany({
                include: {
                    createdBy: {
                        select: { username: true, email: true }
                    },
                    usedByUser: {
                        select: { username: true, email: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            logger.info(`Admin ${req.user!.id} retrieved all moderator tokens`);
            return sendSuccess(res, 'Moderator tokens retrieved successfully', tokens);
        } catch (error) {
            logger.error('Get moderator tokens error:', error);
            next(error);
        }
    }

    static async getActiveModerators(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const activeModerators = await prisma.userAppRole.findMany({
                where: {
                    roleType: RoleType.MODERATOR,
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gt: new Date() } }
                    ]
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    moderatorToken: {
                        select: {
                            token: true,
                            expiresAt: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            logger.info(`Admin ${req.user!.id} retrieved active moderators list`);
            return sendSuccess(res, 'Active moderators retrieved successfully', activeModerators);
        } catch (error) {
            logger.error('Get active moderators error:', error);
            next(error);
        }
    }

    static async getSystemStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const [
                totalUsers,
                totalEvents,
                liveEvents,
                totalPosts,
                activeModerators,
                totalTokens,
                usedTokens,
                expiredTokens
            ] = await Promise.all([
                prisma.user.count(),
                prisma.event.count(),
                prisma.event.count({ where: { isLive: true, status: 'LIVE' } }),
                prisma.post.count(),
                prisma.userAppRole.count({
                    where: {
                        roleType: RoleType.MODERATOR,
                        OR: [
                            { expiresAt: null },
                            { expiresAt: { gt: new Date() } }
                        ]
                    }
                }),
                prisma.moderatorToken.count(),
                prisma.moderatorToken.count({ where: { isUsed: true } }),
                prisma.moderatorToken.count({ where: { expiresAt: { lt: new Date() } } })
            ]);

            const stats = {
                users: {
                    total: totalUsers,
                    admins: await prisma.user.count({ where: { role: 'ADMIN' } }),
                    faculty: await prisma.user.count({ where: { role: 'FACULTY' } }),
                    students: await prisma.user.count({ where: { role: 'STUDENT' } })
                },
                events: {
                    total: totalEvents,
                    live: liveEvents,
                    upcoming: await prisma.event.count({ where: { status: 'UPCOMING' } }),
                    ended: await prisma.event.count({ where: { status: 'ENDED' } })
                },
                moderators: {
                    active: activeModerators,
                    tokens: {
                        total: totalTokens,
                        used: usedTokens,
                        available: totalTokens - usedTokens - expiredTokens,
                        expired: expiredTokens
                    }
                },
                content: {
                    totalPosts: totalPosts,
                    postsToday: await prisma.post.count({
                        where: {
                            createdAt: {
                                gte: new Date(new Date().setHours(0, 0, 0, 0))
                            }
                        }
                    })
                }
            };

            logger.info(`Admin ${req.user!.id} retrieved system statistics`);
            return sendSuccess(res, 'System statistics retrieved successfully', stats);
        } catch (error) {
            logger.error('Get system stats error:', error);
            next(error);
        }
    }

    static async getUserActivity(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;

            const userActivity = await prisma.user.findUnique({
                where: { id: userId },
                include: {
                    organizedEvents: {
                        select: {
                            id: true,
                            title: true,
                            startTime: true,
                            status: true,
                            _count: { select: { participants: true } }
                        },
                        orderBy: { startTime: 'desc' },
                        take: 10
                    },
                    participants: {
                        select: {
                            joinedAt: true,
                            leftAt: true,
                            role: true,
                            event: {
                                select: {
                                    id: true,
                                    title: true,
                                    startTime: true
                                }
                            }
                        },
                        orderBy: { joinedAt: 'desc' },
                        take: 10
                    },
                    posts: {
                        select: {
                            id: true,
                            content: true,
                            createdAt: true,
                            mediaType: true,
                            event: {
                                select: {
                                    title: true
                                }
                            },
                            location: {
                                select: {
                                    name: true
                                }
                            }
                        },
                        orderBy: { createdAt: 'desc' },
                        take: 10
                    },
                    userRoles: {
                        select: {
                            roleType: true,
                            createdAt: true,
                            expiresAt: true,
                            moderatorToken: {
                                select: {
                                    token: true
                                }
                            }
                        },
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });

            if (!userActivity) {
                return sendError(res, 'User not found', undefined, 404);
            }

            logger.info(`Admin ${req.user!.id} retrieved activity for user ${userId}`);
            return sendSuccess(res, 'User activity retrieved successfully', userActivity);
        } catch (error) {
            logger.error('Get user activity error:', error);
            next(error);
        }
    }

    static async deleteModeratorToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const { tokenId } = req.params;

            const token = await prisma.moderatorToken.findUnique({
                where: { id: tokenId },
                include: {
                    usedByUser: { select: { username: true } }
                }
            });

            if (!token) {
                return sendError(res, 'Token not found', undefined, 404);
            }

            if (token.isUsed) {
                return sendError(res, 'Cannot delete a token that has been used', undefined, 400);
            }

            await prisma.moderatorToken.delete({
                where: { id: tokenId }
            });

            logger.info(`Admin ${req.user!.id} deleted moderator token ${token.token}`);
            return sendSuccess(res, 'Moderator token deleted successfully');
        } catch (error) {
            logger.error('Delete moderator token error:', error);
            next(error);
        }
    }

    static async revokeUserRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const { userId, roleType } = req.params;

            if (!Object.values(RoleType).includes(roleType as RoleType)) {
                return sendError(res, 'Invalid role type', undefined, 400);
            }

            const userRole = await prisma.userAppRole.findFirst({
                where: {
                    userId,
                    roleType: roleType as RoleType
                },
                include: {
                    user: { select: { username: true } }
                }
            });

            if (!userRole) {
                return sendError(res, 'User role not found', undefined, 404);
            }

            await prisma.userAppRole.delete({
                where: { id: userRole.id }
            });

            logger.info(`Admin ${req.user!.id} revoked ${roleType} role from user ${userRole.user.username}`);
            return sendSuccess(res, `${roleType} role revoked successfully`);
        } catch (error) {
            logger.error('Revoke user role error:', error);
            next(error);
        }
    }

    static async getEventAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const { eventId } = req.params;

            const eventAnalytics = await prisma.event.findUnique({
                where: { id: eventId },
                include: {
                    organizer: { select: { username: true, email: true } },
                    location: { select: { name: true, latitude: true, longitude: true } },
                    participants: {
                        include: {
                            user: { select: { username: true, email: true } }
                        },
                        orderBy: { joinedAt: 'desc' }
                    },
                    posts: {
                        include: {
                            user: { select: { username: true } }
                        },
                        orderBy: { createdAt: 'desc' }
                    },
                    _count: {
                        select: {
                            participants: true,
                            posts: true
                        }
                    }
                }
            });

            if (!eventAnalytics) {
                return sendError(res, 'Event not found', undefined, 404);
            }

            const analytics = {
                ...eventAnalytics,
                analytics: {
                    totalParticipants: eventAnalytics._count.participants,
                    currentParticipants: eventAnalytics.participants.filter(p => p.isActive).length,
                    totalPosts: eventAnalytics._count.posts,
                    participantsByRole: {
                        moderators: eventAnalytics.participants.filter(p => p.role === 'MODERATOR').length,
                        posters: eventAnalytics.participants.filter(p => p.role === 'POSTER').length,
                        watchers: eventAnalytics.participants.filter(p => p.role === 'WATCHER').length
                    },
                    averageAttendanceDuration: eventAnalytics.participants
                        .filter(p => p.leftAt)
                        .reduce((acc, p) => {
                            const duration = new Date(p.leftAt!).getTime() - new Date(p.joinedAt).getTime();
                            return acc + duration;
                        }, 0) / eventAnalytics.participants.filter(p => p.leftAt).length || 0
                }
            };

            logger.info(`Admin ${req.user!.id} retrieved analytics for event ${eventId}`);
            return sendSuccess(res, 'Event analytics retrieved successfully', analytics);
        } catch (error) {
            logger.error('Get event analytics error:', error);
            next(error);
        }
    }
}

// Apply authentication and admin role middleware
export const AdminControllerWithAuth = {
    getAllUsers: AdminController.getAllUsers,
    getAllModeratorTokens: AdminController.getAllModeratorTokens,
    getActiveModerators: AdminController.getActiveModerators,
    getSystemStats: AdminController.getSystemStats,
    getUserActivity: AdminController.getUserActivity,
    deleteModeratorToken: AdminController.deleteModeratorToken,
    revokeUserRole: AdminController.revokeUserRole,
    getEventAnalytics: AdminController.getEventAnalytics
};