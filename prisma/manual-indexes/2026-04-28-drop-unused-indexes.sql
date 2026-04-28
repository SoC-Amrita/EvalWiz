-- Drop unused indexes confirmed by pg_stat_user_indexes (0 scans since last stats reset).
-- Applied directly via Supabase MCP on 2026-04-28.
--
-- Also drops Section_name_key: the @unique constraint on Section.name was removed from
-- the Prisma schema but the live DB index was never cleaned up.

DROP INDEX IF EXISTS "Assessment_offeringId_isActive_displayOrder_idx";
DROP INDEX IF EXISTS "Assessment_offeringId_category_idx";
DROP INDEX IF EXISTS "CourseOffering_isActive_academicYear_term_idx";
DROP INDEX IF EXISTS "CourseOffering_subjectId_isActive_idx";
DROP INDEX IF EXISTS "CourseOfferingClass_sectionId_idx";
DROP INDEX IF EXISTS "CourseOfferingClass_offeringId_facultyId_idx";
DROP INDEX IF EXISTS "CourseOfferingClass_facultyId_idx";
DROP INDEX IF EXISTS "CourseOfferingEnrollment_sectionId_idx";
DROP INDEX IF EXISTS "CourseOfferingMentor_userId_idx";
DROP INDEX IF EXISTS "Section_facultyId_idx";
DROP INDEX IF EXISTS "Section_name_key";
