# Project Map

This map is a practical orientation guide for EvalWiz. Use it when you need to find the right part of the codebase before making a change.

## High-Level Shape

EvalWiz is a Next.js App Router application for academic course operations and evaluation. It uses React, TypeScript, Tailwind CSS, Prisma, Supabase Postgres, NextAuth, Recharts, jsPDF, and spreadsheet export libraries.

The app is organized around two broad modes:

- Global administrator tools for academic setup, user management, student master data, and course offering configuration.
- Course workspace tools for mentors and faculty, scoped by active course offering, role view, and assigned sections.

The active workspace is the central boundary for marks, reports, analytics, advanced analytics, and grading.

## Root Files

| Path | Purpose |
| --- | --- |
| `README.md` | Project overview, setup, environment variables, testing, and product notes. |
| `AGENTS.md` | Coding agent workflow, Git strategy, branch naming, verification, and safety rules. |
| `CLAUDE.md` | Claude-specific pointer to `AGENTS.md`. |
| `package.json` | Scripts and dependencies. Production build intentionally uses `next build --webpack`. |
| `prisma/schema.prisma` | PostgreSQL schema for users, course offerings, students, assessments, marks, and enrollments. |
| `prisma/manual-indexes/*` | Manual Postgres index SQL for database features Prisma schema cannot express, such as covering `INCLUDE` indexes. |
| `prisma/seed.ts` | Demo/local seed data. |
| `prisma.config.ts` | Prisma CLI environment configuration. |
| `next.config.ts` | Next.js configuration. |
| `eslint.config.mjs` | ESLint configuration. |
| `vitest.config.ts` | Vitest configuration. |
| `playwright.config.ts` | Playwright smoke test configuration. |

## App Entry Points

| Path | Purpose |
| --- | --- |
| `src/app/layout.tsx` | Root HTML shell, global providers, metadata, fonts, and theme provider. |
| `src/app/page.tsx` | Root redirect/entry behavior. |
| `src/app/login/page.tsx` | Login screen. |
| `src/app/login/actions.ts` | Login-related server actions. |
| `src/app/dashboard/layout.tsx` | Dashboard-level layout and access boundary. |
| `src/app/dashboard/page.tsx` | Workspace home and dashboard landing page. |
| `src/app/dashboard/dashboard-shell.tsx` | Main dashboard chrome, sidebar, header, user menu placement, and focused route behavior. |
| `src/app/dashboard/user-menu.tsx` | Account menu, password change, sign out, and admin/workspace mode controls. |
| `src/app/dashboard/workspace-selector.tsx` | Workspace selection UI. |
| `src/app/dashboard/workspace-actions.ts` | Server actions for workspace/admin mode switching. |
| `src/app/dashboard/workspace-context-gate.tsx` | Hidden simulation/analysis preview gate and context beacon behavior. |

## Dashboard Areas

### Academic Setup

| Path | Purpose |
| --- | --- |
| `src/app/dashboard/academic-setup/page.tsx` | Admin-only academic setup page. |
| `src/app/dashboard/academic-setup/client.tsx` | Subject, class, and offering management UI. |
| `src/app/dashboard/academic-setup/actions.ts` | Server mutations for setup entities. |
| `src/app/dashboard/academic-setup/data.ts` | Server-side setup data loading. |
| `src/app/dashboard/academic-setup/offering-form.tsx` | Course offering create/edit form. |

### Users

| Path | Purpose |
| --- | --- |
| `src/app/dashboard/users/page.tsx` | Admin-only user management page. |
| `src/app/dashboard/users/client.tsx` | User management UI. |
| `src/app/dashboard/users/actions.ts` | User creation, update, activation, and password reset actions. |

### Students

