#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/team-kanban-board"
BACKUP_DIR="/opt/team-kanban-backups"
RELEASE_ROOT="/opt/team-kanban-releases"
COMPOSE_FILE="docker-compose.production.yml"
SHORT_SHA="${RELEASE_SHA:0:12}"
RELEASE_DIR="${RELEASE_ROOT}/${SHORT_SHA}"
BACKUP_PATH="${BACKUP_DIR}/pre-github-$(date -u +%Y%m%dT%H%M%SZ)-${SHORT_SHA}.tgz"
CANDIDATE_IMAGE="team-kanban-board-app:candidate-${SHORT_SHA}"
LIVE_IMAGE="team-kanban-board-app:latest"
OLD_IMAGE=""
SOURCE_SWITCHED=0
DEPLOY_FINISHED=0

compose() {
  docker compose --env-file .env.production -f "${COMPOSE_FILE}" "$@"
}

restore_previous_release() {
  if [[ "${SOURCE_SWITCHED}" -eq 1 && -f "${BACKUP_PATH}" ]]; then
    find "${APP_DIR}" -mindepth 1 -maxdepth 1 \
      ! -name '.env.production' \
      ! -name 'uploads' \
      -exec rm -rf -- {} +
    tar -xzf "${BACKUP_PATH}" -C "${APP_DIR}"
  fi

  if [[ -n "${OLD_IMAGE}" ]]; then
    docker tag "${OLD_IMAGE}" "${LIVE_IMAGE}"
    cd "${APP_DIR}"
    compose up -d --no-deps --no-build --force-recreate app scheduler || true
  fi
}

on_exit() {
  status=$?
  if [[ "${status}" -ne 0 && "${DEPLOY_FINISHED}" -ne 1 ]]; then
    echo "Deployment failed; restoring the previous application release." >&2
    restore_previous_release
  fi
  rm -f "${ARCHIVE_PATH}"
  rm -rf "${RELEASE_DIR}"
  exit "${status}"
}
trap on_exit EXIT

mkdir -p "${BACKUP_DIR}" "${RELEASE_ROOT}"
rm -rf "${RELEASE_DIR}"
mkdir -p "${RELEASE_DIR}"
tar -xzf "${ARCHIVE_PATH}" -C "${RELEASE_DIR}"

tar \
  --exclude='./.env.production' \
  --exclude='./uploads' \
  --exclude='./node_modules' \
  --exclude='./.next' \
  -czf "${BACKUP_PATH}" -C "${APP_DIR}" .

docker build --pull -t "${CANDIDATE_IMAGE}" "${RELEASE_DIR}"

if docker inspect team-kanban-app >/dev/null 2>&1; then
  OLD_IMAGE="$(docker inspect --format='{{.Image}}' team-kanban-app)"
fi

find "${APP_DIR}" -mindepth 1 -maxdepth 1 \
  ! -name '.env.production' \
  ! -name 'uploads' \
  -exec rm -rf -- {} +
cp -a "${RELEASE_DIR}/." "${APP_DIR}/"
SOURCE_SWITCHED=1

docker tag "${CANDIDATE_IMAGE}" "${LIVE_IMAGE}"
cd "${APP_DIR}"
compose up -d --no-deps --no-build --force-recreate app scheduler
compose exec -T app npx prisma migrate deploy

healthy=0
for _ in $(seq 1 30); do
  if docker exec team-kanban-app node -e \
    "fetch('http://127.0.0.1:3000/login').then(r => { if (!r.ok) process.exit(1) })" \
    >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 2
done

if [[ "${healthy}" -ne 1 ]]; then
  echo "The application did not pass its readiness check." >&2
  exit 1
fi

docker image rm "${CANDIDATE_IMAGE}" >/dev/null 2>&1 || true
DEPLOY_FINISHED=1
echo "Deployment ${SHORT_SHA} completed. Backup: ${BACKUP_PATH}"
