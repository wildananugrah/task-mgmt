import { registerAllModels } from './models/configurations';
import { ApiRouter } from './routes/api.router';
import { authRouter } from './routes/auth.router';
import { docsRouter } from './routes/docs.router';
import { filesRouter } from './routes/files.router';
import { handleError } from './middleware/error-handler';
import config from './config';
import prisma from './config/database';
import logger from './config/logger';
import { type RequestWithId, requestIdMiddleware } from './middleware/request-id';
import { httpLogger, createLoggedResponse, logErrorResponse } from './middleware/http-logger';
import { metricsRouter, metricsCollector } from './routes/metrics.router';
import { getElapsedTime } from './middleware/request-id';
import { initializeStorage } from './config/minio';
import cors from 'cors';
import type { AuthRequest } from './types/auth';

// Register all model configurations FIRST
registerAllModels();

// Then create the API router after models are registered
const apiRouter = new ApiRouter();

// Main server handler
const server = Bun.serve({
  port: config.PORT,
  async fetch(req: Request) {
    // Cast to RequestWithId and add request ID
    const requestWithId = req as RequestWithId;
    requestIdMiddleware(requestWithId);

    const url = new URL(req.url);
    const pathname = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': config.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    };

    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // Health check endpoint
      if (pathname === '/health' || pathname === '/api/health') {
        const dbHealth = await prisma.$queryRaw`SELECT 1 as health`;
        const response = await createLoggedResponse(
          requestWithId,
          {
            status: 'healthy',
            database: dbHealth ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString(),
          },
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
        return response;
      }

      // Metrics endpoint for Prometheus
      if (pathname === '/metrics') {
        const response = await metricsRouter.handle(requestWithId);
        if (response) {
          return response;
        }
      }

      // API documentation routes
      if (pathname.startsWith('/api/docs')) {
        const response = await docsRouter.handle(req);
        if (response) {
          // Add CORS headers to response
          Object.entries(corsHeaders).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
          // Log documentation access
          await httpLogger(requestWithId, response);
          return response;
        }
      }

      // API info endpoint
      if (pathname === '/api' || pathname === '/api/') {
        const routes = apiRouter.getRoutes();
        const endpoints: any = {
          auth: [
            'POST /api/auth/login',
            'POST /api/auth/register',
            'POST /api/auth/refresh',
            'POST /api/auth/logout',
            'GET /api/auth/me',
          ],
          rest: routes,
        };

        // Only include file routes if storage is enabled
        if (config.ENABLE_FILE_STORAGE) {
          endpoints.files = filesRouter.getRoutes();
        }

        return new Response(
          JSON.stringify({
            message: 'Auto-Generated API Server',
            version: '1.0.0',
            fileStorageEnabled: config.ENABLE_FILE_STORAGE,
            storageProvider: config.ENABLE_FILE_STORAGE ? config.STORAGE_PROVIDER : null,
            documentation: {
              interactive: 'http://localhost:3000/api/docs',
              swagger: 'http://localhost:3000/api/docs/swagger',
              openapi: 'http://localhost:3000/api/docs/openapi.json',
              postman: 'http://localhost:3000/api/docs/postman.json',
              markdown: 'http://localhost:3000/api/docs/markdown',
            },
            endpoints,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Authentication routes
      if (pathname.startsWith('/api/auth')) {
        const response = await authRouter.handle(req);
        if (response) {
          // Add CORS headers to response
          Object.entries(corsHeaders).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
          // Log auth requests
          await httpLogger(requestWithId, response);
          // Record metrics
          metricsCollector.recordRequest(req.method, pathname, response.status, getElapsedTime(requestWithId));
          return response;
        }
      }

      // File routes (only if file storage is enabled)
      if (config.ENABLE_FILE_STORAGE && pathname.startsWith('/api/files')) {
        const response = await filesRouter.handle(req);
        if (response) {
          // Add CORS headers to response
          Object.entries(corsHeaders).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
          // Log file requests
          await httpLogger(requestWithId, response);
          // Record metrics
          metricsCollector.recordRequest(req.method, pathname, response.status, getElapsedTime(requestWithId));
          return response;
        }
      }

      // REST API routes
      if (pathname.startsWith('/api/')) {
        const response = await apiRouter.handle(req as AuthRequest);
        if (response) {
          // Add CORS headers to response
          Object.entries(corsHeaders).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
          // Log API requests
          await httpLogger(requestWithId, response);
          // Record metrics
          metricsCollector.recordRequest(req.method, pathname, response.status, getElapsedTime(requestWithId));
          return response;
        }
      }

      // 404 for unmatched routes
      const notFoundResponse = await createLoggedResponse(
        requestWithId,
        {
          error: 'Not Found',
          message: `Route ${pathname} not found`,
        },
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
      metricsCollector.recordRequest(req.method, pathname, 404, getElapsedTime(requestWithId));
      return notFoundResponse;
    } catch (error) {
      logger.error('Server error:', error);
      const errorResponse = await logErrorResponse(requestWithId, error);
      // Add CORS headers to error response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      metricsCollector.recordRequest(req.method, pathname, errorResponse.status, getElapsedTime(requestWithId));
      return errorResponse;
    }
  },
});

// Initialize database and start servers
const initialize = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    logger.info('Database connected successfully');

    // Initialize Storage (if enabled)
    if (config.ENABLE_FILE_STORAGE) {
      await initializeStorage();
      console.log(`✅ Storage initialized (${config?.STORAGE_PROVIDER?.toUpperCase()})`);
      logger.info(`Storage initialized with provider: ${config.STORAGE_PROVIDER}`);
    } else {
      console.log('⚠️  File storage disabled (ENABLE_FILE_STORAGE=false)');
      logger.info('File storage disabled');
    }

    // Log server info
    console.log(`🚀 REST API Server running at http://localhost:${config.PORT}`);
    console.log(`📚 Interactive API Docs: http://localhost:${config.PORT}/api/docs`);
    console.log(`📝 Swagger UI: http://localhost:${config.PORT}/api/docs/swagger`);
    console.log(`📊 Metrics: http://localhost:${config.PORT}/metrics`);
    if (config.ENABLE_FILE_STORAGE) {
      console.log(`📁 MinIO Storage: http://${config.MINIO_ENDPOINT}:${config.MINIO_PORT}`);
    }
    console.log(`🔒 Environment: ${config.NODE_ENV}`);
    console.log(`📝 Logging to Loki at: ${config.LOKI_URL}`);

    logger.info('Server started', {
      port: config.PORT,
      environment: config.NODE_ENV,
      lokiUrl: config.LOKI_URL,
    });

    // Log available endpoints
    console.log('\n📍 Available endpoints:');
    console.log('  - REST API: http://localhost:' + config.PORT + '/api');
    console.log('  - Health: http://localhost:' + config.PORT + '/health');
    console.log('  - Metrics: http://localhost:' + config.PORT + '/metrics');
  } catch (error) {
    console.error('❌ Failed to initialize server:', error);
    logger.error('Failed to initialize server', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n📪 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start the server
initialize();

export { server };