import { v4 as uuidv4 } from 'uuid';

export interface RequestWithId extends Request {
  id?: string;
  startTime?: number;
}

/**
 * Middleware to add a unique request ID to each request
 * This helps with tracing requests through logs
 */
export function requestIdMiddleware(req: RequestWithId): void {
  // Generate unique request ID
  req.id = uuidv4();

  // Track request start time for elapsed time calculation
  req.startTime = Date.now();
}

/**
 * Get request ID from various sources
 */
export function getRequestId(req: RequestWithId): string {
  return req.id || req.headers.get('x-request-id') || uuidv4();
}

/**
 * Calculate elapsed time for a request
 */
export function getElapsedTime(req: RequestWithId): number {
  if (!req.startTime) return 0;
  return Date.now() - req.startTime;
}