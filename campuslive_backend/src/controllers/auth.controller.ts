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
      if (!userId) return sendError(res, 'User not found', undefined, 404);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          createdAt: true,
        },
      });

      if (!user) return sendError(res, 'User not found', undefined, 404);

      return sendSuccess(res, 'Profile retrieved successfully', user);
    } catch (error) {
      logger.error('Get profile error:', error);
      next(error);
    }
  }

  static async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.id;
      if (!userId) return sendError(res, 'User ID is required', undefined, 400);
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

  // Password recovery handlers 
  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;

      if (!email || typeof email !== 'string') {
        return sendError(res, 'Validation failed', 'Email is required', 400);
      }

      // Fire-and-forget — we never reveal whether the email exists
      await AuthService.forgotPassword(email.trim().toLowerCase());

      logger.info(`Password reset requested for: ${email}`);

      return sendSuccess(
        res,
        'If that email is registered, a reset link has been sent.',
        null,
      );
    } catch (error) {
      logger.error('Forgot password error:', error);
      // Still return 200 to avoid leaking information
      return sendSuccess(
        res,
        'If that email is registered, a reset link has been sent.',
        null,
      );
    }
  }

  /**
   * POST /auth/reset-password
   * Body: { token: string; password: string }
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body;

      if (!token || typeof token !== 'string') {
        return sendError(res, 'Validation failed', 'Reset token is required', 400);
      }

      if (!password || typeof password !== 'string') {
        return sendError(res, 'Validation failed', 'New password is required', 400);
      }

      if (password.length < 8) {
        return sendError(
          res,
          'Validation failed',
          'Password must be at least 8 characters',
          400,
        );
      }

      await AuthService.resetPassword(token, password);

      logger.info('Password reset completed successfully');

      return sendSuccess(
        res,
        'Your password has been reset. You can now log in with your new password.',
        null,
      );
    } catch (error) {
      logger.error('Reset password error:', error);

      if (error instanceof Error) {
        return sendError(res, 'Password reset failed', error.message, 400);
      }

      next(error);
    }
  }
}