| Path | Purpose |
| --- | --- |
| `src/app/dashboard/students/page.tsx` | Admin master list or workspace-scoped student page, depending on role context. |
| `src/app/dashboard/students/client.tsx` | Admin student master list UI. |
| `src/app/dashboard/students/workspace-students-client.tsx` | Workspace-scoped student UI. |
| `src/app/dashboard/students/[studentId]/page.tsx` | Student detail page. |
| `src/app/dashboard/students/record-client.tsx` | Admin student record UI. |
| `src/app/dashboard/students/workspace-record-client.tsx` | Workspace-scoped student record UI. |
| `src/app/dashboard/students/actions.ts` | Student create/update/import/archive/delete request actions. |
| `src/app/dashboard/students/queries.ts` | Student query helpers and pagination loaders. |

### Sections

| Path | Purpose |
| --- | --- |
| `src/app/dashboard/sections/page.tsx` | Section allocation page. |
| `src/app/dashboard/sections/client.tsx` | Section allocation and enrollment UI. |
| `src/app/dashboard/sections/actions.ts` | Section assignment/enrollment server actions. |

### Assessments

| Path | Purpose |
| --- | --- |
| `src/app/dashboard/assessments/page.tsx` | Assessment setup page. |
| `src/app/dashboard/assessments/client.tsx` | Assessment component UI. |
| `src/app/dashboard/assessments/actions.ts` | Assessment create/update/delete actions. |

### Marks

| Path | Purpose |
| --- | --- |
| `src/app/dashboard/marks/page.tsx` | Marks entry page. |
| `src/app/dashboard/marks/client.tsx` | Marks entry table, filters, and upload/export UI. |
| `src/app/dashboard/marks/actions.ts` | Marks save/import actions. |
| `src/app/dashboard/marks/fetcher.ts` | Marks data fetch helpers. |

### Course Analytics

| Path | Purpose |
| --- | --- |
| `src/app/dashboard/analytics/page.tsx` | Course Analytics server page. Loads overview, advanced analytics summary, and section report summary. |
| `src/app/dashboard/analytics/workspace-shell.tsx` | Top-level tabbed analytics workspace: Course Analytics, Advanced Analytics, Section Reports. |
| `src/app/dashboard/analytics/client.tsx` | Component averages, completion, and course-level chart UI. |
| `src/app/dashboard/advanced-analytics/page.tsx` | Redirects to the Advanced Analytics tab under Course Analytics. |
| `src/app/dashboard/reports/page.tsx` | Redirects to the Section Reports tab under Course Analytics. |

### Advanced Analytics

| Path | Purpose |
| --- | --- |
| `src/app/dashboard/advanced-analytics/shell.tsx` | Lazy-loading advanced analytics shell with overview and charts workspace. |
| `src/app/dashboard/advanced-analytics/client.tsx` | Heavy advanced charting workspace. |
| `src/app/dashboard/advanced-analytics/data.ts` | Advanced analytics summary/detail data loading. |
| `src/app/dashboard/advanced-analytics/actions.ts` | Server actions for loading details and saving mentor grade rules. |
| `src/app/dashboard/advanced-analytics/types.ts` | Advanced analytics data types. |

### Section Reports

| Path | Purpose |
| --- | --- |
| `src/app/dashboard/reports/client.tsx` | Consolidated section reports UI, tables, charts, and exports. |
| `src/app/dashboard/reports/data.ts` | Reports summary/detail data loading and grading report data assembly. |
| `src/app/dashboard/reports/actions.ts` | Server action wrapper for loading report details. |
| `src/app/dashboard/reports/types.ts` | Report data types. |
| `src/app/dashboard/reports/print-template.tsx` | Printable report template support. |

### Grading

| Path | Purpose |
| --- | --- |
| `src/app/dashboard/grading/page.tsx` | Grading workspace page. |
| `src/app/dashboard/grading/client.tsx` | Mentor-owned grade rule UI, grading dashboard, distribution views, and report download controls. |
| `src/app/dashboard/grading/class-report-pdf.ts` | Class grading report PDF generation. |
| `src/app/dashboard/grading/stem-leaf-views.tsx` | Stem-and-leaf overview and detailed explorer views. |
| `src/app/dashboard/grading/stem-leaf/page.tsx` | Focused stem-and-leaf route with more screen space. |

