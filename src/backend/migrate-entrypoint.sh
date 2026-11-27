#!/bin/sh
# Entrypoint of the mytodoapp-migrate image (SPEC 10.5, ADR-018), run by caj-mytodoapp-migrate.
#   1. grant-api-user.sql: create the API's database user (idempotent).
#   2. EF Core migration bundle, if this image contains one.
#
# Environment (set by infra/apps.bicep; nothing secret):
#   SQL_SERVER, SQL_DATABASE       target server FQDN and database
#   SQL_CLIENT_ID                  client id of id-mytodoapp-migrate (Entra token via managed identity)
#   API_DB_USER, API_CLIENT_ID     name and client id of the API identity; step 1 is skipped when
#                                  API_CLIENT_ID is empty (local compose: SQL Server has no Entra users)
#   ConnectionStrings__AppDb       connection string for the bundle
set -eu

log() {
  printf '%s migrate: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

# Serverless SQL may be paused and needs up to ~1 minute to resume: retry a few times.
with_retry() {
  attempt=1
  until "$@"; do
    if [ "$attempt" -ge 5 ]; then
      log "giving up after $attempt attempts"
      return 1
    fi
    log "attempt $attempt failed; retrying in 20 s"
    attempt=$((attempt + 1))
    sleep 20
  done
}

if [ -n "${API_CLIENT_ID:-}" ]; then
  : "${SQL_SERVER:?SQL_SERVER is required}"
  : "${SQL_DATABASE:?SQL_DATABASE is required}"
  : "${SQL_CLIENT_ID:?SQL_CLIENT_ID is required}"
  log "granting database access to ${API_DB_USER:-id-mytodoapp-api}"
  with_retry sqlcmd \
    -S "tcp:${SQL_SERVER},1433" \
    -d "$SQL_DATABASE" \
    --authentication-method ActiveDirectoryManagedIdentity \
    -U "$SQL_CLIENT_ID" \
    -N true \
    -l 60 \
    -b \
    -i /app/sql/grant-api-user.sql \
    -v ApiDbUser="${API_DB_USER:-id-mytodoapp-api}" \
    -v ApiClientId="$API_CLIENT_ID"
else
  log "API_CLIENT_ID is not set: skipping the API database user grant (local development)"
fi

if [ -x /app/efbundle ]; then
  : "${ConnectionStrings__AppDb:?ConnectionStrings__AppDb is required}"
  log "applying EF Core migrations"
  /app/efbundle --connection "$ConnectionStrings__AppDb"
else
  # No DbContext yet; the data model issue adds the bundle stage to Migrate.Dockerfile.
  log "no EF Core migration bundle in this image: skipping schema migrations"
fi

log "done"
