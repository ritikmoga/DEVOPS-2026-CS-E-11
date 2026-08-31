# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/admin-client/package.json frontend/admin-client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/admin-client/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