### What-If / Simulation

| Path | Purpose |
| --- | --- |
| `src/app/dashboard/what-if/page.tsx` | Protected scenario simulation route. |
| `src/app/dashboard/what-if/client.tsx` | What-if simulation UI and charting. |
| `src/lib/analysis-preview-access.ts` | Access logic for analysis preview/simulation features. |

## Shared Libraries

| Path | Purpose |
| --- | --- |
| `src/lib/db.ts` | Prisma singleton. |
| `src/lib/course-workspace.ts` | Active workspace resolution, workspace scoping, role view logic, and scoped filters. |
| `src/lib/workspace-guards.ts` | Authentication/workspace guard helpers for server routes/actions. |
| `src/lib/workspace-labels.ts` | Workspace, course, section, and role label formatting. |
| `src/lib/user-roles.ts` | Role helper functions. |
| `src/lib/user-names.ts` | User display name helpers. |
| `src/lib/roll-number.ts` | Roll number parsing and section inference. |
| `src/lib/assessment-structure.ts` | Assessment classification, weighted totals, metric stats, and grading total calculations. |
| `src/lib/grade-rules.ts` | Mentor grade rule parsing, validation, serialization, and grade counting. |
| `src/lib/chart-theme.ts` | Chart color tokens and helper functions. |
| `src/lib/palette-theme.ts` | Palette theme constants, persistence helpers, and theme exclusion logic. |
| `src/lib/pdf-export.ts` | DOM-to-image export and PDF support helpers. |
| `src/lib/app-info.ts` | App metadata and display naming. |
| `src/lib/client-errors.ts` | Client-side error formatting helpers. |
| `src/lib/utils.ts` | Shared utility helpers, including class name merging. |

## Components

| Path | Purpose |
| --- | --- |
| `src/components/ui/*` | Reusable UI primitives: buttons, cards, dialogs, tabs, tables, sheets, selects, tooltips, etc. |
| `src/components/ui/use-confirm-dialog.tsx` | Reusable design-system confirmation dialog hook for destructive or high-impact client actions. |
| `src/components/theme-provider.tsx` | Palette theme context and DOM class application. |
| `src/components/theme-toggle.tsx` | Theme toggle control. |
| `src/components/palette-picker.tsx` | Theme studio / palette picker. |
| `src/components/font-provider.tsx` | Font handling. |
| `src/components/font-toggle.tsx` | Font toggle control. |

## Database Model Map

The Prisma schema defines these core entities:

| Model | Role |
| --- | --- |
| `User` | Login account and role identity. |
| `Faculty` | Faculty profile connected to a user. |
| `Subject` | Reusable academic subject/catalog entry. |
| `Section` | Reusable class or roster group. |
| `Student` | Global student record. |
| `ArchivedStudent` | Archived student snapshot. |
| `StudentDeletionRequest` | Approval workflow for removing student records. |
| `Assessment` | Assessment component inside a course offering. |
| `Mark` | Student marks for an assessment. |
| `AuditLog` | Audit trail entries. |
| `CourseOffering` | Term-specific instance of a subject. |
| `CourseOfferingClass` | Offering-to-section/faculty assignment. |
| `CourseOfferingMentor` | Offering-to-mentor assignment. |
| `CourseOfferingEnrollment` | Offering-specific enrollment, especially for electives. |

Important relationships:

- Subjects are reusable; course offerings are term-specific.
- Students are global records, not owned by a course.
- Regular offerings use assigned sections as scope.
- Elective offerings use offering-specific enrollment.
- Mentors operate at course offering scope.
- Faculty operate at assigned section scope.
- Marks belong to students and assessments.

## Data Flow Patterns

