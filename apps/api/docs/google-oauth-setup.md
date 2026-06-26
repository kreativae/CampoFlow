# Configurando o login com Google

O CampoFlow ja tem todo o codigo do login via Google (OAuth2) pronto: backend
(`/auth/google`, `/auth/google/callback`, `/auth/google/status`) e o botao
"Entrar com Google" no painel web. Falta apenas criar um app OAuth no Google
Cloud e preencher as variaveis de ambiente — sem isso, o botao fica oculto e
as rotas respondem `503`.

## 1. Criar um projeto no Google Cloud Console

1. Acesse https://console.cloud.google.com/ e crie um projeto (ou use um existente).
2. No menu, vá em **APIs e Serviços > Tela de consentimento OAuth**.
   - Tipo de usuário: **Externo** (a menos que toda a empresa use Google Workspace).
   - Preencha nome do app, e-mail de suporte e domínios autorizados.
   - Escopos: `email` e `profile` (os unicos que o CampoFlow pede).
   - Em desenvolvimento, adicione os e-mails de teste em "Usuários de teste"
     (contas externas ao Workspace ficam limitadas até o app ser verificado).

## 2. Criar as credenciais OAuth

1. Vá em **APIs e Serviços > Credenciais > Criar credenciais > ID do cliente OAuth**.
2. Tipo de aplicativo: **Aplicativo da Web**.
3. **Origens JavaScript autorizadas**: a URL do painel web (ex.: `http://localhost:3100`
   em dev, ou o dominio de producao).
4. **URIs de redirecionamento autorizados**: a URL do callback do backend, ex.:
   `http://localhost:3000/auth/google/callback` em dev, ou
   `https://api.seudominio.com/auth/google/callback` em produção.
5. Salve e copie o **Client ID** e o **Client Secret** gerados.

## 3. Preencher as variáveis de ambiente

No `apps/api/.env` (nunca commitado — veja `.env.example`):

```bash
GOOGLE_CLIENT_ID="<client id copiado>"
GOOGLE_CLIENT_SECRET="<client secret copiado>"
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"
WEB_OAUTH_REDIRECT_URL="http://localhost:3100/oauth/callback"
```

Em produção, troque os domínios `localhost` pelos domínios reais da API e do
painel web (e cadastre essas mesmas URLs no passo 2 acima).

## 4. Reiniciar a API

Depois de preencher o `.env`, reinicie `npm run start:dev` (ou o processo em
produção). Confirme com:

```bash
curl http://localhost:3000/auth/google/status
# {"enabled":true}
```

O botão "Entrar com Google" passa a aparecer automaticamente em `/login` e
`/register` no painel web (ele consulta esse mesmo endpoint).

## Como funciona o vínculo de conta

- Login pelo Google com um e-mail que já tem cadastro por senha: a conta
  existente é vinculada (`googleId` é preenchido), e o usuário pode continuar
  entrando tanto por senha quanto pelo Google.
- Login pelo Google com um e-mail novo: cria uma conta sem senha local
  (`passwordHash` fica nulo). Essa conta só pode entrar pelo Google — tentar
  login por senha retorna 401 com uma mensagem explicando isso.
- MFA (autenticação em duas etapas) não é exigido no fluxo do Google: o
  próprio Google já autenticou o usuário do lado dele. Quem quiser MFA
  obrigatório em todo login deve usar a conta por senha.
