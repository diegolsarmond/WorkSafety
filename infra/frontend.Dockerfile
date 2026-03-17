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
# Copia o App Principal (frontend) - /worksafety
COPY --from=frontend-builder /build/dist /usr/share/nginx/html/worksafety

# Copia o Admin (WorkSafetyWeb) - /worksafety/admin
COPY --from=admin-builder /build/dist /usr/share/nginx/html/worksafety/admin

# Copia a configuração Nginx corrigida
COPY infra/nginx-prod.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
