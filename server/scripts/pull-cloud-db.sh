#!/usr/bin/env bash
# Snapshot the OCI Hono SQLite DB onto this machine.
# Usage (repo root):
#   OCI_SSH_HOST=your.vm.ip ./server/scripts/pull-cloud-db.sh
#
# Optional:
#   OCI_SSH_USER=ubuntu
#   OCI_SSH_KEY=~/.ssh/id_ed25519
#   OCI_SQLITE_PATH=~/portfolio-server/data/portfolio.db

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOCAL_DIR="$ROOT/server/data"
LOCAL_DB="$LOCAL_DIR/portfolio.db"

HOST="${OCI_SSH_HOST:?Set OCI_SSH_HOST to the VM hostname or IP}"
USER="${OCI_SSH_USER:-ubuntu}"
REMOTE_DB="${OCI_SQLITE_PATH:-~/portfolio-server/data/portfolio.db}"
REMOTE_TMP="/tmp/portfolio-cloud.db"

SSH=(ssh -o IdentitiesOnly=yes)
SCP=(scp -o IdentitiesOnly=yes)
if [[ -n "${OCI_SSH_KEY:-}" ]]; then
  SSH+=(-i "$OCI_SSH_KEY")
  SCP+=(-i "$OCI_SSH_KEY")
fi

TARGET="${USER}@${HOST}"

echo "Backing up ${TARGET}:${REMOTE_DB} …"

# Expand ~ on the VM, snapshot with SQLite backup API, then integrity-check.
"${SSH[@]}" "$TARGET" bash -s -- "$REMOTE_DB" "$REMOTE_TMP" <<'REMOTE'
set -euo pipefail
REMOTE_DB="$1"
REMOTE_TMP="$2"
case "$REMOTE_DB" in
  ~/*) REMOTE_DB="$HOME/${REMOTE_DB#~/}" ;;
esac
if [[ ! -f "$REMOTE_DB" ]]; then
  echo "Remote DB not found: $REMOTE_DB" >&2
  exit 1
fi
python3 -c 'import sqlite3, sys
src_path, dst_path = sys.argv[1], sys.argv[2]
src = sqlite3.connect(src_path)
dst = sqlite3.connect(dst_path)
src.backup(dst)
check = list(dst.execute("PRAGMA integrity_check"))
dst.close()
src.close()
if check != [("ok",)]:
    raise SystemExit("integrity_check failed: %s" % (check[:8],))
print("integrity_check: ok")
' "$REMOTE_DB" "$REMOTE_TMP"
ls -lh "$REMOTE_TMP"
REMOTE

mkdir -p "$LOCAL_DIR"
rm -f "$LOCAL_DB" "$LOCAL_DB-wal" "$LOCAL_DB-shm"

echo "Downloading snapshot → $LOCAL_DB"
"${SCP[@]}" "${TARGET}:${REMOTE_TMP}" "$LOCAL_DB"

echo "Done. Next:"
echo "  yarn --cwd server db:migrate"
echo "  yarn --cwd server dev"
