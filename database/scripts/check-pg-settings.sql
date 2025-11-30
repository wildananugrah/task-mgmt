-- PostgreSQL Configuration Check Script
-- Run this after applying postgresql.conf changes
-- Usage: docker exec -it task-mgmt-db psql -U postgres -f /scripts/check-pg-settings.sql

\echo '=========================================='
\echo 'PostgreSQL Configuration Check'
\echo '=========================================='
\echo ''

\echo '=== CONNECTION SETTINGS ==='
SELECT name, setting, unit, source
FROM pg_settings
WHERE name IN ('max_connections', 'superuser_reserved_connections')
ORDER BY name;

\echo ''
\echo '=== MEMORY SETTINGS ==='
SELECT name, setting, unit, source
FROM pg_settings
WHERE name IN (
    'shared_buffers',
    'effective_cache_size',
    'work_mem',
    'maintenance_work_mem',
    'wal_buffers'
)
ORDER BY name;

\echo ''
\echo '=== QUERY PLANNER SETTINGS ==='
SELECT name, setting, unit, source
FROM pg_settings
WHERE name IN (
    'random_page_cost',
    'effective_io_concurrency',
    'seq_page_cost'
)
ORDER BY name;

\echo ''
\echo '=== CHECKPOINT SETTINGS ==='
SELECT name, setting, unit, source
FROM pg_settings
WHERE name IN (
    'checkpoint_completion_target',
    'checkpoint_timeout',
    'max_wal_size',
    'min_wal_size'
)
ORDER BY name;

\echo ''
\echo '=== LOGGING SETTINGS ==='
SELECT name, setting, unit, source
FROM pg_settings
WHERE name IN (
    'log_min_duration_statement',
    'log_connections',
    'log_disconnections',
    'log_lock_waits'
)
ORDER BY name;

\echo ''
\echo '=== CURRENT CONNECTION STATUS ==='
SELECT
    count(*) as total_connections,
    sum(case when state = 'active' then 1 else 0 end) as active,
    sum(case when state = 'idle' then 1 else 0 end) as idle,
    sum(case when state = 'idle in transaction' then 1 else 0 end) as idle_in_transaction
FROM pg_stat_activity;

\echo ''
\echo '=== CONNECTION BY DATABASE ==='
SELECT
    datname,
    count(*) as connections,
    sum(case when state = 'active' then 1 else 0 end) as active
FROM pg_stat_activity
WHERE datname IS NOT NULL
GROUP BY datname
ORDER BY connections DESC;

\echo ''
\echo '=== MEMORY USAGE CALCULATION ==='
SELECT
    current_setting('max_connections')::int *
    (current_setting('work_mem')::int / 1024) as max_work_mem_mb,
    current_setting('shared_buffers') as shared_buffers,
    current_setting('effective_cache_size') as effective_cache_size,
    current_setting('maintenance_work_mem') as maintenance_work_mem;

\echo ''
\echo '=== DATABASE SIZE ==='
SELECT
    pg_database.datname,
    pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
ORDER BY pg_database_size(pg_database.datname) DESC;

\echo ''
\echo '=========================================='
\echo 'Configuration check complete!'
\echo '=========================================='
