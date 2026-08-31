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
EXPOSE 5000
CMD ["node", "dist/src/server.js"]
