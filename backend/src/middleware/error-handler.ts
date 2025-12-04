import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const handleError = (error: unknown): Response => {
  console.error('Error:', error);

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return new Response(
      JSON.stringify({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Handle wrapped Zod errors (Error with ZodError message)
  if (error instanceof Error && error.message.includes('ZodError')) {
    try {
      // Try to extract the error details from the message
      const match = error.message.match(/ZodError: (\[.*\])/s);
      if (match) {
        const details = JSON.parse(match[1] || "{}");
        return new Response(
          JSON.stringify({
            error: 'Validation Error',
            message: 'Invalid input data',
            details: details.map((e: any) => ({
              field: e.path?.join('.') || 'unknown',
              message: e.message,
            })),
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    } catch (parseError) {
      console.error('Failed to parse ZodError message:', parseError);
    }
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[]) || [];
      return new Response(
        JSON.stringify({
          error: 'Duplicate Entry',
          message: `A record with this ${target.join(', ')} already exists`,
          code: error.code,
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (error.code === 'P2025') {
      return new Response(
        JSON.stringify({
          error: 'Not Found',
          message: 'The requested record was not found',
          code: error.code,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (error.code === 'P2003') {
      return new Response(
        JSON.stringify({
          error: 'Foreign Key Constraint',
          message: 'Invalid reference to related record',
          code: error.code,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // Handle custom app errors
  if (error instanceof AppError) {
    return new Response(
      JSON.stringify({
        error: error.message,
        code: error.code,
        details: error.details,
      }),
      {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Handle JWT errors
  if (error instanceof Error) {
    if (error.name === 'JsonWebTokenError') {
      return new Response(
        JSON.stringify({
          error: 'Invalid Token',
          message: 'The provided token is invalid',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (error.name === 'TokenExpiredError') {
      return new Response(
        JSON.stringify({
          error: 'Token Expired',
          message: 'The provided token has expired',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // Handle generic errors
  if (error instanceof Error) {
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error.message || 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Fallback for unknown errors
  return new Response(
    JSON.stringify({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

export const asyncHandler = (fn: Function) => {
  return async (req: Request, ...args: any[]) => {
    try {
      return await fn(req, ...args);
    } catch (error) {
      return handleError(error);
    }
  };
};