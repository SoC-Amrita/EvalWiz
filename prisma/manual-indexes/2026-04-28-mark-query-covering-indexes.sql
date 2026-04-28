-- Manual Postgres performance indexes for reports/analytics Mark lookups.
--
-- Prisma schema can represent the standalone studentId index, but it cannot
-- currently express a Postgres covering INCLUDE index. Run this file directly
-- against Postgres/Supabase, outside a transaction, because CREATE INDEX
-- CONCURRENTLY is not allowed inside transaction blocks.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Mark_studentId_idx"
ON "Mark" ("studentId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Mark_studentId_assessmentId_marks_idx"
ON "Mark" ("studentId", "assessmentId") INCLUDE ("marks");

ANALYZE "Mark";
