# Local dev PostgreSQL for nestjs-recipe.
# Credentials are NOT baked in — scripts/db.sh passes them at `docker run` time.
FROM postgres:17

# *.sql / *.sh here run once, on first start with an empty data volume.
COPY init/ /docker-entrypoint-initdb.d/

HEALTHCHECK --interval=2s --timeout=3s --retries=30 \
  CMD pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" || exit 1
