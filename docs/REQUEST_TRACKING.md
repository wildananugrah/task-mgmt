# Request Tracking and Activity Logging

This document explains how to use the request tracking and activity logging system.

## Overview

The activity logger now supports:
- **Unique Request IDs**: Each request gets a unique identifier for correlation
- **Processing Time**: Automatic tracking of how long each operation takes
- **Request Context**: Centralized tracking across all operations in a request

## Database Schema

The `ActivityLog` model has been extended with:

```prisma
model ActivityLog {
  id             String   @id @default(uuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  action         String
  entity         String
  entityId       String?
  details        Json?
  ipAddress      String?
  userAgent      String?
  requestId      String?  // NEW: Unique identifier for correlating related activities
  processingTime Int?     // NEW: Processing time in milliseconds
  createdAt      DateTime @default(now())

  @@index([requestId])
}
```

## Using Request Context in Hooks

### Basic Usage

The `afterCreate` and `afterUpdate` hooks now receive a `requestContext` parameter:

```typescript
export const productConfig: ModelConfig = {
  name: 'product',
  // ... other config
  hooks: {
    afterCreate: async (product: any, userId?: string, requestContext?: RequestContext) => {
      if (userId && requestContext) {
        // Use the requestContext to log activity with automatic timing
        await requestContext.logActivity({
          userId,
          action: 'CREATED',
          entity: 'Product',
          entityId: product.id,
          details: getSafeEntityDetails(product),
        });
      }
    },

    afterUpdate: async (product: any, userId?: string, requestContext?: RequestContext) => {
      if (userId && requestContext) {
        await requestContext.logActivity({
          userId,
          action: 'UPDATED',
          entity: 'Product',
          entityId: product.id,
          details: getSafeEntityDetails(product),
        });
      }
    },
  },
};
```

### Manual Usage

You can also use the activity logger directly:

```typescript
import { logActivity, generateRequestId } from '../utils/activity-logger';

// With request ID and processing time
await logActivity({
  userId: 'user-123',
  action: 'CREATED',
  entity: 'Product',
  entityId: 'product-456',
  details: { name: 'New Product' },
  requestId: 'req-789',
  processingTime: 145, // milliseconds
});
```

### Using RequestContext Class

```typescript
import { RequestContext } from '../utils/activity-logger';

// Create a request context
const ctx = new RequestContext(); // Auto-generates requestId
// or
const ctx = new RequestContext('custom-request-id');

// Do some work...
await someOperation();

// Log with automatic timing
await ctx.logActivity({
  userId: 'user-123',
  action: 'CREATED',
  entity: 'Order',
  entityId: 'order-456',
  details: { total: 100 },
});

// Get processing time manually
const elapsed = ctx.getProcessingTime(); // milliseconds
```

## Benefits

### 1. Request Correlation
All activities within a single request share the same `requestId`, making it easy to trace related operations:

```sql
-- Find all activities for a specific request
SELECT * FROM activity_logs
WHERE request_id = 'req-xyz'
ORDER BY created_at;
```

### 2. Performance Monitoring
Track processing times to identify slow operations:

```sql
-- Find slow operations
SELECT entity, action, AVG(processing_time) as avg_time
FROM activity_logs
WHERE processing_time IS NOT NULL
GROUP BY entity, action
ORDER BY avg_time DESC;
```

### 3. Audit Trail
Complete audit trail with timing information:

```sql
-- Get detailed audit trail for a user
SELECT
  action,
  entity,
  entity_id,
  request_id,
  processing_time,
  created_at
FROM activity_logs
WHERE user_id = 'user-123'
ORDER BY created_at DESC;
```

## Automatic Features

The system automatically:
1. **Generates unique request IDs** for each API request
2. **Tracks processing time** from request start to activity log
3. **Propagates request context** through the entire operation chain
4. **Indexes request IDs** for fast querying

## Example Queries

### Find all operations in a slow request
```sql
SELECT * FROM activity_logs
WHERE request_id IN (
  SELECT request_id
  FROM activity_logs
  WHERE processing_time > 1000
);
```

### Performance by entity
```sql
SELECT
  entity,
  COUNT(*) as total_operations,
  AVG(processing_time) as avg_time,
  MAX(processing_time) as max_time
FROM activity_logs
WHERE processing_time IS NOT NULL
GROUP BY entity;
```

### Correlation example
```sql
-- Find all activities that happened during the same request as a specific order creation
SELECT al.*
FROM activity_logs al
WHERE al.request_id = (
  SELECT request_id
  FROM activity_logs
  WHERE entity = 'Order'
    AND entity_id = 'order-123'
  LIMIT 1
);
```
