-- Performance Indexes for Task Management App
-- Run this after deploying to production database
-- Usage: docker exec -it task-mgmt-db psql -U postgres -d your_database -f /scripts/create-indexes.sql

\echo '=========================================='
\echo 'Creating Performance Indexes'
\echo '=========================================='
\echo ''

-- Check if indexes already exist
\echo 'Checking existing indexes...'
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

\echo ''
\echo '=== Creating indexes for User table ==='

-- User email lookup (for login)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_email ON "User"(email);
\echo '✓ Created idx_user_email'

-- User email verification status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_emailverified ON "User"("emailVerified") WHERE "emailVerified" IS NOT NULL;
\echo '✓ Created idx_user_emailverified'

\echo ''
\echo '=== Creating indexes for Task table ==='

-- Task group lookup (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_taskgroup_id ON "Task"("taskGroupId");
\echo '✓ Created idx_task_taskgroup_id'

-- Task assignee lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_assignee_id ON "Task"("assigneeId") WHERE "assigneeId" IS NOT NULL;
\echo '✓ Created idx_task_assignee_id'

-- Task status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_status ON "Task"(status);
\echo '✓ Created idx_task_status'

-- Task priority filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_priority ON "Task"(priority);
\echo '✓ Created idx_task_priority'

-- Task due date sorting/filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_duedate ON "Task"("dueDate") WHERE "dueDate" IS NOT NULL;
\echo '✓ Created idx_task_duedate'

-- Composite index for common task queries (taskGroupId + status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_group_status ON "Task"("taskGroupId", status);
\echo '✓ Created idx_task_group_status'

-- Composite index for assignee tasks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_assignee_status ON "Task"("assigneeId", status) WHERE "assigneeId" IS NOT NULL;
\echo '✓ Created idx_task_assignee_status'

\echo ''
\echo '=== Creating indexes for TaskGroup table ==='

-- TaskGroup owner lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_taskgroup_owner_id ON "TaskGroup"("ownerId");
\echo '✓ Created idx_taskgroup_owner_id'

-- TaskGroup creation date for sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_taskgroup_createdat ON "TaskGroup"("createdAt");
\echo '✓ Created idx_taskgroup_createdat'

\echo ''
\echo '=== Creating indexes for TaskGroupMember table ==='

-- Member lookup by user (to find all groups for a user)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_taskgroupmember_user_id ON "TaskGroupMember"("userId");
\echo '✓ Created idx_taskgroupmember_user_id'

-- Member lookup by group
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_taskgroupmember_group_id ON "TaskGroupMember"("taskGroupId");
\echo '✓ Created idx_taskgroupmember_group_id'

-- Composite index for permission checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_taskgroupmember_user_group ON "TaskGroupMember"("userId", "taskGroupId");
\echo '✓ Created idx_taskgroupmember_user_group'

-- Role-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_taskgroupmember_role ON "TaskGroupMember"(role);
\echo '✓ Created idx_taskgroupmember_role'

\echo ''
\echo '=== Creating indexes for Comment table ==='

-- Comments by task
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comment_task_id ON "Comment"("taskId");
\echo '✓ Created idx_comment_task_id'

-- Comments by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comment_user_id ON "Comment"("userId");
\echo '✓ Created idx_comment_user_id'

-- Parent comment lookup for threaded comments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comment_parent_id ON "Comment"("parentId") WHERE "parentId" IS NOT NULL;
\echo '✓ Created idx_comment_parent_id'

-- Comment creation date for sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comment_createdat ON "Comment"("createdAt");
\echo '✓ Created idx_comment_createdat'

\echo ''
\echo '=== Creating indexes for Notification table ==='

-- Notifications by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_user_id ON "Notification"("userId");
\echo '✓ Created idx_notification_user_id'

-- Unread notifications lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_read ON "Notification"(read);
\echo '✓ Created idx_notification_read'

-- Composite index for unread notifications by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_user_read ON "Notification"("userId", read);
\echo '✓ Created idx_notification_user_read'

-- Notification creation date for sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_createdat ON "Notification"("createdAt");
\echo '✓ Created idx_notification_createdat'

\echo ''
\echo '=== Creating indexes for TaskAttachment table ==='

-- Attachments by task
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attachment_task_id ON "TaskAttachment"("taskId");
\echo '✓ Created idx_attachment_task_id'

-- Attachments by uploader
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attachment_uploaded_by ON "TaskAttachment"("uploadedBy");
\echo '✓ Created idx_attachment_uploaded_by'

\echo ''
\echo '=== Creating indexes for ApiKey table ==='

-- API key lookup (most critical for auth)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apikey_key ON "ApiKey"(key);
\echo '✓ Created idx_apikey_key'

-- API key by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apikey_user_id ON "ApiKey"("userId");
\echo '✓ Created idx_apikey_user_id'

-- Active API keys only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apikey_active ON "ApiKey"(active) WHERE active = true;
\echo '✓ Created idx_apikey_active'

\echo ''
\echo '=== Creating indexes for TaskShareToken table ==='

-- Token lookup for public task viewing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sharetoke_token ON "TaskShareToken"(token);
\echo '✓ Created idx_sharetoke_token'

-- Share tokens by task
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sharetoken_task_id ON "TaskShareToken"("taskId");
\echo '✓ Created idx_sharetoken_task_id'

-- Active share tokens only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sharetoken_active ON "TaskShareToken"(revoked) WHERE revoked = false;
\echo '✓ Created idx_sharetoken_active'

\echo ''
\echo '=== Creating indexes for NextAuth tables ==='

-- Account lookup by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_user_id ON "Account"("userId");
\echo '✓ Created idx_account_user_id'

-- Account lookup by provider
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_provider ON "Account"(provider, "providerAccountId");
\echo '✓ Created idx_account_provider'

-- Session lookup by session token
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_token ON "Session"("sessionToken");
\echo '✓ Created idx_session_token'

-- Session lookup by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_user_id ON "Session"("userId");
\echo '✓ Created idx_session_user_id'

-- Verification token lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_token ON "VerificationToken"(token);
\echo '✓ Created idx_verification_token'

-- Verification token identifier
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_identifier ON "VerificationToken"(identifier);
\echo '✓ Created idx_verification_identifier'

\echo ''
\echo '=========================================='
\echo 'Index Creation Complete!'
\echo '=========================================='
\echo ''

-- Show all indexes created
\echo 'Current indexes on public schema:'
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

\echo ''
\echo 'Analyzing tables to update statistics...'
ANALYZE VERBOSE;

\echo ''
\echo '=========================================='
\echo 'All done! Database is now optimized.'
\echo '=========================================='
