# Stage 1: Build Frontend (Main App)
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Build Admin (WorkSafetyWeb)
FROM node:20-alpine AS admin-builder
WORKDIR /build
COPY WorkSafetyWeb/package*.json ./
RUN npm ci
COPY WorkSafetyWeb/ .
RUN npm run build

# Stage 3: Serve ambos via Nginx
FROM nginx:alpine
# Copia o App Principal (frontend) - raiz /
COPY --from=frontend-builder /build/dist /usr/share/nginx/html

# Copia o Admin (WorkSafetyWeb) - /admin
COPY --from=admin-builder /build/dist /usr/share/nginx/html/admin

# Copia a configuração Nginx para desenvolvimento local
COPY infra/nginx-local.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
