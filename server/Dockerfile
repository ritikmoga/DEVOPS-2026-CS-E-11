# syntax=docker/dockerfile:1
FROM node:20-alpine AS dependencies
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS build
COPY server/prisma ./prisma
RUN npx prisma generate --schema prisma/schema.prisma

FROM node:20-alpine AS runtime
WORKDIR /app/server
ENV NODE_ENV=production
ENV PORT=5000
COPY --from=build /app/server/node_modules ./node_modules
COPY server/package.json ./package.json
COPY server/prisma ./prisma
COPY server/dist ./dist
RUN chown -R node:node /app/server
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:5000/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/src/server.js"]
