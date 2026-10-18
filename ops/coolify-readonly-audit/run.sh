#!/bin/sh
set -eu

cd /app
export MKLMS_SCHEMA_AUDIT_DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
export PGAPPNAME=mklms-readonly-schema-audit
set +e
node scripts/run-coolify-pg-catalog-audit.mjs
audit_status=$?
set -e
if [ "$audit_status" -ne 0 ]; then
  echo "MKLMS_CATALOG_ERROR: PostgreSQL schema metadata export failed."
fi
unset DATABASE_URL MKLMS_SCHEMA_AUDIT_DATABASE_URL

node -e "require('node:http').createServer((req,res)=>{res.statusCode=200;res.setHeader('content-type','text/plain');res.end('ok')}).listen(3000,'0.0.0.0')"
