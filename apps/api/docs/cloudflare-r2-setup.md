# Configurando o storage de arquivos (Cloudflare R2)

O módulo de Documentos já tem todo o código pronto para usar Cloudflare R2
(`StorageService` + `R2StorageProvider`, em `src/common/storage/`). Sem as
variáveis abaixo, ele usa disco local automaticamente (`apps/api/uploads/`) —
funciona em dev, mas não é confiável em produção (o disco some se o servidor
for recriado/redeployado).

## 1. Criar o bucket no Cloudflare

1. Acesse https://dash.cloudflare.com/ e vá em **R2 Object Storage**.
2. Crie um bucket (ex.: `campoflow-documents`). Pode ficar com as configurações
   padrão; não precisa de acesso público (os downloads passam pela API, não
   direto do bucket).
3. Em **Manage R2 API Tokens**, crie um token com permissão de
   leitura/escrita nesse bucket. Anote:
   - **Access Key ID**
   - **Secret Access Key**
   - O **endpoint da conta**, no formato `https://<account-id>.r2.cloudflarestorage.com`
     (o account-id aparece na própria tela do R2 no painel da Cloudflare).

## 2. Preencher as variáveis de ambiente

No `apps/api/.env`:

```bash
R2_ACCESS_KEY_ID="<access key id>"
R2_SECRET_ACCESS_KEY="<secret access key>"
R2_BUCKET="campoflow-documents"
R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
```

## 3. Reiniciar a API

Depois de preencher o `.env`, reinicie o processo. Não há um endpoint de
"status" como no Google OAuth — a troca de provider é automática e silenciosa:
se as quatro variáveis acima existirem, `StorageModule` usa `R2StorageProvider`;
caso contrário, usa o disco local. Para confirmar visualmente, basta fazer um
upload e checar no painel do bucket R2 se o arquivo apareceu.

## Migrando arquivos já existentes em disco local

Esta troca não migra automaticamente arquivos que já estavam no disco local
antes de configurar o R2 — eles continuam acessíveis (o `storagePath` salvo no
banco aponta para o disco), só os uploads novos vão para o R2. Para migrar o
histórico, seria necessário um script único que lê cada `Document.storagePath`
do disco e faz upload para o R2 com a mesma chave, depois atualiza nada (a
chave já é compatível) — não construído ainda porque depende de já existir um
bucket real para testar contra.
