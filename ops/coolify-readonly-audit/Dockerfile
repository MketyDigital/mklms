FROM node:24-alpine

WORKDIR /audit
COPY ops/coolify-readonly-audit/package.json ./package.json
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund

WORKDIR /app
ENV NODE_ENV=production
COPY scripts/export-postgres-schema-catalog.mjs scripts/postgres-schema-catalog-selection.mjs scripts/verified-postgres-url.mjs scripts/run-coolify-pg-catalog-audit.mjs ./scripts/
COPY ops/coolify-readonly-audit/run.sh ./run.sh
RUN ln -s /audit/node_modules /app/node_modules && chmod 0555 /app/run.sh
USER node

EXPOSE 3000
CMD ["/app/run.sh"]
