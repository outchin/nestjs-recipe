#!/usr/bin/env bash
# Local database manager — start only the database the app is using.
#
#   ./scripts/db.sh up postgres     build image (if needed) + run + wait until healthy
#   ./scripts/db.sh down mysql      stop & remove container (data volume is KEPT)
#   ./scripts/db.sh reset mysql     down + delete data volume (fresh DB next `up`)
#   ./scripts/db.sh shell postgres  open psql / mysql client inside the container
#   ./scripts/db.sh logs mysql      follow logs
#   ./scripts/db.sh status          list nestjs-recipe DB containers
#   ./scripts/db.sh build postgres  force rebuild image
#
# Credentials/ports can be overridden with env vars (DB_USER, DB_PASSWORD, DB_NAME, PG_PORT, MYSQL_PORT).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREFIX="nestjs-recipe"
DB_USER="${DB_USER:-lab}"
DB_PASSWORD="${DB_PASSWORD:-lab}"
DB_NAME="${DB_NAME:-lab}"

usage() { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }

cmd="${1:-}"; db="${2:-}"
[[ -z "$cmd" ]] && usage

configure() {
  case "$db" in
    postgres)
      PORT="${PG_PORT:-5432}"; CPORT=5432
      DATA_DIR=/var/lib/postgresql/data
      ENV_ARGS=(-e POSTGRES_USER="$DB_USER" -e POSTGRES_PASSWORD="$DB_PASSWORD" -e POSTGRES_DB="$DB_NAME")
      SHELL_CMD=(psql -U "$DB_USER" -d "$DB_NAME")
      URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:$PORT/$DB_NAME" ;;
    mysql)
      PORT="${MYSQL_PORT:-3306}"; CPORT=3306
      DATA_DIR=/var/lib/mysql
      ENV_ARGS=(-e MYSQL_USER="$DB_USER" -e MYSQL_PASSWORD="$DB_PASSWORD" -e MYSQL_DATABASE="$DB_NAME"
                -e MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root}")
      SHELL_CMD=(mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME")
      URL="mysql://$DB_USER:$DB_PASSWORD@localhost:$PORT/$DB_NAME" ;;
    *) echo "Unknown or missing database: '$db' (use: postgres | mysql)"; exit 1 ;;
  esac
  IMAGE="$PREFIX/$db:local"
  CONTAINER="$PREFIX-$db"
  VOLUME="$PREFIX-$db-data"
}

exists()  { docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; }
running() { docker ps    --format '{{.Names}}' | grep -qx "$CONTAINER"; }

build() {
  echo "▶ building $IMAGE"
  docker build -t "$IMAGE" "$ROOT/docker/$db"
}

wait_healthy() {
  echo -n "▶ waiting for $CONTAINER to be healthy"
  for _ in $(seq 1 90); do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo missing)"
    [[ "$status" == healthy ]] && { echo " ✓"; return 0; }
    [[ "$status" == missing || "$status" == unhealthy ]] && break
    echo -n "."; sleep 1
  done
  echo " ✗ ($status)"; docker logs --tail 30 "$CONTAINER"; exit 1
}

up() {
  docker image inspect "$IMAGE" >/dev/null 2>&1 || build
  if running; then echo "✓ $CONTAINER already running"
  elif exists; then echo "▶ starting existing $CONTAINER"; docker start "$CONTAINER" >/dev/null
  else
    echo "▶ running $CONTAINER on localhost:$PORT"
    docker run -d \
      --name "$CONTAINER" \
      -p "$PORT:$CPORT" \
      -v "$VOLUME:$DATA_DIR" \
      "${ENV_ARGS[@]}" \
      --restart unless-stopped \
      "$IMAGE" >/dev/null
  fi
  wait_healthy
  echo
  echo "  DB_DRIVER=$db"
  echo "  $(echo "$db" | tr a-z A-Z)_URL=$URL"
}

down()  { exists && docker rm -f "$CONTAINER" >/dev/null && echo "✓ removed $CONTAINER (volume $VOLUME kept)" || echo "– $CONTAINER not present"; }
reset() { down; docker volume rm "$VOLUME" >/dev/null 2>&1 && echo "✓ deleted volume $VOLUME" || echo "– no volume $VOLUME"; }

case "$cmd" in
  status) docker ps -a --filter "name=$PREFIX-" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'; exit 0 ;;
  up|down|reset|logs|shell|build) configure ;;
  *) usage ;;
esac

case "$cmd" in
  up)    up ;;
  down)  down ;;
  reset) reset ;;
  build) build ;;
  logs)  docker logs -f "$CONTAINER" ;;
  shell) docker exec -it "$CONTAINER" "${SHELL_CMD[@]}" ;;
esac
