import prisma from '../config/database';
import { randomUUID } from 'crypto';

/**
 * Utility to log activities to the ActivityLog table
 */

interface ActivityLogData {
  userId: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED' | 'VIEWED';
  entity: string;
  entityId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  processingTime?: number;
}

/**
 * Generate a unique request ID
 */
export const generateRequestId = (): string => {
  return randomUUID();
};

/**
 * Log an activity with optional request tracking and performance metrics
 */
export const logActivity = async (data: ActivityLogData) => {
  try {
    await prisma.activityLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        details: data.details || {},
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        requestId: data.requestId,
        processingTime: data.processingTime,
      },
    });
  } catch (error) {
    // Log error but don't fail the main operation
    console.error('[ActivityLogger] Failed to log activity:', error);
  }
};

/**
 * Helper to get relevant entity details for logging
 * Filters out sensitive data like passwords
 */
export const getSafeEntityDetails = (entity: any, sensitiveFields: string[] = ['password']): any => {
  if (!entity || typeof entity !== 'object') return {};

  const safe: any = {};
  for (const [key, value] of Object.entries(entity)) {
    // Skip sensitive fields
    if (sensitiveFields.includes(key)) continue;

    // Skip complex objects and relations
    if (value && typeof value === 'object' && !Array.isArray(value)) continue;

    safe[key] = value;
  }

  return safe;
};

/**
 * Request context to track timing and correlation
 */
export class RequestContext {
  requestId: string;
  startTime: number;

  constructor(requestId?: string) {
    this.requestId = requestId || generateRequestId();
    this.startTime = Date.now();
  }

  /**
   * Get the processing time in milliseconds since request start
   */
  getProcessingTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Log activity with automatic request ID and processing time
   */
  async logActivity(data: Omit<ActivityLogData, 'requestId' | 'processingTime'>) {
    await logActivity({
      ...data,
      requestId: this.requestId,
      processingTime: this.getProcessingTime(),
    });
  }
}
