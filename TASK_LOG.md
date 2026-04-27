# Task Log

Compact running notes for important project work. Keep this newest-first, focused on decisions and behavior changes rather than command transcripts.

## Recent Changes

- 2026-04-28: Fixed medium-priority cleanup issues: removed incorrect Prisma casts, replaced grade-rule raw SQL with ORM calls, guarded academic setup data, deduplicated faculty loading, indexed audit logs, rejected non-finite marks, replaced dashboard `window.confirm` usages with design-system dialogs, and fixed dashboard sidebar hydration.
- 2026-04-28: Fixed high-priority security/data-integrity issues in elective roster authorization, dashboard audit log scope, student imports/restores, workspace cookies, JWT claim validation, and archived snapshot validation.
- 2026-04-28: Added server-action coverage for grade-rule authorization, workspace/account/user actions, last-admin deletion guard, and password enforcement; removed global hidden-preview state; relaxed global section-name uniqueness.
- 2026-04-28: Added project-level AI context automation scaffolding.

## Fixed Bugs / Regressions

- 2026-04-28: `uploadElectiveRoster` is now mentor-only; faculty and administrator role views cannot enroll elective rosters.
- 2026-04-28: Dashboard audit log queries now scope non-admin users to their own `userId` so faculty/mentor users do not see unrelated cross-workspace activity.
- 2026-04-28: `uploadStudents` stages row validation and performs student/enrollment writes inside one transaction, preventing mid-import database failures from leaving partial committed writes.
- 2026-04-28: `restoreArchivedStudent` now validates snapshot JSON at runtime before trusting fields, batches existence checks with `findMany`, and restores enrollments/marks with `createMany`.
- 2026-04-28: Workspace/admin/analysis-preview cookies now set `httpOnly: true` and `secure: true`.
- 2026-04-28: Auth session claims now validate JWT field types and default corrupted/missing `isAdmin` to `false`.
- 2026-04-28: Student management pages now use typed Prisma delegates directly instead of casting `studentDeletionRequest`/`archivedStudent` through `auditLog` delegate types.
- 2026-04-28: Advanced Analytics grade-rule reads/writes now use Prisma ORM (`courseOffering.findFirst/update`) instead of raw SQL.
- 2026-04-28: `getAcademicSetupData` now enforces admin access and reuses a single faculty query for both faculty-member and mentor option data.
- 2026-04-28: `AuditLog` now has indexes for latest-log and user-scoped latest-log queries.
- 2026-04-28: Mark saving rejects non-finite values such as `Infinity`.
- 2026-04-28: Dashboard destructive confirmations now use the local dialog system instead of `window.confirm`.
- 2026-04-28: Dashboard sidebar preference now uses `useSyncExternalStore`, avoiding localStorage hydration mismatch.
- 2026-04-28: `advanced-analytics/actions.ts`, `reports/actions.ts`, `workspace-actions.ts`, `users/actions.ts`, and `account-actions.ts` now have Vitest coverage for their critical server-action paths.
- 2026-04-28: Mentor-only grade rule updates are verified by tests; non-mentor role views cannot write grade rules.
- 2026-04-28: User deletion now has a regression test for the last-admin guard and self-delete guard.
- 2026-04-28: Admin password reset and own-account password change validation are covered for minimum length, required fields, confirmation mismatch, same-password rejection, incorrect current password, and successful hashing.
- 2026-04-28: Removed `window.__analysisPreviewState__` as hidden React state; the analysis preview sequence now lives in a component-owned `useRef` provider.
- 2026-04-28: Removed globally unique `Section.name`; section names can repeat across batches/courses, with indexes retained for lookup performance.

## Known Unfixed / Follow-Ups

- Apply the Prisma schema change to the target database with the normal deployment step (`npm run db:push` or the deployment equivalent) so the old global unique index on `Section.name` is removed outside local generated types.
- Audit logs still store scope metadata inside the JSON `details` string. Non-admin dashboard reads are safe by `userId`, but future cross-workspace audit views should add first-class indexed columns such as `offeringId` and `sectionId`.
- `uploadStudents` still reports per-row validation errors while committing valid rows atomically in one transaction. If the desired policy becomes all-or-nothing for validation errors too, convert validation errors into a transaction-aborting failure before writes.
- `academic-setup/actions.ts` and `students/actions.ts` still have comparatively low coverage because they are large, branch-heavy action files. Add focused tests when changing import/archive/offering behavior.
- The hidden analysis preview dialog still uses a browser event to notify the dialog after the sequence unlocks. This is no longer persisted as global state, but a future cleanup could move the open/close notification into context as well.
- Workspace student deletion requests still use a browser `window.prompt` for optional reason entry. It is not a confirm dialog, but it should eventually become a first-class dialog/form for accessibility and iframe compatibility.

## Notes For Future Agents

- Update this file when structure, workflow, deployment behavior, or user-visible functionality changes.
- Keep entries short and link to the relevant files or PRs when useful.
