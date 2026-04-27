# Agent Instructions

These instructions apply to coding agents working in this repository. They capture the development workflow used by the project owner and should be followed unless the user gives a newer, explicit instruction.

## Identity And Credentials

- Use the user's existing local Git and GitHub credentials for commits, pushes, pull requests, and merges.
- Do not configure or switch to an agent, bot, or vendor-specific Git identity.
- Do not modify `git config user.name`, `git config user.email`, credential helpers, remotes, or tokens unless the user explicitly asks.
- Never paste, store, or commit GitHub tokens, Supabase credentials, auth secrets, database URLs, or other secrets.
- If credentials are missing or an authenticated operation fails, stop and tell the user what failed instead of inventing alternate credentials.

## Git Workflow

- Do not push directly to `main` for code changes.
- Start from a clean understanding of the worktree:
  - run `git status --short`
  - inspect relevant diffs before staging
  - do not stage unrelated changes
- Use a branch-first workflow:
  - create a descriptive branch
  - commit the scoped change
  - push the branch
  - open a pull request
  - merge the pull request into `main`
  - return local checkout to `main` after merge
- Never force-push `main`.
- Do not rewrite history or amend commits unless the user explicitly asks.
- If upstream has changes, fetch and integrate them carefully. Preserve deployment or teammate changes unless the user explicitly asks to replace them.
- If accidental direct-to-main work happens, repair it transparently with a revert and branch-based re-application rather than hiding the history.

## Branch Naming

Use the project owner's branch naming style. Prefer these prefixes:

- `frontend/...` for UI, layout, client behavior, styling, and visual polish.
- `backend/...` for server actions, data loading, Prisma, calculations, auth, and persistence.
- `feature/...` for broader user-facing features that span multiple layers.
- `fix/...` for bug fixes, regressions, cleanup that stabilizes behavior, build fixes, and deployment fixes.
- `docs/...` for documentation-only changes.
- `chore/...` for maintenance that is not user-facing.

Examples:

```text
frontend/course-analytics-tabs
frontend/course-analytics-tab-polish
fix/course-analytics-tab-layout
backend/grand-total-rounding
feature/grading-class-report-pdf
```

Do not use `codex/...` or agent-name prefixes unless the user specifically requests them.

## Commit Style

Use short type-prefixed commit messages that match the branch category:

```text
frontend: consolidate analytics into tabs
frontend: polish course analytics tabs
fix: stabilize course analytics tabs
backend: round grand totals by 0.5 threshold
feature: add grading class report pdf export
```

Keep commits scoped. If there are unrelated local edits, leave them unstaged and mention them in the final response.

## Pull Requests

PRs should include:

- a concise summary of what changed
- verification commands that were run
- any relevant notes about intentionally excluded local changes

Merge the PR after creation when the user has asked for the full branch, push, PR, and merge flow.

## Local Changes And Teammate Work

- Assume a dirty worktree may contain user or teammate changes.
- Never revert changes you did not make unless the user explicitly asks.
- If a file you need to edit already has unrelated changes, read it carefully and work with the existing edits.
- If unrelated files are dirty, ignore them and keep your stage set precise.
- If upstream includes deployment fixes, preserve them and integrate around them.
- Before pushing, confirm that only intended files are staged.

## Verification

Choose checks based on the changed surface area. Common commands:

```bash
npx eslint <changed-files>
npx tsc --noEmit
npx vitest run <relevant-tests>
npm run build
```

Use focused checks for small UI changes, and broader checks for shared logic, grading, reports, Prisma, auth, or build/deployment changes.

For visual or PDF changes:

- regenerate the relevant output when possible
- visually inspect the generated report or page
- keep generated files out of commits unless the user explicitly wants them committed

## Runtime And Deployment Notes

- The production build command is intentionally `next build --webpack`.
- Turbopack has caused local/build instability in this project, especially around the CSS/PostCSS path. Prefer the webpack build path for deployment confidence.
- The app uses Supabase Postgres through Prisma. It does not use the Supabase JavaScript SDK in application code.
- Runtime database access uses `DATABASE_URL`; Prisma CLI operations use `DIRECT_URL`.
- `.env`, `.env.local`, exported PDFs, temporary files, `.next`, and generated artifacts should not be committed.
- If the local app cannot reach Supabase, diagnose connectivity and environment values before changing app logic.

## Project Architecture Notes

- Next.js App Router lives under `src/app`.
- Shared domain logic lives mostly under `src/lib`.
- Prisma schema lives at `prisma/schema.prisma`.
- Dashboard workspaces are role-aware: administrator, mentor, and faculty views have different scopes.
- Mentors own course-level grading rules.
- Faculty views are class/section scoped.
- Student records are global; course offerings and elective enrollments define course-specific scope.
- Reports, analytics, advanced analytics, and grading should respect the active workspace.

## UI And Product Style

- Preserve the existing design system and theme behavior.
- Prefer clear, work-focused dashboard UI over marketing-style layouts.
- Avoid adding explanatory text inside the app unless the user asks for it or the workflow truly needs it.
- Use lucide icons where appropriate.
- Keep dense academic data readable, aligned, and export-friendly.
- Watch for overlapping UI, cramped chart containers, and responsive text overflow.

## Secrets And Data Safety

- Do not print secrets unless the user explicitly asks and the context makes it necessary.
- If real credentials are exposed during debugging, remind the user to rotate them.
- Do not run destructive database or Git operations without explicit user approval.
- Avoid test or seed commands that can overwrite local academic data unless the user has asked for that reset.

## Current Known Workflow Preferences

- The user prefers branch, push, PR, and merge even for small changes.
- Branch names should use project categories such as `frontend`, `backend`, `feature`, or `fix`.
- Commits and PRs should be made using the user's credentials.
- Keep unrelated pending changes out of the PR.
- Mention any leftover local changes after a merge.

## AI Context Automation

- Before starting work, read `PROJECT_MAP.md`, `ARCHITECTURE.md`, `TASK_LOG.md`, and `.repo-files.txt` to get oriented.
- Avoid whole-repository scans unless the focused context files are insufficient.
- Use the smallest relevant file set for the task, then expand only when the code points you there.
- Run `npm run ai:context` after structural or functionality changes that affect the project map, architecture notes, task log, or file inventory.
- Update `PROJECT_MAP.md` when files, routes, modules, or ownership boundaries change.
- Update `TASK_LOG.md` when user-visible functionality, workflow decisions, or important implementation notes change.
