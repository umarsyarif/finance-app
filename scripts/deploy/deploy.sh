#!/usr/bin/env bash
# Production deploy, run on the VPS by the GitHub Actions deploy key only.
# ~/.ssh/authorized_keys forces this script for that key, so:
#   $SSH_ORIGINAL_COMMAND  the version tag being deployed (e.g. v1.4.0)
#   stdin                  a tar.gz with backend/ (source) and client-dist/ (built frontend)
# Never prints anything from backend/.env: the Actions log is public.
set -euo pipefail

APP=/home/ubuntu/finance-app
WEB=/var/www/finance
API=http://127.0.0.1:4100/api/healthchecker

TAG="${SSH_ORIGINAL_COMMAND:-}"
[[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Refusing: '$TAG' is not a version tag" >&2; exit 2; }

exec 9>"$APP/.deploy.lock"
flock -n 9 || { echo "Another deploy is running" >&2; exit 3; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
tar -xzf - -C "$WORK"
[[ -f "$WORK/backend/package.json" && -f "$WORK/client-dist/index.html" ]] || { echo "Bundle is incomplete" >&2; exit 4; }

echo "== $TAG: database backup"
mkdir -p "$APP/backups" && chmod 700 "$APP/backups"
DB_URL=$(grep '^DATABASE_URL=' "$APP/backend/.env" | cut -d= -f2- | tr -d '"'"'")
pg_dump --format=custom --dbname="${DB_URL%%\?*}" --file="$APP/backups/$TAG-$(date +%Y%m%d-%H%M%S).dump"
ls -1t "$APP"/backups/*.dump | tail -n +6 | xargs -r rm --

echo "== $TAG: backend"
rsync -a --delete --exclude '.env*' --exclude node_modules --exclude build "$WORK/backend/" "$APP/backend/"
cd "$APP/backend"
npm ci --no-audit --no-fund --loglevel=error
npx prisma generate >/dev/null
npm run build >/dev/null
# Migrations run in the service's ExecStartPre
systemctl --user restart finance-api
for _ in $(seq 30); do curl -fsS "$API" >/dev/null 2>&1 && break; sleep 2; done
curl -fsS "$API" >/dev/null || { echo "Backend did not come back healthy" >&2; exit 5; }

echo "== $TAG: frontend"
rsync -a --delete "$WORK/client-dist/" "$WEB/"

echo "$TAG" > "$APP/DEPLOYED_VERSION"
echo "== $TAG deployed"
