'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useConfirm } from '@/lib/confirm-context';
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

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function buildCalendarGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();
  const cells: (Date | null)[] = Array(leadingBlanks).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function AgendaPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();

  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [alerts, setAlerts] = useState<AgendaAlert[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<AgendaEventType>('MANEJO');
  const [scheduledDate, setScheduledDate] = useState('');

  const [view, setView] = useState<'lista' | 'calendario'>('lista');
  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());

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

  async function handleDelete(event: AgendaEvent) {
    const ok = await confirm({
      title: 'Excluir evento',
      message: `Excluir o evento ${event.title}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/agenda/${event.id}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir evento');
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

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setView('lista')}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            view === 'lista' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Lista
        </button>
        <button
          type="button"
          onClick={() => setView('calendario')}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            view === 'calendario' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Calendário
        </button>
      </div>

      {view === 'calendario' && (
        <div className="mb-8 rounded border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const prev = new Date(calendarYear, calendarMonth - 1, 1);
                setCalendarMonth(prev.getMonth());
                setCalendarYear(prev.getFullYear());
              }}
              className="rounded px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              ← Anterior
            </button>
            <p className="font-semibold text-gray-800">
              {new Date(calendarYear, calendarMonth, 1).toLocaleDateString('pt-BR', {
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <button
              type="button"
              onClick={() => {
                const next = new Date(calendarYear, calendarMonth + 1, 1);
                setCalendarMonth(next.getMonth());
                setCalendarYear(next.getFullYear());
              }}
              className="rounded px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Próximo →
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500">
            {WEEKDAY_LABELS.map((d, i) => (
              <div key={i} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {buildCalendarGrid(calendarYear, calendarMonth).map((date, i) => {
              const dayEvents = date
                ? events.filter((e) => isSameDay(new Date(e.scheduledDate), date))
                : [];
              const isToday = date ? isSameDay(date, today) : false;
              return (
                <div
                  key={i}
                  className={`min-h-20 rounded border p-1 text-xs ${
                    date ? 'border-gray-200 bg-white' : 'border-transparent'
                  } ${isToday ? 'ring-2 ring-green-600' : ''}`}
                >
                  {date && (
                    <>
                      <p className="mb-1 font-medium text-gray-700">{date.getDate()}</p>
                      <ul className="space-y-0.5">
                        {dayEvents.map((e) => (
                          <li
                            key={e.id}
                            title={`${typeLabel(e.type)}: ${e.title}`}
                            className={`truncate rounded px-1 ${
                              e.completedAt
                                ? 'bg-gray-100 text-gray-500'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {e.title}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view !== 'lista' ? null : events.length === 0 ? (
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
              <div className="flex items-center gap-3">
                {!e.completedAt && (
                  <button
                    onClick={() => handleComplete(e.id)}
                    className="text-xs font-medium text-green-700 hover:underline"
                  >
                    Marcar como concluído
                  </button>
                )}
                <button
                  onClick={() => handleDelete(e)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
