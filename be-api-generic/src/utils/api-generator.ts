import { z } from 'zod';
import prisma from '../config/database';
import type { Prisma } from '@prisma/client';

export interface CustomRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string; // Path relative to model, e.g., '/:id/cover-image'
  handler: (req: Request, params: any) => Promise<Response>;
  permissions?: string[]; // Optional role-based permissions
}

export interface ModelConfig {
  name: string;
  model: any;
  validation?: {
    create?: z.ZodSchema;
    update?: z.ZodSchema;
    query?: z.ZodSchema;
  };
  transform?: {
    input?: (data: any) => any;
    output?: (data: any) => any;
  };
  permissions?: {
    create?: string[];
    read?: string[];
    update?: string[];
    delete?: string[];
  };
  customRoutes?: CustomRoute[]; // Custom routes for this model
  hooks?: {
    beforeCreate?: (data: any, userId?: string) => Promise<any>;
    afterCreate?: (data: any, userId?: string, requestContext?: any) => Promise<void>;
    beforeUpdate?: (id: string, data: any, userId?: string) => Promise<any>;
    afterUpdate?: (data: any, userId?: string, requestContext?: any) => Promise<void>;
    beforeDelete?: (id: string, userId?: string, requestContext?: any) => Promise<void>;
    afterDelete?: (id: string, userId?: string) => Promise<void>;
  };
  relations?: {
    include?: Record<string, boolean | object>;
    select?: Record<string, boolean>;
  };
  search?: {
    fields?: string[];
    fuzzy?: boolean;
  };
  pagination?: {
    defaultLimit?: number;
    maxLimit?: number;
  };
  sorting?: {
    defaultField?: string;
    defaultOrder?: 'asc' | 'desc';
    allowedFields?: string[];
  };
  filters?: Record<string, {
    type: 'exact' | 'contains' | 'startsWith' | 'endsWith' | 'gte' | 'lte' | 'in' | 'between' | 'boolean' | 'date';
    field?: string;
  }>;
}

export class ApiGenerator {
  private modelConfigs: Map<string, ModelConfig> = new Map();

  registerModel(config: ModelConfig) {
    this.modelConfigs.set(config.name.toLowerCase(), config);
  }

  getModelConfig(modelName: string): ModelConfig | undefined {
    return this.modelConfigs.get(modelName.toLowerCase());
  }

  getRegisteredModels(): string[] {
    return Array.from(this.modelConfigs.keys());
  }

