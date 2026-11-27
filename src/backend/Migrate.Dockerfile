# syntax=docker/dockerfile:1
# Migration image mytodoapp-migrate (SPEC 10.5, ADR-018). Build context: repository root
# (it needs infra/sql/grant-api-user.sql as well as src/backend):
#   docker build -f src/backend/Migrate.Dockerfile .

# go-sqlcmd, pinned and checksum-verified.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS sqlcmd
ARG SQLCMD_VERSION=1.11.0
ARG SQLCMD_SHA256=2e41111d2e00782d50b9f8887bf603890af1e85e308708703e4ce27dc3c410e7
ADD --checksum=sha256:${SQLCMD_SHA256} \
    https://github.com/microsoft/go-sqlcmd/releases/download/v${SQLCMD_VERSION}/sqlcmd-linux-amd64.tar.bz2 \
    /tmp/sqlcmd.tar.bz2
# The SDK image has no bzip2; it is needed only in this throwaway stage.
RUN apt-get update \
    && apt-get install -y --no-install-recommends bzip2 \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir /out && tar -xjf /tmp/sqlcmd.tar.bz2 -C /out sqlcmd && /out/sqlcmd --version

# The data model issue adds a stage here that runs
#   dotnet ef migrations bundle --self-contained -r linux-x64 -o /out/efbundle
# and copies /out/efbundle to /app/efbundle below. Until then the entrypoint skips the bundle step.

FROM mcr.microsoft.com/dotnet/runtime-deps:10.0 AS final
WORKDIR /app
COPY --from=sqlcmd /out/sqlcmd /usr/local/bin/sqlcmd
COPY infra/sql/grant-api-user.sql /app/sql/grant-api-user.sql
COPY --chmod=755 src/backend/migrate-entrypoint.sh /app/entrypoint.sh
# Non-root user built into the .NET images.
USER $APP_UID
ENTRYPOINT ["/app/entrypoint.sh"]
