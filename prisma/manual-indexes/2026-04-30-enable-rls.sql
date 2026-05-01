-- Enable Row Level Security on all public tables.
-- Applied: 2026-04-30
--
-- The application accesses the database exclusively via Prisma using the
-- postgres role, which bypasses RLS. The service_role (admin client) also
-- bypasses RLS. No data-access policies are needed.
--
-- Enabling RLS with no permissive policies means the anon and authenticated
-- Supabase roles are denied all direct PostgREST access, which is correct —
-- those roles are only used for Supabase Auth session management, not data.

ALTER TABLE public."User"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Faculty"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Subject"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Section"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Student"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ArchivedStudent"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."StudentDeletionRequest"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Assessment"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Mark"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CourseOffering"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CourseOfferingClass"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CourseOfferingMentor"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CourseOfferingEnrollment" ENABLE ROW LEVEL SECURITY;
