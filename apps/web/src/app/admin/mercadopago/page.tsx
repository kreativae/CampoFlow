'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { MercadoPagoConfigStatus, MercadoPagoLog } from '@/lib/types';

const SOURCE_LABEL: Record<MercadoPagoConfigStatus['source'], string> = {
  banco: 'Definido no painel (banco de dados)',
  variavel_de_ambiente: 'Definido por variável de ambiente',
  nenhum: 'Não configurado',
};

const EVENT_LABEL: Record<MercadoPagoLog['event'], string> = {
  CREATE_SUBSCRIPTION: 'Criação de assinatura',
  CANCEL_SUBSCRIPTION: 'Cancelamento de assinatura',
  WEBHOOK: 'Webhook recebido',
  PAYMENT_HISTORY_FETCH: 'Consulta de histórico de pagamentos',
  CONFIG_UPDATED: 'Configuração atualizada',
};

export default function AdminMercadoPagoPage() {
  const { accessToken } = useAuth();

  const [status, setStatus] = useState<MercadoPagoConfigStatus | null>(null);
  const [logs, setLogs] = useState<MercadoPagoLog[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [accessTokenInput, setAccessTokenInput] = useState('');
  const [publicKeyInput, setPublicKeyInput] = useState('');
  const [webhookSecretInput, setWebhookSecretInput] = useState('');

  const load = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [statusRes, logsRes] = await Promise.all([
        apiFetch<MercadoPagoConfigStatus>('/admin/mercadopago/config', {
          token: accessToken,
        }),
        apiFetch<MercadoPagoLog[]>('/admin/mercadopago/logs', { token: accessToken }),
      ]);
      setStatus(statusRes);
      setLogs(logsRes);
      setPublicKeyInput(statusRes.publicKey ?? '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar configuração');
    } finally {
      setFetching(false);
    }
  }, [accessToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/admin/mercadopago/config', {
        method: 'PATCH',
        token: accessToken,
        body: {
          ...(accessTokenInput ? { accessToken: accessTokenInput } : {}),
          publicKey: publicKeyInput,
          ...(webhookSecretInput ? { webhookSecret: webhookSecretInput } : {}),
        },
      });
      setAccessTokenInput('');
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
        <h1 className="text-2xl font-semibold text-gray-900">Mercado Pago</h1>
        <p className="text-sm text-gray-500">
          Credenciais e logs de conexão com o Mercado Pago. O token salvo aqui tem
          prioridade sobre a variável de ambiente MERCADOPAGO_ACCESS_TOKEN.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">
          {message}
        </p>
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
              {status.configured ? 'Conectado' : 'Não conectado'} ·{' '}
              {SOURCE_LABEL[status.source]}
            </span>
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Access Token {status.accessTokenMasked && `(atual: ${status.accessTokenMasked})`}
              </label>
              <input
                type="password"
                value={accessTokenInput}
                onChange={(e) => setAccessTokenInput(e.target.value)}
                placeholder="Deixe em branco para manter o atual"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Public Key</label>
              <input
                type="text"
                value={publicKeyInput}
                onChange={(e) => setPublicKeyInput(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Webhook Secret {status.webhookSecretSet && '(já definido)'}
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

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Logs recentes</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum evento registrado ainda.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2">Evento</th>
                <th className="py-2">Mensagem</th>
                <th className="py-2">Status</th>
                <th className="py-2">Quando</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100">
                  <td className="py-2">{EVENT_LABEL[log.event]}</td>
                  <td className="py-2 text-gray-600">{log.message}</td>
                  <td className="py-2">
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        log.success
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {log.success ? 'Sucesso' : 'Falha'}
                    </span>
                  </td>
                  <td className="py-2 text-gray-500">
                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
