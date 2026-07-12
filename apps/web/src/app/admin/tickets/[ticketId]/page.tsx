'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Ticket, TicketStatus } from '@/lib/types';

const STATUS_OPTIONS: TicketStatus[] = ['ABERTO', 'EM_ANDAMENTO', 'RESOLVIDO', 'FECHADO'];

export default function AdminTicketPage() {
  const { accessToken } = useAuth();
  const params = useParams<{ ticketId: string }>();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadTicket = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<Ticket>(`/admin/tickets/${params.ticketId}`, {
        token: accessToken,
      });
      setTicket(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar ticket');
    } finally {
      setFetching(false);
    }
  }, [accessToken, params.ticketId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTicket();
  }, [loadTicket]);

  async function handleReply(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const updated = await apiFetch<Ticket>(
        `/admin/tickets/${params.ticketId}/mensagens`,
        { method: 'POST', token: accessToken, body: { message: reply } },
      );
      setTicket(updated);
      setReply('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao enviar resposta');
    } finally {
      setSending(false);
    }
  }

  async function handleStatusChange(status: TicketStatus) {
    setUpdatingStatus(true);
    setError(null);
    try {
      const updated = await apiFetch<Ticket>(`/admin/tickets/${params.ticketId}/status`, {
        method: 'PATCH',
        token: accessToken,
        body: { status },
      });
      setTicket(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar status');
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  if (!ticket) {
    return (
      <main className="animate-fade-up mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <p className="text-red-700">{error ?? 'Ticket não encontrado.'}</p>
      </main>
    );
  }

  return (
    <main className="animate-fade-up mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Link href="/admin/tickets" className="text-sm text-emerald-700 hover:underline">
        ← Voltar para Tickets
      </Link>

      <header className="mt-2 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{ticket.subject}</h1>
          <p className="text-sm text-gray-500">
            {ticket.account.name} ({ticket.account.billingEmail}) · aberto por{' '}
            {ticket.createdBy.name}
          </p>
        </div>
        <select
          value={ticket.status}
          disabled={updatingStatus}
          onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
          className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <ul className="mb-6 space-y-3">
        {ticket.messages.map((msg) => (
          <li
            key={msg.id}
            className={`max-w-[85%] rounded-lg px-4 py-3 ${
              msg.fromStaff ? 'ml-auto bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
            }`}
          >
            <p
              className={`mb-1 text-xs font-medium ${
                msg.fromStaff ? 'text-gray-300' : 'text-gray-500'
              }`}
            >
              {msg.author.name} · {new Date(msg.createdAt).toLocaleString('pt-BR')}
            </p>
            <p className="whitespace-pre-wrap text-sm">{msg.message}</p>
          </li>
        ))}
      </ul>

      <form onSubmit={handleReply} className="space-y-3">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Responder como equipe CampoFlow"
          required
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {sending ? 'Enviando...' : 'Responder'}
        </button>
      </form>
    </main>
  );
}
