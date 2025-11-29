import { apiGenerator } from '../models/configurations';
import { authenticate, authorize } from '../middleware/auth';
import { handleError } from '../middleware/error-handler';
import { requestTrackingMiddleware, getRequestContext } from '../middleware/request-tracking.middleware';
import type { AuthRequest } from '../types/auth';

export class ApiRouter {
  private routes: Map<string, Function> = new Map();

  constructor() {
    this.generateRoutes();
  }

  private generateRoutes() {
    // Get all registered model names from apiGenerator
    const modelNames = apiGenerator.getRegisteredModels();

    modelNames.forEach((modelName) => {
      const config = apiGenerator.getModelConfig(modelName);
      if (!config) return;

      // Better pluralization
      // TODO: be careful here.
      const plural = modelName === 'category' ? 'categories' : modelName + 's';

      // Register custom routes first (higher priority)
      if (config.customRoutes) {
        config.customRoutes.forEach((customRoute) => {
          const fullPath = `/api/${plural}${customRoute.path}`;
          this.routes.set(`${customRoute.method}:${fullPath}`, async (req: Request, params: any) => {
            // Check permissions if specified
            if (customRoute.permissions) {
              const authReq = req as AuthRequest;
              await authenticate(authReq);
              authorize(customRoute.permissions)(authReq);
            }
            return customRoute.handler(req, params);
          });
        });
      }

      // GET /api/{model}s - List with pagination, filtering, sorting
      this.routes.set(`GET:/api/${plural}`, async (req: Request) => {
        const url = new URL(req.url);
        const params = Object.fromEntries(url.searchParams.entries());

        // Validate query params if schema exists
        if (config.validation?.query) {
          config.validation.query.parse(params);
        }

        // Check permissions
        const authReq = req as AuthRequest;
        if (config.permissions?.read) {
          await authenticate(authReq);
          authorize(config.permissions.read)(authReq);
        }

        const result = await apiGenerator.findMany(modelName, params);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      // GET /api/{model}s/:id - Get by ID
      this.routes.set(`GET:/api/${plural}/:id`, async (req: Request, params: { id: string }) => {
        // Check permissions
        const authReq = req as AuthRequest;
        if (config.permissions?.read) {
          await authenticate(authReq);
          authorize(config.permissions.read)(authReq);
        }

        const result = await apiGenerator.findOne(modelName, params.id);

        if (!result) {
          return new Response(
            JSON.stringify({ error: `${modelName} not found` }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      // POST /api/{model}s - Create
      this.routes.set(`POST:/api/${plural}`, async (req: Request) => {
        const body = await req.json();

        // Add request tracking
        const trackedReq = requestTrackingMiddleware(req);
        const requestContext = getRequestContext(trackedReq);

        // Check permissions
        const authReq = req as AuthRequest;
        if (config.permissions?.create) {
          await authenticate(authReq);
          authorize(config.permissions.create)(authReq);
        }

        const userId = authReq.user?.userId;
        const result = await apiGenerator.create(modelName, body, userId, requestContext);

        return new Response(JSON.stringify(result), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      // PUT /api/{model}s/:id - Update
      this.routes.set(`PUT:/api/${plural}/:id`, async (req: Request, params: { id: string }) => {
        const body = await req.json();

        // Add request tracking
        const trackedReq = requestTrackingMiddleware(req);
        const requestContext = getRequestContext(trackedReq);

        // Check permissions
        const authReq = req as AuthRequest;
        if (config.permissions?.update) {
          await authenticate(authReq);
          authorize(config.permissions.update)(authReq);
        }

        const userId = authReq.user?.userId;
        const result = await apiGenerator.update(modelName, params.id, body, userId, requestContext);

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      // DELETE /api/{model}s/:id - Delete
      this.routes.set(`DELETE:/api/${plural}/:id`, async (req: Request, params: { id: string }) => {
        // Add request tracking
        const trackedReq = requestTrackingMiddleware(req);
        const requestContext = getRequestContext(trackedReq);

        // Check permissions
        const authReq = req as AuthRequest;
        if (config.permissions?.delete) {
          await authenticate(authReq);
          authorize(config.permissions.delete)(authReq);
        }

        const userId = authReq.user?.userId;
        const result = await apiGenerator.delete(modelName, params.id, userId, requestContext);

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });
    });
  }

  async handle(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method;

    console.log(`[ApiRouter] Handling ${method} ${pathname}`);
    console.log(`[ApiRouter] Registered routes:`, Array.from(this.routes.keys()));

    // Try exact match first
    let handler = this.routes.get(`${method}:${pathname}`);
    let params: any = {};

    // Try pattern matching for routes with parameters
    if (!handler) {
      console.log('[ApiRouter] No exact match, trying pattern matching...');
      for (const [routeKey, routeHandler] of this.routes.entries()) {
        // Split only on the FIRST colon to separate method from path
        const colonIndex = routeKey.indexOf(':');
        if (colonIndex === -1) continue;

        const routeMethod = routeKey.substring(0, colonIndex);
        const routePath = routeKey.substring(colonIndex + 1);

        if (routeMethod !== method || !routePath) continue;

        // Convert route pattern to regex
        const pattern = routePath.replace(/:(\w+)/g, '(?<$1>[^/]+)');
        const regex = new RegExp(`^${pattern}$`);
        console.log(`[ApiRouter] Testing pattern: ${routePath} -> ${pattern} against ${pathname}`);
        const match = pathname.match(regex);

        if (match) {
          console.log(`[ApiRouter] Pattern matched! Params:`, match.groups);
          handler = routeHandler;
          params = match.groups || {};
          break;
        }
      }
    }

    if (!handler) {
      console.log('[ApiRouter] No handler found for route');
      return null;
    }

    try {
      return await handler(req, params);
    } catch (error) {
      return handleError(error);
    }
  }

  getRoutes() {
    return Array.from(this.routes.keys());
  }
}

// Export class only - instance is created in server.ts after model registration