  async generateQuery(modelName: string, params: any) {
    const config = this.getModelConfig(modelName);
    if (!config) throw new Error(`Model ${modelName} not configured`);

    const {
      page = 1,
      limit = config.pagination?.defaultLimit || 20,
      sort = config.sorting?.defaultField || 'createdAt',
      order = config.sorting?.defaultOrder || 'desc',
      search,
      ...filters
    } = params;

    // Build where clause
    const where: any = {};

    // Handle search
    if (search && config.search?.fields) {
      where.OR = config.search.fields.map(field => ({
        [field]: {
          contains: search,
          mode: config?.search?.fuzzy ? 'insensitive' : 'default'
        }
      }));
    }

    // Handle filters
    if (config.filters) {
      Object.entries(filters).forEach(([key, value]) => {
        const filterConfig = config.filters![key];
        if (filterConfig && value !== undefined && value !== '') {
          const field = filterConfig.field || key;

          switch (filterConfig.type) {
            case 'exact':
              where[field] = value;
              break;
            case 'contains':
              where[field] = { contains: value, mode: 'insensitive' };
              break;
            case 'startsWith':
              where[field] = { startsWith: value, mode: 'insensitive' };
              break;
            case 'endsWith':
              where[field] = { endsWith: value, mode: 'insensitive' };
              break;
            case 'gte':
              where[field] = { gte: value };
              break;
            case 'lte':
              where[field] = { lte: value };
              break;
            case 'in':
              where[field] = { in: Array.isArray(value) ? value : [value] };
              break;
            case 'between':
              if (Array.isArray(value) && value.length === 2) {
                where[field] = { gte: value[0], lte: value[1] };
              }
              break;
            case 'boolean':
              where[field] = value === 'true' || value === true;
              break;
            case 'date':
              where[field] = new Date(value as string | number | Date);
              break;
          }
        }
      });
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const take = Math.min(limit, config.pagination?.maxLimit || 100);

    // Build order by
    const orderBy: any = {};
    if (config.sorting?.allowedFields?.includes(sort) || !config.sorting?.allowedFields) {
      orderBy[sort] = order;
    } else {
      orderBy[config.sorting?.defaultField || 'createdAt'] = config.sorting?.defaultOrder || 'desc';
    }

    return {
      where,
      skip,
      take,
      orderBy,
      include: config.relations?.include,
      select: config.relations?.select,
    };
  }

  async findMany(modelName: string, params: any) {
    const config = this.getModelConfig(modelName);
    if (!config) throw new Error(`Model ${modelName} not configured`);

    const query = await this.generateQuery(modelName, params);
    const model = (prisma as any)[modelName];

    const [data, total] = await Promise.all([
      model.findMany(query),
      model.count({ where: query.where }),
    ]);

    const transformedData = config.transform?.output
      ? data.map(config.transform.output)
      : data;

    return {
      data: transformedData,
      pagination: {
        page: params.page || 1,
        limit: query.take,
        total,
        totalPages: Math.ceil(total / query.take),
      },
    };
  }

  async findOne(modelName: string, id: string) {
    const config = this.getModelConfig(modelName);
    if (!config) throw new Error(`Model ${modelName} not configured`);

    const model = (prisma as any)[modelName];
    const data = await model.findUnique({
      where: { id },
      include: config.relations?.include,
      select: config.relations?.select,
    });

    if (!data) return null;

    return config.transform?.output
      ? config.transform.output(data)
      : data;
  }

  async create(modelName: string, data: any, userId?: string, requestContext?: any) {
    const config = this.getModelConfig(modelName);
    if (!config) throw new Error(`Model ${modelName} not configured`);

    // Validate input
    if (config.validation?.create) {
      data = config.validation.create.parse(data);
    }

    // Transform input
    if (config.transform?.input) {
      data = config.transform.input(data);
    }

    // Add created by if user ID is provided
    if (userId && (data as any).createdById === undefined) {
      data.createdById = userId;
    }

    // Execute before hook
    if (config.hooks?.beforeCreate) {
      data = await config.hooks.beforeCreate(data, userId);
    }

    const model = (prisma as any)[modelName];
    const created = await model.create({
      data,
      include: config.relations?.include,
      select: config.relations?.select,
    });

    // Execute after hook with request context
    if (config.hooks?.afterCreate) {
      await config.hooks.afterCreate(created, userId, requestContext);
    }

    return config.transform?.output
      ? config.transform.output(created)
      : created;
  }

  async update(modelName: string, id: string, data: any, userId?: string, requestContext?: any) {
    const config = this.getModelConfig(modelName);
    if (!config) throw new Error(`Model ${modelName} not configured`);

    // Validate input
    if (config.validation?.update) {
      data = config.validation.update.parse(data);
    }

    // Transform input
    if (config.transform?.input) {
      data = config.transform.input(data);
    }

    // Execute before hook
    if (config.hooks?.beforeUpdate) {
      data = await config.hooks.beforeUpdate(id, data, userId);
    }

    const model = (prisma as any)[modelName];
    const updated = await model.update({
      where: { id },
      data,
      include: config.relations?.include,
      select: config.relations?.select,
    });

    // Execute after hook with request context
    if (config.hooks?.afterUpdate) {
      await config.hooks.afterUpdate(updated, userId, requestContext);
    }

    return config.transform?.output
      ? config.transform.output(updated)
      : updated;
  }

  async delete(modelName: string, id: string, userId?: string, requestContext?: any) {
    const config = this.getModelConfig(modelName);
    if (!config) throw new Error(`Model ${modelName} not configured`);

    // Execute before hook
    if (config.hooks?.beforeDelete) {
      await config.hooks.beforeDelete(id, userId);
    }

    const model = (prisma as any)[modelName];
    await model.delete({
      where: { id },
    });

    // Execute after hook
    if (config.hooks?.afterDelete) {
      await config.hooks.afterDelete(id, userId);
    }

    return { success: true, id };
  }

  // Generate GraphQL type definitions
  generateGraphQLTypeDefs(): string {
    let typeDefs = '';

    this.modelConfigs.forEach((config, name) => {
      const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

      typeDefs += `
        type ${capitalizedName} {
          id: ID!
          createdAt: String!
          updatedAt: String!
          # Add other fields based on your schema
        }

        type ${capitalizedName}Response {
          data: [${capitalizedName}!]!
          pagination: Pagination!
        }

        input ${capitalizedName}Input {
          # Add input fields based on your schema
        }

        input ${capitalizedName}Filter {
          search: String
          page: Int
          limit: Int
          sort: String
          order: String
        }
      `;
    });

    return typeDefs;
  }

  // Generate REST routes automatically
  generateRESTRoutes() {
    const routes: any[] = [];

    this.modelConfigs.forEach((config, name) => {
      routes.push({
        method: 'GET',
        path: `/api/${name}s`,
        handler: 'findMany',
        model: name,
      });
      routes.push({
        method: 'GET',
        path: `/api/${name}s/:id`,
        handler: 'findOne',
        model: name,
      });
      routes.push({
        method: 'POST',
        path: `/api/${name}s`,
        handler: 'create',
        model: name,
      });
      routes.push({
        method: 'PUT',
        path: `/api/${name}s/:id`,
        handler: 'update',
        model: name,
      });
      routes.push({
        method: 'DELETE',
        path: `/api/${name}s/:id`,
        handler: 'delete',
        model: name,
      });
    });

    return routes;
  }
}

export const apiGenerator = new ApiGenerator();