Most dashboard pages follow this pattern:

1. Server page checks authentication and role/workspace access.
2. Server loaders query Prisma with workspace-aware filters.
3. Client component receives serializable data and owns interaction state.
4. Server actions perform mutations and revalidate relevant paths.

Common workspace helpers:

- Use `getActiveWorkspaceState` when a page needs the current workspace context.
- Use `requireAuthenticatedWorkspaceState` plus `requireRealWorkspace` in server actions and protected loaders.
- Use `buildScopedStudentWhere` and `buildScopedSectionWhere` before querying role-sensitive student or section data.

## Common Change Targets

| Task | Start Here |
| --- | --- |
| Change sidebar or dashboard shell behavior | `src/app/dashboard/dashboard-shell.tsx` |
| Change workspace selection or role mode | `src/app/dashboard/workspace-selector.tsx`, `src/app/dashboard/workspace-actions.ts`, `src/lib/course-workspace.ts` |
| Change login behavior | `src/app/login/page.tsx`, `src/app/login/actions.ts`, auth configuration files |
| Change assessment totals or rounding | `src/lib/assessment-structure.ts` |
| Change grade rules | `src/lib/grade-rules.ts`, `src/app/dashboard/grading/client.tsx`, `src/app/dashboard/advanced-analytics/actions.ts` |
| Change class grading PDF | `src/app/dashboard/grading/class-report-pdf.ts` |
| Change section report data | `src/app/dashboard/reports/data.ts` |
| Change advanced charts | `src/app/dashboard/advanced-analytics/client.tsx` |
| Change Course Analytics tabs | `src/app/dashboard/analytics/workspace-shell.tsx` |
| Change marks entry | `src/app/dashboard/marks/client.tsx`, `src/app/dashboard/marks/actions.ts` |
| Change student import/master data | `src/app/dashboard/students/actions.ts`, `src/app/dashboard/students/queries.ts` |
| Change theme palettes | `src/lib/palette-theme.ts`, `src/components/palette-picker.tsx`, `src/app/globals.css` |
| Change chart colors | `src/lib/chart-theme.ts`, `src/app/globals.css` |

## Tests

| Path | Coverage |
| --- | --- |
| `src/lib/__tests__/*` | Shared helpers: workspace, roles, roll numbers, assessment structure, grade rules, themes, PDF export, etc. |
| `src/app/dashboard/*/*.test.ts` | Server action tests for dashboard workflows. |
| `tests/e2e/auth-smoke.spec.ts` | Playwright smoke checks for auth flow and route protection. |

Useful commands:

```bash
npx eslint <changed-files>
npx tsc --noEmit
npx vitest run <relevant-tests>
npm run build
npm run test:e2e
```

## Runtime And Environment

The app expects Supabase Postgres through Prisma:

- `DATABASE_URL` is used by the running app.
- `DIRECT_URL` is used by Prisma CLI operations.
- `AUTH_SECRET` and `AUTH_URL` configure NextAuth.

Do not commit `.env`, `.env.local`, generated PDF output, `.next`, local database files, or temporary exports.

The production build path is intentionally:

```bash
npm run build
```

That runs `next build --webpack` because Turbopack has been unstable for this project in some environments.

## Generated And Local-Only Areas

| Path | Notes |
| --- | --- |
| `.next/` | Next.js build/dev output. Do not commit. |
| `output/` | Generated PDFs and exports. Do not commit unless explicitly requested. |
| `tmp/` | Temporary local artifacts. |
| `.claude/` | Claude local worktrees/state. Do not treat as app source. |
| `dev.db`, `prisma/dev.db` | Local SQLite remnants. Current app target is Supabase Postgres. |

## Before Editing

- Read `AGENTS.md` for workflow rules.
- Check `git status --short`.
- Inspect existing patterns in the target area.
- Keep unrelated dirty files out of the change.
- Run the narrowest useful verification before handing work back.
