# Deploy: Railway (API) + Vercel (painel web)

Plano de baixo custo escolhido para o CampoFlow: Railway hospeda a API NestJS
junto com Postgres e Redis (tudo na mesma conta), e Vercel hospeda o painel
Next.js. Ambos têm free tier/hobby tier suficiente para começar.

## 1. API + Postgres + Redis no Railway

1. Crie uma conta em https://railway.app/ e um novo projeto.
2. **Adicionar o Postgres**: no projeto, clique em "New" > "Database" >
   "PostgreSQL". O Railway gera uma `DATABASE_URL` automaticamente — copie-a
   (ou referencie via variável `${{Postgres.DATABASE_URL}}` no serviço da API,
   como o Railway sugere).
3. **Adicionar o Redis**: mesma lógica, "New" > "Database" > "Redis". Copie
   a `REDIS_URL` gerada.
4. **Adicionar o serviço da API**: "New" > "GitHub Repo" (conecte o repositório
   do CampoFlow) ou "Empty Service" + deploy via CLI. Configure o **Root
   Directory** como `apps/api` (o Railway detecta o `Dockerfile` e o
   `railway.json` automaticamente nessa pasta).
5. Em **Variables** do serviço da API, preencha (além de `DATABASE_URL` e
   `REDIS_URL`, que podem referenciar os outros serviços):

   ```bash
   JWT_ACCESS_SECRET=<gerar um valor aleatorio forte>
   JWT_REFRESH_SECRET=<gerar outro valor aleatorio forte>
   JWT_ACCESS_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   ENCRYPTION_KEY=<64 hex chars - node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
   CORS_ORIGIN=https://<dominio-do-painel-na-vercel>
   PORT=3000
   ```

   E, conforme forem sendo configurados (opcionais, ver os outros guias em
   `docs/`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`,
   `WEB_OAUTH_REDIRECT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
   `R2_BUCKET`, `R2_ENDPOINT`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

6. O Railway expõe um domínio público (`*.up.railway.app`) automaticamente, ou
   você pode apontar um domínio próprio em **Settings > Networking**.
7. O Dockerfile já roda `prisma migrate deploy` antes de iniciar a API a cada
   deploy — não é necessário um passo manual de migration.

## 2. Painel web no Vercel

1. Crie uma conta em https://vercel.com/ e importe o repositório.
2. **Root Directory**: `apps/web` (Vercel detecta Next.js automaticamente,
   zero config adicional de build).
3. Em **Environment Variables**, adicione:

   ```bash
   NEXT_PUBLIC_API_URL=https://<dominio-publico-da-api-no-railway>
   ```

4. Faça o deploy. O Vercel já gera um domínio (`*.vercel.app`); um domínio
   próprio pode ser configurado em **Settings > Domains**.
5. Volte ao Railway e atualize `CORS_ORIGIN` da API com o domínio final do
   painel (Vercel ou domínio próprio), para a API aceitar requisições do
   front em produção.

## Ordem recomendada para o primeiro deploy

1. Railway: Postgres + Redis + serviço da API (com `JWT_*` e `ENCRYPTION_KEY`
   preenchidos; o resto pode ficar vazio por enquanto).
2. Vercel: painel web apontando para a URL pública da API do Railway.
3. Voltar ao Railway e ajustar `CORS_ORIGIN` com a URL final do Vercel.
4. Configurar Google OAuth, Cloudflare R2 e Resend quando/se forem
   necessários (cada um documentado em seu próprio guia em `docs/`) — nenhum
   deles é bloqueante para o primeiro deploy funcionar.

## Backups em produção

Os scripts em `scripts/backup-db.sh`/`restore-db.sh` foram escritos para uso
local (leem `DATABASE_URL` do `.env`). Em produção no Railway, a forma mais
simples é usar o backup automático nativo do Postgres do Railway (Settings do
serviço de banco > Backups), em vez de agendar esses scripts via cron contra
o banco de produção.
