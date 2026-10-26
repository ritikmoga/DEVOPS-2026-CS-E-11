
# syntax=docker/dockerfile:1

FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies first for better layer caching
COPY frontend/admin-client/package.json frontend/admin-client/package-lock.json ./
RUN npm ci --no-audit --no-fund

# Build the frontend
COPY frontend/admin-client/ ./
RUN npm run build


FROM nginx:1.27-alpine AS runtime

# Configure Nginx and serve the production build
COPY frontend/admin-client/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

ENV API_UPSTREAM=host.docker.internal:5000

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
