import { RequestContext, generateRequestId } from '../utils/activity-logger';

/**
 * Extended request type with request context
 */
export interface RequestWithContext extends Request {
  requestContext?: RequestContext;
  requestId?: string;
}

/**
 * Middleware to add request tracking context to each request
 * This adds a unique requestId and timing information
 */
export const requestTrackingMiddleware = (req: Request): RequestWithContext => {
  const extendedReq = req as RequestWithContext;

  // Generate or extract request ID from headers
  const requestId = req.headers.get('x-request-id') || generateRequestId();

  // Create request context for timing and correlation
  extendedReq.requestContext = new RequestContext(requestId);
  extendedReq.requestId = requestId;

  return extendedReq;
};

/**
 * Get request context from request object
 */
export const getRequestContext = (req: Request): RequestContext | undefined => {
  return (req as RequestWithContext).requestContext;
};

/**
 * Get request ID from request object
 */
export const getRequestId = (req: Request): string | undefined => {
  return (req as RequestWithContext).requestId;
};
