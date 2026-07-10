FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
# Usamos uma URL fake apenas para enganar a validação do schema durante o build
RUN DATABASE_URL="postgresql://fake:fake@fake:5432/fake" npx prisma generate
RUN npm run build || npx nest build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
RUN DATABASE_URL="postgresql://fake:fake@fake:5432/fake" npx prisma generate
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
