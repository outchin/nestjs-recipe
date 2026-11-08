# Local dev MySQL for nestjs-recipe.
# Credentials are NOT baked in — scripts/db.sh passes them at `docker run` time.
FROM mysql:8.4

COPY my.cnf /etc/mysql/conf.d/lab.cnf
# *.sql / *.sh here run once, on first start with an empty data volume.
COPY init/ /docker-entrypoint-initdb.d/

HEALTHCHECK --interval=2s --timeout=3s --retries=60 \
  CMD mysqladmin ping -h 127.0.0.1 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --silent || exit 1
