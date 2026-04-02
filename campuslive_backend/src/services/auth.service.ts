import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import prisma from '../config/database.js';
import { EmailService } from './email.service.js';
import { AuthenticatedUser } from '../types/index.js';

export class AuthService {
  static async register(
    email: string,
    username: string,
    password: string,
    role?: string,
  ) {
    if (!this.isValidPAUEmail(email)) {
      throw new Error(
        'Registration is restricted to Pan-Atlantic University students. Please use your PAU email (@pau.edu.ng)',
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      throw new Error('User with this email or username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role: role ? (role as any) : 'STUDENT',
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    const token = this.generateToken(user);
    return { user, token };
  }

  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) throw new Error('Invalid credentials');

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) throw new Error('Invalid credentials');

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      token,
    };
  }

  static async deleteUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    await prisma.user.delete({ where: { id: userId } });
    return true;
  }

  // Password recovery

  /**
   * Initiate a password reset.
   *
   * - Always resolves (never reveals whether the email exists).
   * - Deletes any previous unused tokens for the same user first.
   * - Generates a cryptographically secure 32-byte token, stores its
   *   SHA-256 hash in the DB, and e-mails the raw token to the user.
   * - Token is valid for 1 hour.
   */
  static async forgotPassword(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });

    // Silent return — never reveal whether the email is registered
    if (!user) return;

    // Remove any existing (unused) reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    // Generate raw token → hash → store hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        token: hashedToken,
        userId: user.id,
        expiresAt,
      },
    });

    const frontendUrl =
      process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    await EmailService.sendPasswordResetEmail(
      user.email,
      user.username,
      resetUrl,
    );
  }

  /**
   * Complete a password reset.
   *
   * @param rawToken   The plain token from the URL query param
   * @param newPassword  The new plaintext password chosen by the user
   *
   * Throws a descriptive error on any invalid state so the controller
   * can surface the right message to the frontend.
   */
  static async resetPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<void> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: hashedToken },
    });

    if (!resetToken) {
      throw new Error('This reset link is invalid. Please request a new one.');
    }

    if (resetToken.usedAt) {
      throw new Error(
        'This reset link has already been used. Please request a new one.',
      );
    }

    if (resetToken.expiresAt < new Date()) {
      throw new Error(
        'This reset link has expired. Please request a new one.',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Atomically update password and mark token as consumed
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  // Private helpers

  private static isValidPAUEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@pau\.edu\.ng$/;
    return emailRegex.test(email);
  }

  private static generateToken(user: any): string {
    const payload: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const options: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN as any) ?? '7d',
    };

    return jwt.sign(payload, secret as Secret, options);
  }
}