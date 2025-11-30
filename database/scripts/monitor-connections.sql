-- Monitor Active Connections and Performance
-- Usage: docker exec -it task-mgmt-db psql -U postgres -f /scripts/monitor-connections.sql

\echo '=========================================='
\echo 'PostgreSQL Connection Monitor'
\echo '=========================================='
\echo ''

\echo '=== CONNECTION POOL STATUS ==='
SELECT
    count(*) as total_connections,
    current_setting('max_connections')::int as max_connections,
    round(100.0 * count(*) / current_setting('max_connections')::int, 2) as usage_percentage
FROM pg_stat_activity;

\echo ''
\echo '=== CONNECTIONS BY STATE ==='
SELECT
    state,
    count(*) as count
FROM pg_stat_activity
WHERE datname IS NOT NULL
GROUP BY state
ORDER BY count DESC;

\echo ''
\echo '=== CONNECTIONS BY APPLICATION ==='
SELECT
    application_name,
    count(*) as connections,
    sum(case when state = 'active' then 1 else 0 end) as active
FROM pg_stat_activity
WHERE datname IS NOT NULL
GROUP BY application_name
ORDER BY connections DESC
LIMIT 10;

\echo ''
\echo '=== LONG RUNNING QUERIES (> 5 seconds) ==='
SELECT
    pid,
    now() - pg_stat_activity.query_start AS duration,
    state,
    left(query, 100) as query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
    AND state != 'idle'
ORDER BY duration DESC;

\echo ''
\echo '=== BLOCKED QUERIES ==='
SELECT
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

\echo ''
\echo '=== CACHE HIT RATIO (should be > 99%) ==='
SELECT
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit) as heap_hit,
    round(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) as cache_hit_ratio
FROM pg_statio_user_tables;

\echo ''
\echo '=========================================='
\echo 'Monitor complete!'
\echo '=========================================='
