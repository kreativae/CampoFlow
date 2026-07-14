'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Ticket, TicketStatus } from '@/lib/types';

const STATUS_OPTIONS: { value: TicketStatus | 'TODOS'; label: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'ABERTO', label: 'Aberto' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'RESOLVIDO', label: 'Resolvido' },
  { value: 'FECHADO', label: 'Fechado' },
];

const STATUS_BADGE: Record<TicketStatus, string> = {
  ABERTO: 'bg-amber-50 text-amber-700',
  EM_ANDAMENTO: 'bg-blue-50 text-blue-700',
  RESOLVIDO: 'bg-emerald-50 text-emerald-700',
  FECHADO: 'bg-gray-100 text-gray-600',
};

export default function AdminTicketsPage() {
  const { accessToken } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'TODOS'>('TODOS');

  const loadTickets = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const query = statusFilter === 'TODOS' ? '' : `?status=${statusFilter}`;
      const data = await apiFetch<Ticket[]>(`/admin/tickets${query}`, {
        token: accessToken,
      });
      setTickets(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar tickets');
    } finally {
      setFetching(false);
    }
  }, [accessToken, statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTickets();
  }, [loadTickets]);

  return (
    <main className="animate-fade-up mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tickets de suporte</h1>
          <p className="text-sm text-gray-500">Tickets de todas as contas da plataforma.</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TicketStatus | 'TODOS')}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {fetching ? (
        <p className="text-gray-500">Carregando...</p>
      ) : tickets.length === 0 ? (
        <p className="text-gray-500">Nenhum ticket encontrado.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2">Assunto</th>
              <th className="py-2">Conta</th>
              <th className="py-2">Prioridade</th>
              <th className="py-2">Status</th>
              <th className="py-2">Atualizado em</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="border-b border-gray-100">
                <td className="py-2">
                  <Link
                    href={`/admin/tickets/${ticket.id}`}
                    className="font-medium text-gray-900 hover:underline"
                  >
                    {ticket.subject}
                  </Link>
                </td>
                <td className="py-2 text-gray-600">{ticket.account.name}</td>
                <td className="py-2 text-gray-600">{ticket.priority}</td>
                <td className="py-2">
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${STATUS_BADGE[ticket.status]}`}
                  >
                    {ticket.status}
                  </span>
                </td>
                <td className="py-2 text-gray-500">
                  {new Date(ticket.updatedAt).toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </main>
  );
}
