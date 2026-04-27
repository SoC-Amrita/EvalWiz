# Architecture

This document explains how EvalWiz is shaped internally: the major boundaries, data flow, role model, persistence model, and the design decisions that keep the app coherent as features grow.

For a file-by-file guide, see `PROJECT_MAP.md`. For workflow and agent rules, see `AGENTS.md`.

## Architectural Summary

EvalWiz is a single Next.js App Router application backed by Prisma and Supabase Postgres. It is organized as a role-aware academic workspace rather than a collection of independent pages.

The central architectural idea is:

```text
User session -> active workspace -> role view -> scoped data -> dashboard workflow
```

Most user-facing workflows depend on the active course offering and the user's current role view. Admins may work globally or enter course context. Mentors work at course-offering scope. Faculty work at section scope inside a course offering.

## Runtime Stack

| Layer | Technology | Role |
| --- | --- | --- |
| Application | Next.js 16 App Router | Routing, server rendering, server actions, layouts. |
| UI | React 19, Tailwind CSS 4, local UI primitives | Dashboard and workflow surfaces. |
| Auth | NextAuth v5 beta credentials provider | JWT sessions and protected dashboard access. |
| Database | Supabase Postgres | Hosted relational persistence. |
| ORM | Prisma | Type-safe database access and schema management. |
| Charts | Recharts | Dashboard analytics and report visualizations. |
| Documents | jsPDF, html-to-image, jspdf-autotable | PDF/report generation and chart capture. |
| Spreadsheets | xlsx, exceljs, papaparse | Upload/export flows. |
| Tests | Vitest, Playwright | Unit/action tests and smoke-level browser checks. |

Production builds intentionally use webpack through `next build --webpack`.

## System Boundaries

EvalWiz currently runs as one application, but it has several internal boundaries:

| Boundary | Responsibility |
| --- | --- |
| App routes | Page entry points, layouts, route-level access, server-to-client data handoff. |
| Server actions | Mutations, authorization checks, database writes, path revalidation. |
| Data loaders | Role-aware Prisma reads and computed summaries. |
| Client components | Interaction state, forms, filters, charts, dialogs, downloads. |
| Shared domain helpers | Workspace scoping, assessment math, roll parsing, grading rules, report/export utilities. |
| Prisma schema | Persistent model and relational constraints. |

The codebase intentionally keeps much of the domain logic in `src/lib` so critical calculations and access rules are not trapped inside large client components.

## Request And Data Flow

Most dashboard workflows follow this shape:

```text
Route request
  -> authenticate with NextAuth
  -> resolve active workspace from cookies and accessible offerings
  -> derive role view
  -> build scoped Prisma filters
  -> load server data
  -> render client workflow
  -> submit server action
  -> validate role/scope
  -> write through Prisma
  -> revalidate affected paths
```

The key helpers are:

| Helper | Role |
| --- | --- |
| `getActiveWorkspaceState` | Resolves active course offering, role view, and accessible workspaces. |
| `requireAuthenticatedWorkspaceState` | Ensures a request has a signed-in user and workspace state. |
| `requireRealWorkspace` | Prevents course-specific actions without an active offering. |
| `buildScopedStudentWhere` | Produces role-aware student filters. |
| `buildScopedSectionWhere` | Produces role-aware section filters. |
| `getAllowedSectionIdsForWorkspace` | Computes section access for admin/mentor/faculty role views. |

These helpers live mainly in `src/lib/course-workspace.ts` and `src/lib/workspace-guards.ts`.

## Workspace Model

The active workspace is a term-specific `CourseOffering`, not merely a subject. This is important because a subject can run across many terms, batches, sections, faculty assignments, and evaluation patterns.

Workspace state includes:

- offering id
- subject id/code/title
- program
- term and academic year
- semester and year
- evaluation pattern
- course type
- elective flag
- assigned sections
- available role views

The app stores selected workspace and role mode in cookies:

- `active-course-key`
- `active-role-view`
- `admin-console-mode`

