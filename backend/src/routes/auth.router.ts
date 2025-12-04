import { z } from 'zod';
import bcrypt from 'bcrypt';
import prisma from '../config/database';
import config from '../config';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import { handleError } from '../middleware/error-handler';
import type { UserWithoutPassword, LoginResponse } from '../types/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export class AuthRouter {
  async login(req: Request): Promise<Response> {
    try {
      const body = await req.json();
      const { email, password } = loginSchema.parse(body);

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Invalid email or password' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Check if user is active
      if (!user.isActive) {
        return new Response(
          JSON.stringify({ error: 'Account is disabled' }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return new Response(
          JSON.stringify({ error: 'Invalid email or password' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Generate tokens
      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entity: 'User',
          entityId: user.id,
          ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
        },
      });

      // Prepare response
      const { password: _, ...userWithoutPassword } = user;

      const response: LoginResponse = {
        user: userWithoutPassword,
        accessToken,
        refreshToken,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return handleError(error);
    }
  }

  async register(req: Request): Promise<Response> {
    try {
      const body = await req.json();
      const data = registerSchema.parse(body);

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: 'Email already registered' }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, config.BCRYPT_SALT_ROUNDS);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          role: 'USER',
        },
      });

      // Generate tokens
      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'REGISTER',
          entity: 'User',
          entityId: user.id,
          ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
        },
      });

      // Prepare response
      const { password: _, ...userWithoutPassword } = user;

      const response: LoginResponse = {
        user: userWithoutPassword,
        accessToken,
        refreshToken,
      };

      return new Response(JSON.stringify(response), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return handleError(error);
    }
  }

  async refreshToken(req: Request): Promise<Response> {
    try {
      const body = await req.json();
      const { refreshToken } = refreshTokenSchema.parse(body);

      // Verify refresh token (this validates signature and expiration)
      const payload = verifyRefreshToken(refreshToken);

      // Fetch user from database to check if still active
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Check if user is still active
      if (!user.isActive) {
        return new Response(
          JSON.stringify({ error: 'Account is disabled' }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Generate new tokens (token rotation for better security)
      const newPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = generateAccessToken(newPayload);
      const newRefreshToken = generateRefreshToken(newPayload);

      return new Response(
        JSON.stringify({ accessToken, refreshToken: newRefreshToken }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      return handleError(error);
    }
  }

  async logout(req: Request): Promise<Response> {
    try {
      // In stateless authentication, logout is handled client-side
      // by clearing tokens from localStorage
      // No server-side state to clean up

      return new Response(
        JSON.stringify({ message: 'Logged out successfully' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      return handleError(error);
    }
  }

  async getCurrentUser(req: Request): Promise<Response> {
    try {
      // Get the authorization header
      const authHeader = req.headers.get('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Extract the token
      const token = authHeader.substring(7);

      // Verify the token and get userId
      const { verifyAccessToken } = await import('../utils/jwt');
      const payload = verifyAccessToken(token);

      if (!payload || !payload.userId) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      if (!user || !user.isActive) {
        return new Response(
          JSON.stringify({ error: 'User not found or inactive' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(JSON.stringify(user), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return handleError(error);
    }
  }

  async handle(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      return this.login(req);
    }

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      return this.register(req);
    }

    if (pathname === '/api/auth/refresh' && req.method === 'POST') {
      return this.refreshToken(req);
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      return this.logout(req);
    }

    if (pathname === '/api/auth/me' && req.method === 'GET') {
      return this.getCurrentUser(req);
    }

    return null;
  }
}

export const authRouter = new AuthRouter();