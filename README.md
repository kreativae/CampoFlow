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
Documentação interativa (Swagger): `http://localhost:3000/docs`

## Testes

```bash
cd apps/api
npm run lint:check   # CI-safe, sem --fix
npm run test         # unit
npm run test:e2e     # e2e (requer Postgres rodando)
```

## CI/CD

O workflow [.github/workflows/api-ci.yml](.github/workflows/api-ci.yml) roda lint, build,
testes unitários, testes e2e (com Postgres em container de serviço) e a build da imagem
Docker de produção em cada push/PR para `apps/api`.

## Deploy (Docker)

```bash
cd apps/api
docker build -t campoflow-api .
docker run -p 3000:3000 --env-file .env campoflow-api
```

O container roda `prisma migrate deploy` automaticamente antes de iniciar a API.
Não foi possível testar a build da imagem neste ambiente (Docker não está instalado);
validar em um ambiente com Docker antes do primeiro deploy real.
