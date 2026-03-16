# Stage 1: Build Frontend (Main App)
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Build WorkSafetyWeb (Admin App)
FROM node:20-alpine AS admin-builder
WORKDIR /app
COPY WorkSafetyWeb/package*.json ./
RUN npm ci
COPY WorkSafetyWeb/ .
# O vite base /admin/ foi configurado para funcionar corretamente neste path
RUN npm run build

# Stage 3: Serve com Nginx
FROM nginx:alpine
# Copia o App Principal (frontend)
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
# Copia o Painel de Admin (WorkSafetyWeb) para a pasta /admin
COPY --from=admin-builder /app/dist /usr/share/nginx/html/admin

# Copia a configuração Nginx
COPY infra/nginx-docker.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
