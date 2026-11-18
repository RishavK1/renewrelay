#!/bin/sh
set -eu

# This is used only by the local throwaway PostgreSQL service.
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
CREATE ROLE renewrelay_app LOGIN PASSWORD 'local_app';
CREATE ROLE renewrelay_auth LOGIN PASSWORD 'local_auth';
CREATE ROLE renewrelay_worker LOGIN PASSWORD 'local_worker';
SQL
