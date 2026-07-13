'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { NotificationScheduleConfig } from '@/lib/types';

export default function AdminNotificationsPage() {
  const { accessToken } = useAuth();

  const [config, setConfig] = useState<NotificationScheduleConfig | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [frequency, setFrequency] = useState('HOURLY');
  const [enabled, setEnabled] = useState(true);

  const load = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await apiFetch<NotificationScheduleConfig>(
        '/admin/notificacoes/config',
        { token: accessToken },
      );
      setConfig(res);
      setFrequency(res.frequency);
      setEnabled(res.enabled);
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
      const res = await apiFetch<NotificationScheduleConfig>(
        '/admin/notificacoes/config',
        { method: 'PATCH', token: accessToken, body: { frequency, enabled } },
      );
      setConfig(res);
      setFrequency(res.frequency);
      setEnabled(res.enabled);
      setMessage('Configuração salva. A nova frequência já está em vigor.');
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
    <main className="animate-fade-up mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Notificações</h1>
        <p className="text-sm text-gray-500">
          Com que frequência o sistema varre as fazendas e gera as notificações automáticas
          (vacinas, tarefas da agenda e estoque de insumos). Vale para todas as propriedades.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
      )}

      <section className="rounded-lg border border-gray-200 p-4">
        <form onSubmit={handleSave} className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded-lg border-gray-300"
            />
            Geração automática ativada
          </label>

          <div>
            <label className="block text-xs font-medium text-gray-500">Frequência</label>
            <select
              value={frequency}
              disabled={!enabled}
              onChange={(e) => setFrequency(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 disabled:bg-gray-100 disabled:text-gray-400"
            >
              {config?.options.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Desativado, nenhuma notificação é gerada sozinha — os usuários ainda podem gerar
              manualmente pela tela de Notificações.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </form>

        {config && (
          <p className="mt-4 text-xs text-gray-400">
            Última atualização: {new Date(config.updatedAt).toLocaleString('pt-BR')}
          </p>
        )}
      </section>
    </main>
  );
}
