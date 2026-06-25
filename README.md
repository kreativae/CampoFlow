# CampoFlow

Plataforma de gestão para pecuaristas e produtores rurais.

## Estrutura

- `apps/api` — Backend NestJS + Prisma + PostgreSQL (em desenvolvimento)
- `apps/web` — Painel administrativo (futuro, Next.js)
- `apps/mobile` — App mobile (futuro, Flutter)

## Pré-requisitos de desenvolvimento

Este ambiente não tem Docker disponível, então Postgres e Redis rodam via Homebrew:

```bash
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis
```

Banco de desenvolvimento `campoflow` (usuário/senha `campoflow`) já criado localmente.
Se precisar recriar em outra máquina:

```bash
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
psql postgres -c "CREATE ROLE campoflow LOGIN PASSWORD 'campoflow';"
psql postgres -c "CREATE DATABASE campoflow OWNER campoflow;"
```

## Rodando a API

```bash
cd apps/api
cp .env.example .env   # ajuste se necessário
npm install
npx prisma migrate dev
npm run start:dev
```

Health check: `GET http://localhost:3000/health`