This lets the dashboard preserve context across route changes without turning every page URL into a large state container.

## Role Architecture

There are three workspace role views:

| Role View | Scope |
| --- | --- |
| `administrator` | Global admin capabilities, plus ability to enter course context. |
| `mentor` | Course offering scope across assigned sections. |
| `faculty` | Section scope for assigned course offering classes. |

The base `User.role` is account-level capability. Mentoring and teaching are assignment-driven:

- mentors come from `CourseOfferingMentor`
- faculty section ownership comes from `CourseOfferingClass`
- admin status comes from `User.isAdmin` / role helpers

This keeps course responsibility from being hardcoded into the user account itself.

## Domain Model

The persistent model separates academic catalog, offering instances, reusable classes, and student identity.

```text
Subject
  -> CourseOffering
      -> Assessment
      -> CourseOfferingClass -> Section -> Student
      -> CourseOfferingMentor -> User
      -> CourseOfferingEnrollment -> Student
```

Core decisions:

- `Subject` is reusable catalog data.
- `CourseOffering` is a term-specific run of a subject.
- `Section` is a reusable class/roster group.
- `Student` is a global record.
- `Assessment` belongs to a course offering.
- `Mark` belongs to a student and an assessment.
- `CourseOfferingEnrollment` handles elective/mixed-roster membership.

Regular course offerings primarily scope students through assigned sections. Elective offerings scope students through offering enrollments.

## Regular Courses And Electives

Regular offerings use home-section membership:

```text
CourseOffering -> CourseOfferingClass -> Section -> Student
```

Elective offerings use explicit enrollment:

```text
CourseOffering -> CourseOfferingEnrollment -> Student
```

This lets a course offering gather students from multiple home sections without changing their global student records.

Any analytics, marks, reports, grading, or exports that deal with students should go through workspace-aware filters instead of directly querying all students in a section.

## Assessment And Marks Architecture

Assessment structure is offering-specific. Assessments have:

- code
- name
- max marks
- weightage
- category
- component type
- active/include flags
- display order

Marks are stored as raw values in `Mark`. Weighted totals and report metrics are computed in shared helpers, mainly `src/lib/assessment-structure.ts`.

Important shared concepts:

- assessment classification
- CA totals
- midterm totals
- end-semester totals
- weighted overall totals
- metric stats such as mean, median, mode, standard deviation, min, and max
- grand total rounding rules

Shared calculations should stay in library helpers, not be duplicated in report, grading, or analytics clients.

## Analytics And Reports Architecture

Course Analytics is now the umbrella workspace for:

- Course Analytics overview
- Advanced Analytics
- Section Reports

The top-level shell is `src/app/dashboard/analytics/workspace-shell.tsx`.

Advanced Analytics and Reports still have their own internal modules:

- Advanced Analytics keeps a summary-first shell and lazy-loads heavier chart data.
- Section Reports keeps summary/detail loading and export workflows.
- Legacy routes redirect into the corresponding Course Analytics tab.

This gives users one analytics destination while preserving modular code boundaries.

## Grading Architecture

Grading is course-offering scoped and mentor-owned.

Grade rules are stored on `CourseOffering.gradeRulesConfig` as serialized configuration. The app currently treats the mentor-specified rule as the active rule for the course. Rules may remain blank until the end of the semester.

Key files:

- `src/lib/grade-rules.ts`
- `src/app/dashboard/grading/client.tsx`
- `src/app/dashboard/grading/class-report-pdf.ts`
- `src/app/dashboard/reports/data.ts`
- `src/app/dashboard/advanced-analytics/actions.ts`

The grading PDF depends on report/grading data derived from the same weighted total calculations used elsewhere. This is intentional: final grade documents should not use a separate math path.

## Export Architecture

Exports fall into three categories:

| Export Type | Main Files |
| --- | --- |
| Chart/image capture | `src/lib/pdf-export.ts` |
| Section reports | `src/app/dashboard/reports/client.tsx`, `src/app/dashboard/reports/print-template.tsx` |
| Grading class report | `src/app/dashboard/grading/class-report-pdf.ts` |

