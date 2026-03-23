import prisma from '../config/database.js';
import { RoleType, UserAppRole } from '@prisma/client';
import crypto from 'node:crypto';
import { logger } from '../utils/logger.js';

export class RoleManagementService {
    static async generateModeratorToken(adminUserId: string, count: number = 1) {
        const tokens = [];
        for (let i = 0; i < count; i++) {
            const token = 'MOD' + crypto.randomBytes(3).toString('hex').toUpperCase();
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

            const moderatorToken = await prisma.moderatorToken.create({
                data: {
                    token,
                    createdById: adminUserId,
                    expiresAt
                }
            });
            tokens.push(moderatorToken);
        }
        return tokens;
    }

    static async validateModeratorToken(token: string, userId: string) {
        const normalizedToken = token.toUpperCase().trim();

        console.log('Looking for token:', normalizedToken);

        const moderatorToken = await prisma.moderatorToken.findUnique({
            where: { token: normalizedToken }
        });

        console.log('Found token:', moderatorToken);

        if (!moderatorToken) {
            throw new Error('Invalid moderator token');
        }

        // Check if token has expired
        if (moderatorToken.expiresAt < new Date()) {
            throw new Error('This moderator token has expired');
        }

        // Check if token is used by a different user
        if (moderatorToken.isUsed && moderatorToken.usedByUserId && moderatorToken.usedByUserId !== userId) {
            throw new Error('This token has already been used by another user');
        }

        return moderatorToken;
    }

    static async getCurrentAppRole(userId: string): Promise<UserAppRole | null> {
        try {
            const role = await prisma.userAppRole.findFirst({
                where: {
                    userId,
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gt: new Date() } }
                    ]
                },
                include: {
                    moderatorToken: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            return role;
        } catch (error) {
            logger.error(`Error fetching current app role for user ${userId}:`, error);
            throw new Error('Failed to fetch current role');
        }
    }

    static async registerUserRole(userId: string, roleType: RoleType, token?: string) {
        // Check if user already has any active role (not just the same role type)
        const existingActiveRole = await prisma.userAppRole.findFirst({
            where: {
                userId,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ]
            }
        });

        if (existingActiveRole) {
            throw new Error(`You must deregister from your current ${existingActiveRole.roleType} role before registering for a new role`);
        }

        if (roleType === RoleType.MODERATOR) {
            if (!token) {
                throw new Error('Moderator token required');
            }

            const normalizedToken = token.toUpperCase().trim();
            const moderatorToken = await this.validateModeratorToken(normalizedToken, userId);

            // CRITICAL FIX: Clear any previous token assignments for this user
            const previousTokens = await prisma.moderatorToken.findMany({
                where: {
                    usedByUserId: userId,
                    NOT: {
                        token: normalizedToken // Don't clear the token they're trying to use
                    }
                }
            });

            // Clear the usedByUserId for all previous tokens
            if (previousTokens.length > 0) {
                await prisma.moderatorToken.updateMany({
                    where: {
                        id: { in: previousTokens.map(t => t.id) }
                    },
                    data: {
                        usedByUserId: null,
                        isUsed: false
                    }
                });

                logger.info(`Cleared ${previousTokens.length} previous token assignment(s) for user ${userId}`);
            }

            // Now check if this specific token is already used by this user
            const existingTokenUsage = await prisma.moderatorToken.findFirst({
                where: {
                    token: normalizedToken,
                    usedByUserId: userId
                }
            });

            // Only update if not already marked as used by this user
            if (!existingTokenUsage) {
                await prisma.moderatorToken.update({
                    where: { token: normalizedToken },
                    data: {
                        isUsed: true,
                        usedByUserId: userId
                    }
                });
            }

            return await prisma.userAppRole.create({
                data: {
                    userId,
                    roleType,
                    moderatorTokenId: moderatorToken.id,
                    expiresAt: moderatorToken.expiresAt
                }
            });
        }

        // For POSTER and WATCHER roles
        return await prisma.userAppRole.create({
            data: {
                userId,
                roleType
            }
        });
    }

    static async deregisterFromRole(userId: string, roleType: RoleType): Promise<void> {
        // Check if user is currently in an active event as moderator
        const activeParticipation = await prisma.eventParticipant.findFirst({
            where: {
                userId,
                isActive: true,
                role: 'MODERATOR'
            },
            include: {
                event: true
            }
        });

        if (activeParticipation && activeParticipation.event.isLive) {
            throw new Error('Cannot deregister while moderating a live event');
        }

        // Remove the role
        await prisma.userAppRole.delete({
            where: {
                userId_roleType: {
                    userId,
                    roleType
                }
            }
        });
    }

    static async getUserActiveRoles(userId: string) {
        try {
            const roles = await prisma.userAppRole.findMany({
                where: {
                    userId,
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gt: new Date() } }
                    ]
                },
                include: {
                    moderatorToken: true
                }
            });

            return roles;
        } catch (error) {
            logger.error(`Error fetching active roles for user ${userId}:`, error);
            throw new Error('Failed to fetch user roles');
        }
    }

    static async getUserActiveRoleByType(userId: string, roleType: RoleType): Promise<UserAppRole | null> {
        return await prisma.userAppRole.findFirst({
            where: {
                userId,
                roleType,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ]
            },
            include: {
                moderatorToken: true
            }
        });
    }

    static async cleanupExpiredTokenAssignments() {
        // Find all expired user roles that used moderator tokens
        const expiredRoles = await prisma.userAppRole.findMany({
            where: {
                roleType: 'MODERATOR',
                expiresAt: {
                    lt: new Date()
                },
                moderatorTokenId: {
                    not: null
                }
            },
            include: {
                moderatorToken: true
            }
        });

        // Clear the usedByUserId for these expired tokens so they can be reassigned
        for (const role of expiredRoles) {
            if (role.moderatorToken && role.moderatorToken.usedByUserId === role.userId) {
                await prisma.moderatorToken.update({
                    where: { id: role.moderatorTokenId! },
                    data: {
                        isUsed: false,
                        usedByUserId: null
                    }
                });
            }
        }
    }

    static async cleanupExpiredRoles() {
        // Clean up expired roles
        await prisma.userAppRole.deleteMany({
            where: {
                expiresAt: {
                    lt: new Date()
                }
            }
        });

        // Also cleanup expired token assignments
        await this.cleanupExpiredTokenAssignments();
    }
}