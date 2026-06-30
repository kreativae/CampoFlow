'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Ticket } from '@/lib/types';

const STATUS_LABEL: Record<Ticket['status'], string> = {
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em andamento',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
};

const STATUS_BADGE: Record<Ticket['status'], string> = {
  ABERTO: 'bg-amber-50 text-amber-700',
  EM_ANDAMENTO: 'bg-blue-50 text-blue-700',
  RESOLVIDO: 'bg-green-50 text-green-700',
  FECHADO: 'bg-gray-100 text-gray-600',
};

export default function SupportPage() {
  const { user, accessToken, loading, logout } = useAuth();
  const router = useRouter();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<Ticket['priority']>('MEDIA');
  const [creating, setCreating] = useState(false);

  const loadTickets = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<Ticket[]>('/suporte', { token: accessToken });
      setTickets(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar tickets');
    } finally {
      setFetching(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTickets();
  }, [loading, user, loadTickets, router]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await apiFetch<Ticket>('/suporte', {
        method: 'POST',
        token: accessToken,
        body: { subject, message, priority },
      });
      setSubject('');
      setMessage('');
      setPriority('MEDIA');
      await loadTickets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao abrir ticket');
    } finally {
      setCreating(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-green-800">Suporte</h1>
          <p className="text-sm text-gray-500">Olá, {user.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/fazendas" className="text-sm font-medium text-green-700 hover:underline">
            Painel
          </Link>
          <button
            onClick={logout}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Sair
          </button>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleCreate} className="mb-8 space-y-3 rounded border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700">Abrir novo ticket</h2>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Assunto"
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Descreva o problema ou dúvida"
          required
          rows={3}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Ticket['priority'])}
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-green-600 focus:outline-none"
          >
            <option value="BAIXA">Prioridade baixa</option>
            <option value="MEDIA">Prioridade média</option>
            <option value="ALTA">Prioridade alta</option>
          </select>
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {creating ? 'Enviando...' : 'Abrir ticket'}
          </button>
        </div>
      </form>

      <h2 className="mb-3 text-sm font-semibold text-gray-700">Meus tickets</h2>
      {fetching ? (
        <p className="text-gray-500">Carregando...</p>
      ) : tickets.length === 0 ? (
        <p className="text-gray-500">Nenhum ticket aberto ainda.</p>
      ) : (
        <ul className="space-y-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/suporte/${ticket.id}`}
                className="flex items-center justify-between rounded border border-gray-200 px-4 py-3 hover:border-green-600"
              >
                <div>
                  <p className="font-medium text-gray-900">{ticket.subject}</p>
                  <p className="text-xs text-gray-400">
                    Atualizado em {new Date(ticket.updatedAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <span
                  className={`rounded px-2 py-1 text-xs font-medium ${STATUS_BADGE[ticket.status]}`}
                >
                  {STATUS_LABEL[ticket.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
