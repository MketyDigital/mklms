FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

COPY scripts/export-postgres-schema-catalog.mjs scripts/run-coolify-pg-catalog-audit.mjs ./scripts/
COPY ops/coolify-readonly-audit/run.sh ./run.sh
RUN chmod 0555 /app/run.sh

EXPOSE 3000
CMD ["/app/run.sh"]
