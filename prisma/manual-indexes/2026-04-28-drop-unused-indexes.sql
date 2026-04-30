-- Safe cleanup for legacy indexes that are no longer represented by the
-- current Prisma schema.
--
-- Earlier versions of this file also dropped several lookup indexes that are
-- now Prisma-managed and present in the live Supabase database. Do not drop
-- those here; rerunning this file should not fight `prisma db push`.
--
-- "Section_name_key" came from the removed global @unique constraint on
-- Section.name. The replacement non-unique "Section_name_idx" remains managed
-- by Prisma.
--
-- "Mark_studentId_idx" was a short-lived standalone index. It is redundant
-- after "Mark_studentId_assessmentId_key" and the manual covering
-- "Mark_studentId_assessmentId_marks_idx" index.

DROP INDEX IF EXISTS "Section_name_key";
DROP INDEX IF EXISTS "Mark_studentId_idx";
