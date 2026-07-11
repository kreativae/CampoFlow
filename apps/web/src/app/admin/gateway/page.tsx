'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';

interface StripeConfigStatus {
  configured: boolean;
  secretKeyMasked: string | null;
  webhookSecretSet: boolean;
  billingRedirectUrl: string | null;
  webhookEndpointUrl: string;
  nodeEnv: string;
}

function ChecklistItem({
  done,
  label,
  todoLabel = 'Pendente',
  children,
}: {
  done: boolean;
  label: string;
  todoLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}
        aria-hidden
      >
        {done ? '✓' : '!'}
      </span>
      <div>
        <p className="font-medium text-gray-800">
          {label}{' '}
          <span
            className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
              done ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {done ? 'OK' : todoLabel}
          </span>
        </p>
        <div className="mt-1 text-xs text-gray-600">{children}</div>
      </div>
    </li>
  );
}

export default function AdminGatewayPage() {
  const { accessToken } = useAuth();

  const [status, setStatus] = useState<StripeConfigStatus | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [secretKeyInput, setSecretKeyInput] = useState('');
  const [webhookSecretInput, setWebhookSecretInput] = useState('');

  const load = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await apiFetch<StripeConfigStatus>('/admin/stripe/config', {
        token: accessToken,
      });
      setStatus(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar configuração');
    } finally {
      setFetching(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/admin/stripe/config', {
        method: 'PATCH',
        token: accessToken,
        body: {
          ...(secretKeyInput ? { secretKey: secretKeyInput } : {}),
          ...(webhookSecretInput ? { webhookSecret: webhookSecretInput } : {}),
        },
      });
      setSecretKeyInput('');
      setWebhookSecretInput('');
      setMessage('Configuração salva.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  }

  if (fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Gateway de Pagamento</h1>
        <p className="text-sm text-gray-500">
          Credenciais do Stripe para processamento de assinaturas. As chaves salvas aqui têm
          prioridade sobre a variável de ambiente <code className="rounded bg-gray-100 px-1">STRIPE_SECRET_KEY</code>.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}

      {status && (
        <section className="mb-8 rounded border border-gray-200 p-4">
          <div className="mb-4 flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                status.configured ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm font-medium text-gray-700">
              Stripe {status.configured ? 'configurado' : 'não configurado'}
              {status.secretKeyMasked && ` · ${status.secretKeyMasked}`}
            </span>
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Secret Key (sk_…){' '}
                {status.secretKeyMasked && `· atual: ${status.secretKeyMasked}`}
              </label>
              <input
                type="password"
                value={secretKeyInput}
                onChange={(e) => setSecretKeyInput(e.target.value)}
                placeholder="Deixe em branco para manter o atual"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Webhook Signing Secret (whsec_…){' '}
                {status.webhookSecretSet && '· já definido'}
              </label>
              <input
                type="password"
                value={webhookSecretInput}
                onChange={(e) => setWebhookSecretInput(e.target.value)}
                placeholder="Deixe em branco para manter o atual"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar configuração'}
            </button>
          </form>
        </section>
      )}

      {status && (
        <section className="mb-8 rounded border border-gray-200 p-4">
          <h2 className="mb-1 text-sm font-semibold text-gray-700">Checklist para produção</h2>
          <p className="mb-3 text-xs text-gray-500">
            Ambiente atual: <strong>{status.nodeEnv}</strong>.
          </p>
          <ul className="space-y-3 text-sm">
            <ChecklistItem
              done={status.configured && status.webhookSecretSet}
              label="Credenciais do Stripe"
            >
              Salve a <strong>Secret Key</strong> e o <strong>Webhook Signing Secret</strong> no
              formulário acima. O secret é obrigatório em produção — sem ele o backend não
              consegue verificar a autenticidade dos webhooks.
            </ChecklistItem>

            <ChecklistItem
              done={Boolean(status.billingRedirectUrl)}
              label="URL de retorno pós-pagamento (WEB_BILLING_REDIRECT_URL)"
            >
              Defina a env{' '}
              <code className="rounded bg-gray-100 px-1">WEB_BILLING_REDIRECT_URL</code> no
              servidor com a URL pública do painel, como{' '}
              <code className="rounded bg-gray-100 px-1">
                https://app.campoflow.com/conta/assinatura
              </code>
              .{status.billingRedirectUrl && (
                <span className="mt-1 block text-xs text-gray-500">
                  Atual:{' '}
                  <code className="rounded bg-gray-100 px-1">{status.billingRedirectUrl}</code>
                </span>
              )}
            </ChecklistItem>

            <ChecklistItem
              done={false}
              label="Webhook cadastrado no painel do Stripe"
              todoLabel="Ação manual"
            >
              No{' '}
              <a
                href="https://dashboard.stripe.com/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Stripe Dashboard → Webhooks
              </a>
              , cadastre esta URL e ative os eventos{' '}
              <strong>checkout.session.completed</strong>,{' '}
              <strong>customer.subscription.updated</strong> e{' '}
              <strong>customer.subscription.deleted</strong>:
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-gray-100 px-2 py-1 text-xs">
                  {status.webhookEndpointUrl}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(status.webhookEndpointUrl);
                  }}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                >
                  Copiar
                </button>
              </div>
            </ChecklistItem>

            <ChecklistItem
              done={false}
              label="Price IDs dos planos (STRIPE_PRICE_ID_BASICO / STRIPE_PRICE_ID_PROFISSIONAL)"
              todoLabel="Ação manual"
            >
              No Stripe, crie os produtos e planos recorrentes e copie os Price IDs (
              <code className="rounded bg-gray-100 px-1">price_…</code>) para as variáveis de
              ambiente no servidor.
            </ChecklistItem>
          </ul>
        </section>
      )}
    </main>
  );
}