The export pipeline should favor stable, readable output over exact reproduction of transient UI state. Report exports may force specific palette/font behavior where needed.

Generated outputs belong in local output folders and should not be committed unless explicitly requested.

## Theme And Design Architecture

Theme state is managed through palette classes on the root document and a client-side theme provider.

Key files:

- `src/lib/palette-theme.ts`
- `src/components/theme-provider.tsx`
- `src/components/palette-picker.tsx`
- `src/app/globals.css`

Chart colors are centralized in:

- `src/lib/chart-theme.ts`

The login page is intentionally treated differently from the dashboard theme experience. Dashboard surfaces should preserve the app's existing visual language: dense, work-focused, readable, and careful about overlapping UI.

## Authentication And Authorization

Authentication is credentials-based through NextAuth. The app uses JWT sessions.

Authorization is mostly enforced at three levels:

1. Page-level redirects for unauthenticated or unauthorized access.
2. Server action guards before mutations.
3. Workspace-aware filters before data reads.

Do not rely on client-side visibility alone for permissions. Any mutation should enforce role and workspace access server-side.

## Server Components, Client Components, And Actions

The common pattern is:

- `page.tsx` loads initial server data and passes serializable props.
- `client.tsx` owns UI interaction, filters, local state, and chart rendering.
- `actions.ts` performs mutations and protected server-side operations.
- `data.ts` contains reusable server-side loading logic for complex pages.
- `types.ts` holds shared types when the module is large.

This pattern is especially visible in Advanced Analytics, Reports, Academic Setup, Marks, Students, and Grading.

## Testing Architecture

Testing is layered:

| Layer | Purpose |
| --- | --- |
| `src/lib/__tests__/*` | Unit tests for shared domain helpers. |
| `src/app/dashboard/*actions.test.ts` | Mocked tests for dashboard-level server actions such as account and workspace actions. |
| `src/app/dashboard/*/*.test.ts` | Mocked tests for server actions. |
| `tests/e2e/auth-smoke.spec.ts` | Playwright auth and protected-route smoke tests. |

For shared domain changes, add or update Vitest coverage. For UI-only changes, targeted lint/type checks may be enough. For export/PDF changes, regenerate and visually inspect output when possible.

## Deployment Architecture

The app deploys as a Next.js application using Prisma against Supabase Postgres.

Required runtime environment:

- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`
- `AUTH_URL`

Important deployment notes:

- Use `npm run build`, which maps to `next build --webpack`.
- `postinstall` runs `prisma generate`.
- `npm run db:push` applies Prisma schema changes when needed.
- Supabase is used as Postgres hosting, not through `@supabase/supabase-js`.

## Architectural Rules Of Thumb

- Put shared calculation logic in `src/lib`, not inside a client component.
- Use workspace-aware query helpers for student and section access.
- Keep server mutations behind server actions and explicit guards.
- Do not duplicate grading or assessment math between analytics, reports, and grading.
- Preserve the distinction between `Subject`, `CourseOffering`, `Section`, and `Student`.
- Treat elective enrollment as offering-specific, not as a mutation of the student's home section.
- Keep exports deterministic and readable, even if the live dashboard is more theme-rich.
- Avoid mixing unrelated local changes into feature or fix PRs.

## Known Pressure Points

These areas deserve extra care:

- Workspace scoping in `src/lib/course-workspace.ts`
- Assessment total math in `src/lib/assessment-structure.ts`
- Grade rule serialization in `src/lib/grade-rules.ts`
- Report and grading PDF layout
- Large chart containers in analytics pages
- Supabase connection strings and Prisma schema drift
- Turbopack-specific local/build behavior
- Section identity drift if code starts assuming `Section.name` is unique again
- Audit-log scoping drift if new actions omit `offeringId`/actor metadata from `details`

When changing any of these, run broader checks and keep the diff small enough to review.
