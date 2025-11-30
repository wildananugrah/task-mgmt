# PostgreSQL Database Configuration & Optimization

This directory contains PostgreSQL database configuration and optimization scripts for the Task Management Application.

## Files Overview

- **`postgresql.conf`** - Optimized PostgreSQL configuration for high-concurrency workload
- **`docker-compose.yml`** - Docker compose configuration for PostgreSQL container
- **`scripts/check-pg-settings.sql`** - Verify PostgreSQL configuration settings
- **`scripts/monitor-connections.sql`** - Monitor database connections and performance
- **`scripts/create-indexes.sql`** - Create performance indexes on all tables

## Quick Start

### 1. Apply PostgreSQL Configuration

The custom PostgreSQL configuration is automatically mounted when you start the database container:

```bash
cd database
docker-compose down
docker-compose up -d
```

### 2. Verify Configuration

Check that PostgreSQL is using the custom configuration:

```bash
# Check specific settings
docker exec -it task-mgmt-db psql -U postgres -c "SHOW max_connections;"
docker exec -it task-mgmt-db psql -U postgres -c "SHOW shared_buffers;"

# Or run the full check script
docker exec -it task-mgmt-db psql -U postgres -f /scripts/check-pg-settings.sql
```

Expected output:
```
max_connections: 300
shared_buffers: 512MB
effective_cache_size: 2GB
work_mem: 16MB
```

### 3. Create Performance Indexes

**IMPORTANT**: Run this on your production database to create all performance indexes:

```bash
# Replace 'your_database' with your actual database name
docker exec -it task-mgmt-db psql -U postgres -d your_database -f /scripts/create-indexes.sql
```

This will create indexes on:
- User email lookups
- Task queries (by group, assignee, status, priority)
- Task group member lookups
- Comments and notifications
- API keys and share tokens
- NextAuth tables

### 4. Update Application Environment Variables

Update your `.env` file with the new connection pool settings:

```bash
# High load configuration (1000+ concurrent users)
DATABASE_POOL_MIN=50
DATABASE_POOL_MAX=200
DATABASE_POOL_TIMEOUT=15000

# Update DATABASE_URL to include connection_limit
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public&connection_limit=200&pool_timeout=15"
```

### 5. Restart Application

```bash
# If using Docker
cd ..
docker-compose down
docker-compose up -d

# If running locally
npm run build
npm start
```

## Configuration Details

### PostgreSQL Settings (postgresql.conf)

| Setting | Value | Purpose |
|---------|-------|---------|
| `max_connections` | 300 | Maximum concurrent database connections |
| `shared_buffers` | 512MB | Shared memory for caching data |
| `effective_cache_size` | 2GB | Planner's estimate of available cache |
| `work_mem` | 16MB | Memory for sort/hash operations |
| `maintenance_work_mem` | 128MB | Memory for VACUUM, INDEX creation |
| `random_page_cost` | 1.1 | Lower for SSD storage |
| `effective_io_concurrency` | 200 | Concurrent I/O operations (SSD) |

### Connection Pool Settings

The application uses Prisma connection pooling:

| Load Level | Users | MIN | MAX | PostgreSQL max_connections |
|------------|-------|-----|-----|---------------------------|
| Low | < 100 | 10 | 50 | 150 |
| Medium | 100-500 | 20 | 100 | 200 |
| High | 500-1000 | 50 | 200 | 300 |
| Very High | 1000+ | 100 | 300 | 400 |

**Rule**: PostgreSQL `max_connections` should be at least `DATABASE_POOL_MAX + 100`

## Monitoring & Maintenance

### Monitor Active Connections

```bash
# Real-time connection monitoring
docker exec -it task-mgmt-db psql -U postgres -f /scripts/monitor-connections.sql
```

This shows:
- Connection pool usage percentage
- Connections by state (active, idle)
- Long-running queries (> 5 seconds)
- Blocked queries
- Cache hit ratio

### Check Database Performance

```sql
-- Connect to database
docker exec -it task-mgmt-db psql -U postgres -d your_database

-- Check cache hit ratio (should be > 99%)
SELECT
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit) as heap_hit,
    round(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) as cache_hit_ratio
FROM pg_statio_user_tables;

-- Check slow queries
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE (now() - query_start) > interval '5 seconds'
    AND state != 'idle'
ORDER BY duration DESC;
```

