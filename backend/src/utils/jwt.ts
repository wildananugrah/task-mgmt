import jwt from 'jsonwebtoken';
import config from '../config';
import type { JwtPayload } from '../types/auth';

export const generateAccessToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRE_TIME,
  });
};

export const generateRefreshToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRE_TIME,
  });
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as JwtPayload;
};

export const decodeToken = (token: string): JwtPayload | null => {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
};