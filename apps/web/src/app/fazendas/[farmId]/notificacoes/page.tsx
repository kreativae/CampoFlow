'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Bell, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useConfirm } from '@/lib/confirm-context';
import { useToast } from '@/lib/toast-context';
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
  const confirm = useConfirm();
  const { toastSuccess } = useToast();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
        setSelected(new Set());
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

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === notifications.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(notifications.map((n) => n.id)));
    }
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    const ok = await confirm({
      title: 'Excluir notificações',
      message: `Excluir ${selected.size} notificação(ões) selecionada(s)? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/notificacoes/lote`, {
        method: 'DELETE',
        token: accessToken,
        body: { ids: Array.from(selected) },
      });
      toastSuccess(`${selected.size} notificação(ões) excluída(s).`);
      await loadData(showUnreadOnly);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir notificações');
    }
  }

  if (loading || fetching) {
    return <div className="p-8">Carregando...</div>;
  }

  const allSelected = notifications.length > 0 && selected.size === notifications.length;

  return (
    <div className="animate-fade-up mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <PageHeader
        icon={Bell}
        title="Notificações"
        subtitle="Alertas e avisos da propriedade"
        backHref={`/fazendas/${farmId}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50 disabled:opacity-50"
            >
              {generating ? 'Gerando...' : 'Verificar alertas'}
            </button>
            <button
              onClick={handleMarkAllRead}
              className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-emerald-800"
            >
              Marcar todas como lidas
            </button>
          </div>
        }
      />

      <p className="mb-4 text-xs text-gray-500">
        Apenas o canal de notificações no app é realmente entregue. Não há provedor de
        e-mail/SMS/push configurado neste ambiente, então esses canais ficam registrados como
        simulados.
      </p>

      <div className="mb-4 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showUnreadOnly}
            onChange={(e) => setShowUnreadOnly(e.target.checked)}
          />
          Mostrar apenas não lidas
        </label>

        {selected.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-red-700"
          >
            <Trash2 size={14} />
            Excluir {selected.size} selecionada{selected.size > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
          <p className="text-lg font-medium text-gray-700">Nenhuma notificação</p>
          <p className="mt-1 text-sm text-gray-500">Quando houver alertas de vacinação, vencimentos ou eventos, eles aparecerão aqui.</p>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="rounded border-gray-300"
              />
              Selecionar todas
            </label>
          </div>

          <ul className="space-y-2">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`flex gap-3 rounded-xl border px-4 py-3 transition-all duration-200 hover:shadow-md ${
                  selected.has(n.id)
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : n.read
                      ? 'border-gray-200/80 bg-white shadow-sm'
                      : 'border-blue-200 bg-blue-50'
                }`}
              >
                <div className="flex items-start pt-1">
                  <input
                    type="checkbox"
                    checked={selected.has(n.id)}
                    onChange={() => toggleSelect(n.id)}
                    className="rounded border-gray-300"
                  />
                </div>
                <div className="flex flex-1 items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {SOURCE_LABELS[n.source]}
                      </span>
                      {!n.read && (
                        <span className="rounded-lg bg-blue-600 px-2 py-0.5 text-xs text-white">
                          Nova
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-medium text-gray-900">{n.title}</p>
                    <p className="text-sm text-gray-700">{n.message}</p>
                    <p className="mt-1 text-xs text-gray-400">{formatDateTime(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="shrink-0 rounded-lg bg-gray-200 px-3 py-1 text-xs hover:bg-gray-300"
                    >
                      Marcar como lida
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
