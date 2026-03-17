FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
# O WorkSafetyWeb precisa ser buildado (Vite)
RUN npm run build

# Stage 2: Serve
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Compile TypeScript
RUN npm ci --only=dev && npx tsc server.ts --target es2020 --module commonjs --moduleResolution node --skipLibCheck --strict false --esModuleInterop

EXPOSE 3001

CMD ["node", "server.js"]
