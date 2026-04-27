#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK_DIR="$ROOT/.git/hooks"
HOOK_PATH="$HOOK_DIR/pre-commit"

if [ ! -d "$ROOT/.git" ]; then
  echo "No .git directory found at $ROOT" >&2
  exit 1
fi

mkdir -p "$HOOK_DIR"

cat > "$HOOK_PATH" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

python3 scripts/update-ai-context.py
git add .repo-files.txt PROJECT_MAP.md ARCHITECTURE.md TASK_LOG.md AGENTS.md CLAUDE.md
HOOK

chmod +x "$HOOK_PATH"

echo "Installed AI context pre-commit hook at $HOOK_PATH"