### Analyze Query Performance

If you enabled `pg_stat_statements` extension:

```sql
-- Enable extension (one time)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slowest queries
SELECT
    calls,
    round(total_exec_time::numeric, 2) as total_time_ms,
    round(mean_exec_time::numeric, 2) as avg_time_ms,
    round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) as percentage,
    left(query, 100) as query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- Reset statistics
SELECT pg_stat_statements_reset();
```

## Troubleshooting

### Problem: Too many connections error

**Symptom**: `FATAL: sorry, too many clients already`

**Solution**:
1. Check current connections:
   ```bash
   docker exec -it task-mgmt-db psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
   ```

2. Increase `max_connections` in [postgresql.conf](postgresql.conf)

3. Restart database:
   ```bash
   docker-compose restart task-mgmt-db
   ```

### Problem: Slow query performance

**Symptom**: High P95 response times in k6 tests

**Solution**:
1. Check if indexes exist:
   ```bash
   docker exec -it task-mgmt-db psql -U postgres -d your_database -f /scripts/create-indexes.sql
   ```

2. Run ANALYZE to update statistics:
   ```sql
   docker exec -it task-mgmt-db psql -U postgres -d your_database -c "ANALYZE VERBOSE;"
   ```

3. Check for missing indexes:
   ```sql
   -- Find tables with sequential scans
   SELECT schemaname, tablename, seq_scan, idx_scan
   FROM pg_stat_user_tables
   WHERE seq_scan > 1000 AND idx_scan < seq_scan
   ORDER BY seq_scan DESC;
   ```

### Problem: High memory usage

**Symptom**: PostgreSQL container using too much memory

**Solution**:
1. Reduce `shared_buffers` or `work_mem` in [postgresql.conf](postgresql.conf)

2. Monitor memory per connection:
   ```
   Estimated memory = (max_connections × work_mem) + shared_buffers
   300 × 16MB + 512MB = ~5.3GB
   ```

3. Adjust based on available server RAM

### Problem: Lock waits and blocking

**Symptom**: Queries waiting for locks

**Solution**:
1. Check blocked queries:
   ```bash
   docker exec -it task-mgmt-db psql -U postgres -f /scripts/monitor-connections.sql
   ```

2. If you see long-running transactions, consider:
   - Adding connection timeouts
   - Using `NOWAIT` or `SKIP LOCKED` in queries
   - Optimizing transaction scope

## Performance Testing

After applying optimizations, run load tests to verify improvements:

```bash
# From project root
k6 run -e BASE_URL=https://your-domain.com k6-tests/health-check-test.js
```

### Expected Results (1000 VUs)

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Error Rate | 36.76% | < 2% | < 2% |
| P95 Response Time | 3,423ms | < 1,500ms | < 1,500ms |
| Response Time Failures | 63.53% | < 2% | < 2% |
| Average Response Time | 1,518ms | < 500ms | < 500ms |

## Backup & Recovery

### Create Database Backup

```bash
# Full database backup
docker exec -it task-mgmt-db pg_dump -U postgres -d your_database -F c -f /tmp/backup.dump

# Copy backup out of container
docker cp task-mgmt-db:/tmp/backup.dump ./backup-$(date +%Y%m%d).dump
```

### Restore from Backup

```bash
# Copy backup into container
docker cp backup-20231106.dump task-mgmt-db:/tmp/restore.dump

# Restore database
docker exec -it task-mgmt-db pg_restore -U postgres -d your_database -F c /tmp/restore.dump
```

## Additional Resources

- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)
- [PGTune - PostgreSQL Configuration Wizard](https://pgtune.leopard.in.ua/)
- [Prisma Connection Pool Docs](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [Main Performance Documentation](../PERFORMANCE-IMPROVEMENTS.md)

## Notes

- **CONCURRENTLY**: Index creation uses `CREATE INDEX CONCURRENTLY` to avoid blocking writes
- **Restart Required**: Changes to `postgresql.conf` require PostgreSQL restart
- **Production Safety**: Always test configuration changes in staging first
- **Monitoring**: Set up monitoring alerts for connection pool usage and query performance
