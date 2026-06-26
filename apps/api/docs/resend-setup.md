# Configurando o envio de e-mail (Resend)

O módulo de Notificações já está pronto para enviar um e-mail de resumo dos
alertas (`EmailService`, em `src/common/email/`) sempre que `POST
/farms/:farmId/notifications/generate` encontra alertas novos para um usuário.
Sem `RESEND_API_KEY`, esse e-mail fica registrado como `SIMULATED` (a
notificação é criada normalmente, só não dispara o e-mail de fato).

## 1. Criar conta e domínio no Resend

1. Acesse https://resend.com/ e crie uma conta.
2. Em **Domains**, adicione o domínio que vai enviar os e-mails (ex.:
   `campoflow.app`) e configure os registros DNS (SPF/DKIM) que o Resend pedir.
   Sem isso, e-mails tendem a cair em spam ou ser rejeitados.
   - Para testar rapidamente sem domínio próprio, o Resend libera um endereço
     de teste (`onboarding@resend.dev`), mas só envia para o e-mail da própria
     conta cadastrada no Resend — útil só para validar a integração, não para
     uso real.
3. Em **API Keys**, crie uma chave (permissão de envio é suficiente).

## 2. Preencher as variáveis de ambiente

No `apps/api/.env`:

```bash
RESEND_API_KEY="<chave copiada>"
RESEND_FROM_EMAIL="CampoFlow <notificacoes@seudominio.com>"
```

O endereço em `RESEND_FROM_EMAIL` precisa ser de um domínio verificado no
passo 1 (ou o `onboarding@resend.dev` de teste).

## 3. Reiniciar a API

Depois de preencher o `.env`, reinicie o processo. Para confirmar, gere
alertas para uma fazenda com pendências (estoque baixo, vacina atrasada,
etc.) via `POST /farms/:farmId/notifications/generate` e confira em
`GET /farms/:farmId/notifications` se a notificação de canal `EMAIL` aparece
com `status: "SENT"` em vez de `"SIMULATED"`.

## Por que um e-mail por chamada, não um por alerta

Cada chamada a `generateFromAlerts` agrupa todos os alertas novos de um
usuário num único e-mail de resumo, em vez de disparar um e-mail por alerta.
Isso evita que uma fazenda com vários alertas pendentes inunde a caixa de
entrada do usuário a cada vez que o painel chama esse endpoint.
