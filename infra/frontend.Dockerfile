# Stage 1: Build Frontend (Main App)
FROM node:20-alpine AS frontend-builder
WORKDIR /build

# Copy only package files first (better caching)
COPY frontend/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY frontend/ .

# Build
RUN npm run build && \
    rm -rf node_modules src public tsconfig.json vite.config.ts

# Stage 2: Build Admin (WorkSafetyWeb)
FROM node:20-alpine AS admin-builder
WORKDIR /build

# Copy only package files first (better caching)
COPY WorkSafetyWeb/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY WorkSafetyWeb/ .

# Build
RUN npm run build && \
    rm -rf node_modules src public tsconfig.json vite.config.ts

# Stage 3: Serve ambos via Nginx
FROM nginx:alpine

# Copy built assets
COPY --from=frontend-builder /build/dist /usr/share/nginx/html
COPY --from=admin-builder /build/dist /usr/share/nginx/html/admin

# Copy Nginx config
COPY infra/nginx-local.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
