import bcrypt from "bcryptjs";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import prisma from "../config/database.js";
import { AuthenticatedUser } from "../types/index.js";

export class AuthService {
  static async register(email: string, username: string, password: string, role?: string) {

    if (!this.isValidPAUEmail(email)) {
      throw new Error("Registration is restricted to Pan-Atlantic University students. Please use your PAU email (@pau.edu.ng)");
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      throw new Error("User with this email or username already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role: role ? role as any : 'STUDENT',
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
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

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
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return true;
  }

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
      throw new Error("JWT_SECRET is not defined in environment variables");
    }

    const options: SignOptions = {
      expiresIn: process.env.JWT_EXPIRES_IN as any || "7d",
    };

    return jwt.sign(payload, secret as Secret, options);
  }
}