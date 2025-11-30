import { User } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export type UserWithoutPassword = Omit<User, 'password'>;

export interface LoginResponse {
  user: UserWithoutPassword;
  accessToken: string;
  refreshToken: string;
}