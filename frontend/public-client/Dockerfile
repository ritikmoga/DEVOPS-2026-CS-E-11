# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/public-client/package.json frontend/public-client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/public-client/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
