# Stage 1: Build Frontend (Main App)
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Serve com Nginx
FROM nginx:alpine
# Copia o App Principal (frontend)
COPY --from=builder /app/dist /usr/share/nginx/html

# Copia a configuração Nginx
COPY infra/nginx-docker.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
