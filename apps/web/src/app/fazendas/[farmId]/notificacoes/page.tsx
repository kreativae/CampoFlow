'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { AppNotification, NotificationSource } from '@/lib/types';

const SOURCE_LABELS: Record<NotificationSource, string> = {
  SANIDADE: 'Sanidade',
  AGENDA: 'Agenda',
  INSUMOS: 'Insumos',
  CLIMA: 'Clima',
  OUTRO: 'Outro',
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

export default function NotificationsPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const loadData = useCallback(
    async (unreadOnly: boolean) => {
      setFetching(true);
      setError(null);
      try {
        const data = await apiFetch<AppNotification[]>(
          `/fazendas/${farmId}/notificacoes${unreadOnly ? '?unreadOnly=true' : ''}`,
          { token: accessToken },
        );
        setNotifications(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar notificações');
      } finally {
        setFetching(false);
      }
    },
    [farmId, accessToken],
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData(showUnreadOnly);
  }, [loading, user, loadData, router, showUnreadOnly]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/notificacoes/gerar`, {
        method: 'POST',
        token: accessToken,
      });
      await loadData(showUnreadOnly);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao gerar notificações');
    } finally {
      setGenerating(false);
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await apiFetch(`/fazendas/${farmId}/notificacoes/${id}/ler`, {
        method: 'PATCH',
        token: accessToken,
      });
      await loadData(showUnreadOnly);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao marcar como lida');
    }
  }

  async function handleMarkAllRead() {
    try {
      await apiFetch(`/fazendas/${farmId}/notificacoes/ler-todas`, {
        method: 'PATCH',
        token: accessToken,
      });
      await loadData(showUnreadOnly);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao marcar todas como lidas');
    }
  }

  if (loading || fetching) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href={`/fazendas/${farmId}`} className="text-sm text-blue-600 hover:underline">
            &larr; Voltar para a fazenda
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Notificações</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded bg-gray-200 px-3 py-2 text-sm hover:bg-gray-300 disabled:opacity-50"
          >
            {generating ? 'Gerando...' : 'Verificar alertas'}
          </button>
          <button
            onClick={handleMarkAllRead}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            Marcar todas como lidas
          </button>
        </div>
      </div>

      <p className="mb-4 text-xs text-gray-500">
        Apenas o canal de notificações no app é realmente entregue. Não há provedor de
        e-mail/SMS/push configurado neste ambiente, então esses canais ficam registrados como
        simulados.
      </p>

      <label className="mb-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showUnreadOnly}
          onChange={(e) => setShowUnreadOnly(e.target.checked)}
        />
        Mostrar apenas não lidas
      </label>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
          <p className="text-lg font-medium text-gray-700">Nenhuma notificação</p>
          <p className="mt-1 text-sm text-gray-500">Quando houver alertas de vacinação, vencimentos ou eventos, eles aparecerão aqui.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`rounded border p-4 ${n.read ? 'bg-white' : 'bg-blue-50 border-blue-200'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {SOURCE_LABELS[n.source]}
                    </span>
                    {!n.read && (
                      <span className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white">
                        Nova
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-medium">{n.title}</p>
                  <p className="text-sm text-gray-700">{n.message}</p>
                  <p className="mt-1 text-xs text-gray-400">{formatDateTime(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="shrink-0 rounded bg-gray-200 px-3 py-1 text-xs hover:bg-gray-300"
                  >
                    Marcar como lida
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
