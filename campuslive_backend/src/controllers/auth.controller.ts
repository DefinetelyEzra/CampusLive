import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import prisma from '../config/database.js';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, username, password, role } = req.body;

      const result = await AuthService.register(email, username, password, role);

      logger.info(`User registered successfully: ${email}`);

      return sendSuccess(res, 'Registration successful! Welcome to CampusLive.', result, 201);
    } catch (error) {
      logger.error('Registration error:', error);

      if (error instanceof Error) {
        // Handle specific PAU email error
        if (error.message.includes('Pan-Atlantic University')) {
          return sendError(res, 'Invalid Email Domain', error.message, 400);
        }

        return sendError(res, 'Registration failed', error.message, 400);
      }

      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      const result = await AuthService.login(email, password);

      logger.info(`User logged in successfully: ${email}`);

      return sendSuccess(res, 'Login successful', result);
    } catch (error) {
      logger.error('Login error:', error);

      if (error instanceof Error) {
        return sendError(res, 'Login failed', error.message, 401);
      }

      next(error);
    }
  }

  static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, 'User not found', undefined, 404);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          createdAt: true,
        }
      });

      if (!user) {
        return sendError(res, 'User not found', undefined, 404);
      }

      return sendSuccess(res, 'Profile retrieved successfully', user);
    } catch (error) {
      logger.error('Get profile error:', error);
      next(error);
    }
  }

  static async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.id;

      if (!userId) {
        return sendError(res, 'User ID is required', undefined, 400);
      }

      if (req.user?.id === userId) {
        return sendError(res, 'Cannot delete own account', undefined, 403);
      }

      await AuthService.deleteUser(userId);

      logger.info(`User deleted successfully: ${userId}`);

      return sendSuccess(res, 'User deleted successfully', null, 204);
    } catch (error) {
      logger.error('Delete user error:', error);

      if (error instanceof Error) {
        return sendError(res, 'User deletion failed', error.message, 400);
      }

      next(error);
    }
  }
}