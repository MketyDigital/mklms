#!/bin/sh
set -eu

cd /app
export MKLMS_SCHEMA_AUDIT_DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
export PGAPPNAME=mklms-readonly-schema-audit
node scripts/run-coolify-pg-catalog-audit.mjs
unset DATABASE_URL MKLMS_SCHEMA_AUDIT_DATABASE_URL

node -e "require('node:http').createServer((req,res)=>{res.statusCode=200;res.setHeader('content-type','text/plain');res.end('ok')}).listen(3000,'0.0.0.0')"
