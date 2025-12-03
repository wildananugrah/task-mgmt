import logger from '../config/logger';
import config from '../config';
import { type RequestWithId, getRequestId, getElapsedTime } from './request-id';
import { verifyAccessToken } from '../utils/jwt';

interface LogMetadata {
  timestamp: string;
  requestId: string;
  userId?: string;
  method: string;
  uri: string;
  statusCode?: number;
  requestBody?: any;
  responseBody?: any;
  elapsedTime: number;
  userAgent?: string;
  ip?: string;
  error?: any;
}

/**
 * Sanitize sensitive data from logs
 */
function sanitizeData(data: any): any {
  if (!data) return data;

  // If logging sensitive data is disabled, remove sensitive fields
  if (!config.LOG_SENSITIVE_DATA) {
    const sensitiveFields = ['password', 'token', 'secret', 'authorization', 'cookie', 'creditCard', 'ssn'];

    if (typeof data === 'object') {
      const sanitized = { ...data };

      for (const field of sensitiveFields) {
        // Check various case variations
        const variations = [field, field.toUpperCase(), field.charAt(0).toUpperCase() + field.slice(1)];

        for (const variation of variations) {
          if (sanitized[variation]) {
            sanitized[variation] = '[REDACTED]';
          }
        }
      }

      // Recursively sanitize nested objects
      for (const key in sanitized) {
        if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
          sanitized[key] = sanitizeData(sanitized[key]);
        }
      }

      return sanitized;
    }
  }

  return data;
}

/**
 * Extract user ID from JWT token
 */
function getUserIdFromRequest(req: RequestWithId): string | undefined {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return undefined;
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    return payload?.userId;
  } catch {
    return undefined;
  }
}

/**
 * Parse request body safely
 */
async function parseRequestBody(req: RequestWithId): Promise<any> {
  try {
    const contentType = req.headers.get('content-type');

    if (!contentType) return undefined;

    // Clone the request to avoid consuming the body
    const clonedReq = req.clone();

    if (contentType.includes('application/json')) {
      return await clonedReq.json();
    } else if (contentType.includes('text/')) {
      return await clonedReq.text();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await clonedReq.text();
      const params = new URLSearchParams(text);
      const result: Record<string, string> = {};
      params.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }

    return undefined;
  } catch (error) {
    logger.debug('Failed to parse request body:', error);
    return undefined;
  }
}

/**
 * HTTP Request/Response logging middleware
 */
export async function httpLogger(
  req: RequestWithId,
  res: Response | null = null,
  error: any = null
): Promise<void> {
  try {
    const requestId = getRequestId(req);
    const userId = getUserIdFromRequest(req);
    const elapsedTime = getElapsedTime(req);
    const url = new URL(req.url);

    // Parse request body if enabled
    let requestBody: any;
    if (config.ENABLE_REQUEST_LOGGING && req.method !== 'GET' && req.method !== 'HEAD') {
      requestBody = await parseRequestBody(req);
    }

    // Parse response body if enabled
    let responseBody: any;
    let statusCode: number | undefined;

    if (res && config.ENABLE_RESPONSE_LOGGING) {
      statusCode = res.status;

      // Clone response to avoid consuming the body
      const clonedRes = res.clone();
      const contentType = clonedRes.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        try {
          responseBody = await clonedRes.json();
        } catch {
          // Response might not have a body
        }
      }
    }

    // Build log metadata
    const metadata: LogMetadata = {
      timestamp: new Date().toISOString(),
      requestId,
      userId,
      method: req.method,
      uri: url.pathname + url.search,
      statusCode,
      requestBody: sanitizeData(requestBody),
      responseBody: sanitizeData(responseBody),
      elapsedTime,
      userAgent: req.headers.get('user-agent') || undefined,
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      error: error ? {
        message: error.message,
        stack: config.NODE_ENV === 'development' ? error.stack : undefined,
        code: error.code,
      } : undefined,
    };

    // Determine log level based on status code
    let logLevel = 'info';
    if (statusCode) {
      if (statusCode >= 500) {
        logLevel = 'error';
      } else if (statusCode >= 400) {
        logLevel = 'warn';
      } else if (statusCode >= 300) {
        logLevel = 'http';
      }
    } else if (error) {
      logLevel = 'error';
    }

    // Log the request/response
    const message = `${req.method} ${url.pathname} ${statusCode || 'N/A'} ${elapsedTime}ms${userId ? ` [User: ${userId}]` : ''}`;

    switch (logLevel) {
      case 'error':
        logger.error(message, metadata);
        break;
      case 'warn':
        logger.warn(message, metadata);
        break;
      case 'http':
        logger.http(message, metadata);
        break;
      default:
        logger.info(message, metadata);
    }

    // Also log to console in development for easier debugging
    if (config.NODE_ENV === 'development') {
      console.log(`[${requestId}] ${message}`);
    }

  } catch (logError) {
    // Don't let logging errors break the application
    console.error('Logging error:', logError);
  }
}

/**
 * Create a logged response
 */
export async function createLoggedResponse(
  req: RequestWithId,
  body: any,
  init?: ResponseInit
): Promise<Response> {
  const response = new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': getRequestId(req),
        ...init?.headers,
      },
    }
  );

  // Log the response
  await httpLogger(req, response);

  return response;
}

/**
 * Log an error response
 */
export async function logErrorResponse(
  req: RequestWithId,
  error: any,
  statusCode: number = 500
): Promise<Response> {
  const response = new Response(
    JSON.stringify({
      error: error.message || 'Internal Server Error',
      requestId: getRequestId(req),
    }),
    {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': getRequestId(req),
      },
    }
  );

  // Log the error
  await httpLogger(req, response, error);

  return response;
}