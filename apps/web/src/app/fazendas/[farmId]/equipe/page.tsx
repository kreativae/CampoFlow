'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Member, Shift, Task, TaskStatus, WorkLog } from '@/lib/types';

const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

export default function TeamPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  const [logDescription, setLogDescription] = useState('');
  const [logHours, setLogHours] = useState('');
  const [savingLog, setSavingLog] = useState(false);

  const [shiftUser, setShiftUser] = useState('');
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [savingShift, setSavingShift] = useState(false);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [tasksData, workLogsData, shiftsData] = await Promise.all([
        apiFetch<Task[]>(`/fazendas/${farmId}/tarefas`, { token: accessToken }),
        apiFetch<WorkLog[]>(`/fazendas/${farmId}/registros-trabalho`, { token: accessToken }),
        apiFetch<Shift[]>(`/fazendas/${farmId}/escalas`, { token: accessToken }),
      ]);
      setTasks(tasksData);
      setWorkLogs(workLogsData);
      setShifts(shiftsData);

      try {
        const membersData = await apiFetch<Member[]>(`/fazendas/${farmId}/membros`, {
          token: accessToken,
        });
        setMembers(membersData);
        setCanManage(true);
      } catch {
        setCanManage(false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar dados da equipe');
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

  async function handleCreateTask(event: FormEvent) {
    event.preventDefault();
    setSavingTask(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/tarefas`, {
        method: 'POST',
        token: accessToken,
        body: { title: taskTitle, assignedToId: taskAssignee || undefined },
      });
      setTaskTitle('');
      setTaskAssignee('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar tarefa');
    } finally {
      setSavingTask(false);
    }
  }

  async function handleUpdateStatus(taskId: string, status: TaskStatus) {
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/tarefas/${taskId}`, {
        method: 'PATCH',
        token: accessToken,
        body: { status },
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar tarefa');
    }
  }

  async function handleAddWorkLog(event: FormEvent) {
    event.preventDefault();
    setSavingLog(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/registros-trabalho`, {
        method: 'POST',
        token: accessToken,
        body: { description: logDescription, hoursWorked: Number(logHours) },
      });
      setLogDescription('');
      setLogHours('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar apontamento');
    } finally {
      setSavingLog(false);
    }
  }

  async function handleCreateShift(event: FormEvent) {
    event.preventDefault();
    setSavingShift(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/escalas`, {
        method: 'POST',
        token: accessToken,
        body: { userId: shiftUser, startDate: shiftStart, endDate: shiftEnd },
      });
      setShiftUser('');
      setShiftStart('');
      setShiftEnd('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar escala');
    } finally {
      setSavingShift(false);
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
        <h1 className="text-2xl font-semibold text-green-800">Equipe</h1>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <section className="mb-8 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Tarefas</h2>
        {canManage && (
          <form onSubmit={handleCreateTask} className="mb-4 flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Título da tarefa"
              required
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
            />
            <select
              value={taskAssignee}
              onChange={(e) => setTaskAssignee(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
            >
              <option value="">Não atribuída</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={savingTask}
              className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {savingTask ? 'Salvando...' : 'Criar tarefa'}
            </button>
          </form>
        )}
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma tarefa registrada.</p>
        ) : (
          <ul className="space-y-2 text-sm text-gray-700">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between">
                <span>
                  {t.title}
                  {t.assignedTo ? ` — ${t.assignedTo.name}` : ''} ({STATUS_LABELS[t.status]})
                </span>
                {t.status !== 'CONCLUIDA' && t.status !== 'CANCELADA' && (
                  <button
                    onClick={() => handleUpdateStatus(t.id, 'CONCLUIDA')}
                    className="text-xs font-medium text-green-700 hover:underline"
                  >
                    Marcar como concluída
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Apontamentos</h2>
        <form onSubmit={handleAddWorkLog} className="mb-4 flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Descrição do trabalho"
            required
            value={logDescription}
            onChange={(e) => setLogDescription(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Horas"
            required
            value={logHours}
            onChange={(e) => setLogHours(e.target.value)}
            className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={savingLog}
            className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {savingLog ? 'Salvando...' : 'Registrar'}
          </button>
        </form>
        {workLogs.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum apontamento registrado.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {workLogs.map((w) => (
              <li key={w.id}>
                {new Date(w.workDate).toLocaleDateString('pt-BR')} — {w.user.name}: {w.description} (
                {w.hoursWorked}h)
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Escalas</h2>
        {canManage && (
          <form onSubmit={handleCreateShift} className="mb-4 flex flex-wrap gap-2">
            <select
              value={shiftUser}
              onChange={(e) => setShiftUser(e.target.value)}
              required
              className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
            >
              <option value="">Selecione...</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              required
              value={shiftStart}
              onChange={(e) => setShiftStart(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
            />
            <input
              type="date"
              required
              value={shiftEnd}
              onChange={(e) => setShiftEnd(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={savingShift}
              className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {savingShift ? 'Salvando...' : 'Criar escala'}
            </button>
          </form>
        )}
        {shifts.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma escala registrada.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {shifts.map((s) => (
              <li key={s.id}>
                {s.user.name}: {new Date(s.startDate).toLocaleDateString('pt-BR')} até{' '}
                {new Date(s.endDate).toLocaleDateString('pt-BR')}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
