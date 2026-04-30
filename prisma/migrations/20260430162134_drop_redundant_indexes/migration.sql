-- Drop 5 redundant indexes superseded by existing unique constraints or compound indexes.

DROP INDEX IF EXISTS "Section_name_idx";
DROP INDEX IF EXISTS "CourseOfferingClass_facultyId_idx";
DROP INDEX IF EXISTS "CourseOfferingClass_sectionId_idx";
DROP INDEX IF EXISTS "CourseOfferingMentor_userId_idx";
DROP INDEX IF EXISTS "CourseOfferingEnrollment_sectionId_idx";
