# Contributing to EvalWiz

Thanks for wanting to improve EvalWiz. This project is still evolving quickly, so good contributions are not just code changes; they also preserve the product's academic workflow, data safety, and deployment reliability.

## License

EvalWiz is licensed under the Apache License 2.0. By contributing, you agree that your contribution will be licensed under the same license.

## Before You Start

Read these orientation files before making changes:

- `README.md` for setup and product context
- `PROJECT_MAP.md` for where things live
- `ARCHITECTURE.md` for system boundaries and data flow
- `TASK_LOG.md` for recent decisions and known follow-ups
- `AGENTS.md` if you are using an AI coding assistant

Prefer the smallest relevant file set. Avoid whole-repository scans unless the focused docs and target files are not enough.

## Local Setup

Install dependencies:

```bash
npm install
```

Create a local environment file from the safe template:

```bash
cp .env.example .env
```

Fill in your own Supabase and database values. Do not reuse or commit someone else's secrets.

Prepare the database when needed:

```bash
npm run db:push
npm run db:seed
```

Run the app:

```bash
npm run dev
```

Use the webpack build path for production confidence:

```bash
npm run build
```

## Branches And Commits

Do not push directly to `main`.

Use descriptive branch prefixes:

- `frontend/...` for UI, layout, styling, and client behavior
- `backend/...` for server actions, data loading, Prisma, auth, and persistence
- `feature/...` for user-facing work that spans multiple layers
- `fix/...` for bugs, regressions, dependency/security patches, and stabilization
- `docs/...` for documentation-only changes
- `chore/...` for maintenance

Use short type-prefixed commits, for example:

```text
fix: patch prisma effect advisory
docs: add contributing guidelines
frontend: polish course analytics tabs
backend: round grand totals by threshold
```

Keep commits scoped. If your worktree has unrelated local changes, leave them unstaged.

## Pull Requests

Open a pull request into `main` for every change.

PRs should include:

- what changed
- why it changed
- verification commands that were run
- any intentional exclusions or follow-ups

Wait for CI and preview checks before merging. If checks fail, fix the cause rather than bypassing them.

## Verification

Choose checks based on the changed surface area.

For small docs-only changes:

```bash
git diff --check
```

For TypeScript, server-action, Prisma, auth, grading, report, or shared logic changes:

```bash
npx tsc --noEmit
npm test
npm run build
```

For focused test updates:

```bash
npx vitest run path/to/test.ts
```

For lint-sensitive UI or source changes:

```bash
npm run lint
```

For Prisma changes:

```bash
npx prisma generate
```

For PDF, report, or visual changes, regenerate the relevant output and inspect it before opening the PR. Do not commit generated PDFs or temporary exports unless explicitly requested.

## Data And Secrets Safety

Never commit:

- `.env` or `.env.local`
- Supabase service-role keys
- database URLs or passwords
- auth secrets
- generated reports, PDFs, or temporary exports
- `.next`, `output`, `tmp`, coverage, or local runtime artifacts

Supabase Auth and Prisma are both used in this project. `SUPABASE_SERVICE_ROLE_KEY` must stay server-side only. Any script that uses it should be treated as privileged.

Do not run destructive database, seed, purge, or migration commands against shared data unless the task explicitly calls for it and the target environment is clear.

## Architecture Expectations

Preserve the core workspace model:

- administrators have global setup and management flows
- mentors own course-offering-level grading rules and analytics
- faculty views are class/section scoped
- students are global records
- regular courses scope through assigned sections
- electives scope through offering enrollments

Use shared helpers in `src/lib` for workspace access, role checks, grading rules, report math, assessment calculations, and labels. Avoid duplicating critical calculation or authorization logic inside large client components.

## UI And Product Expectations

EvalWiz should feel like a focused academic workspace, not a generic admin template.

When changing UI:

- preserve the existing design system and theme behavior
- keep dense tables readable
- avoid overlapping controls and cramped chart containers
- avoid adding explanatory text unless the workflow truly needs it
- ensure exports and reports remain formal, aligned, and readable

## AI Context Files

If your change affects routes, modules, architecture, workflow decisions, or file inventory, update the relevant context files:

- `PROJECT_MAP.md`
- `ARCHITECTURE.md`
- `TASK_LOG.md`
- `.repo-files.txt`

Run:

```bash
npm run ai:context
```

This keeps future contributors and AI assistants from rediscovering the same context from scratch.

