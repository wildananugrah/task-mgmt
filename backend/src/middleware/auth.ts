import { verifyAccessToken } from '../utils/jwt';
import type { AuthRequest } from '../types/auth';
import prisma from '../config/database';

export const authenticate = async (req: AuthRequest): Promise<void> => {
  const authHeader = req.headers.get('authorization');

  if (!authHeader) {
    throw new Error('No authorization header provided');
  }

  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    throw new Error('No token provided');
  }

  try {
    const payload = verifyAccessToken(token);

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    req.user = payload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

export const authorize = (roles: string[]) => {
  return (req: AuthRequest): void => {
    if (!req.user) {
      throw new Error('Not authenticated');
    }

    if (!roles.includes(req.user.role)) {
      throw new Error(`Insufficient permissions. Required roles: ${roles.join(', ')}`);
    }
  };
};