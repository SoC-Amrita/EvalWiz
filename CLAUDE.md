# Claude Instructions

Use [AGENTS.md](./AGENTS.md) as the source of truth for this repository.

The most important local conventions are:

- Use the user's existing Git and GitHub credentials, not agent credentials.
- Follow the branch, push, PR, and merge workflow.
- Use branch prefixes such as `frontend/`, `backend/`, `feature/`, and `fix/`.
- Do not stage unrelated local changes.
- Preserve teammate deployment changes and never rewrite `main` history without explicit approval.

## AI Context Automation

Before work, read `PROJECT_MAP.md`, `ARCHITECTURE.md`, `TASK_LOG.md`, and `.repo-files.txt`.

Avoid broad repository scans unless those files do not contain enough context. Prefer the smallest relevant file set, and update `PROJECT_MAP.md` plus `TASK_LOG.md` when structure or functionality changes.
