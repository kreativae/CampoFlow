'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { AgendaAlert, AgendaEvent, AgendaEventType } from '@/lib/types';

const TYPE_OPTIONS: { value: AgendaEventType; label: string }[] = [
  { value: 'VACINACAO', label: 'Vacinação' },
  { value: 'PESAGEM', label: 'Pesagem' },
  { value: 'MANEJO', label: 'Manejo' },
  { value: 'COMPRA', label: 'Compra' },
  { value: 'VENDA', label: 'Venda' },
  { value: 'OUTRO', label: 'Outro' },
];

function typeLabel(type: AgendaEventType) {
  return TYPE_OPTIONS.find((opt) => opt.value === type)?.label ?? type;
}

export default function AgendaPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [alerts, setAlerts] = useState<AgendaAlert[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<AgendaEventType>('MANEJO');
  const [scheduledDate, setScheduledDate] = useState('');

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [eventsData, alertsData] = await Promise.all([
        apiFetch<AgendaEvent[]>(`/fazendas/${farmId}/agenda`, { token: accessToken }),
        apiFetch<AgendaAlert[]>(`/fazendas/${farmId}/agenda/alertas`, { token: accessToken }),
      ]);
      setEvents(eventsData);
      setAlerts(alertsData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar a agenda');
    } finally {
      setFetching(false);
    }
  }, [farmId, accessToken]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    // Fetching data on mount via an async callback is the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loading, user, loadData, router]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await apiFetch<AgendaEvent>(`/fazendas/${farmId}/agenda`, {
        method: 'POST',
        token: accessToken,
        body: { title, type, scheduledDate },
      });
      setTitle('');
      setScheduledDate('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar evento');
    } finally {
      setCreating(false);
    }
  }

  async function handleComplete(eventId: string) {
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/agenda/${eventId}/concluir`, {
        method: 'PATCH',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao concluir evento');
    }
  }

  if (loading || !user || fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8">
        <Link href={`/fazendas/${farmId}`} className="text-sm text-green-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">Agenda</h1>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {alerts.length > 0 && (
        <div className="mb-8 rounded border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-800">
            Pendentes (próximos 7 dias ou atrasados)
          </h2>
          <ul className="space-y-1 text-sm text-amber-900">
            {alerts.map((a) => (
              <li key={a.id}>
                {typeLabel(a.type)}: {a.title} —{' '}
                {new Date(a.scheduledDate).toLocaleDateString('pt-BR')}
                {a.overdue ? ' (atrasado)' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="mb-8 grid grid-cols-2 gap-3 rounded border border-gray-200 bg-white p-4 sm:grid-cols-4"
      >
        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-600">Título</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AgendaEventType)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Data</label>
          <input
            type="date"
            required
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div className="col-span-full">
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {creating ? 'Salvando...' : 'Criar evento'}
          </button>
        </div>
      </form>

      {events.length === 0 ? (
        <p className="text-gray-500">Nenhum evento registrado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3"
            >
              <div>
                <p className="font-medium text-gray-900">{e.title}</p>
                <p className="text-sm text-gray-500">
                  {typeLabel(e.type)} · {new Date(e.scheduledDate).toLocaleDateString('pt-BR')}
                  {e.completedAt ? ' · concluído' : ''}
                </p>
              </div>
              {!e.completedAt && (
                <button
                  onClick={() => handleComplete(e.id)}
                  className="text-xs font-medium text-green-700 hover:underline"
                >
                  Marcar como concluído
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
