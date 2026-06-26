'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Pasture } from '@/lib/types';

export default function PastureDetailPage() {
  const { farmId, pastureId } = useParams<{ farmId: string; pastureId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [pasture, setPasture] = useState<Pasture | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [headCount, setHeadCount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<Pasture>(`/fazendas/${farmId}/pastagens/${pastureId}`, {
        token: accessToken,
      });
      setPasture(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar o pasto');
    } finally {
      setFetching(false);
    }
  }, [farmId, pastureId, accessToken]);

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

  async function handleEnter(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/pastagens/${pastureId}/ocupacoes`, {
        method: 'POST',
        token: accessToken,
        body: { headCount: Number(headCount), notes: notes || undefined },
      });
      setHeadCount('');
      setNotes('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar entrada de lote');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExit(occupationId: string) {
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/pastagens/${pastureId}/ocupacoes/${occupationId}/saida`, {
        method: 'PATCH',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar saída de lote');
    }
  }

  if (loading || !user || fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  const activeOccupations = pasture?.occupations?.filter((o) => o.exitedAt === null) ?? [];
  const occupiedHeadCount = activeOccupations.reduce((sum, o) => sum + o.headCount, 0);
  const pastOccupations = pasture?.occupations?.filter((o) => o.exitedAt !== null) ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8">
        <Link href={`/fazendas/${farmId}/pastagens`} className="text-sm text-green-700 hover:underline">
          ← Pastagens
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">{pasture?.name}</h1>
        <p className="text-sm text-gray-500">
          {pasture?.areaHectares} ha · {pasture?.grassType ?? 'Capim não informado'}
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <section className="mb-8 grid grid-cols-2 gap-3">
        <SummaryCard label="Capacidade" value={`${pasture?.animalCapacity ?? 0} animais`} />
        <SummaryCard label="Ocupação atual" value={`${occupiedHeadCount} animais`} />
      </section>

      <section className="mb-8 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Registrar entrada de lote</h2>
        <form onSubmit={handleEnter} className="flex flex-wrap gap-2">
          <input
            type="number"
            placeholder="Qtd. de animais"
            required
            value={headCount}
            onChange={(e) => setHeadCount(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Observações (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {submitting ? 'Salvando...' : 'Registrar entrada'}
          </button>
        </form>
      </section>

      <section className="mb-8 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Lotes no pasto</h2>
        {activeOccupations.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum lote no pasto atualmente.</p>
        ) : (
          <ul className="space-y-2 text-sm text-gray-700">
            {activeOccupations.map((o) => (
              <li key={o.id} className="flex items-center justify-between">
                <span>
                  {o.headCount} animais — desde {new Date(o.enteredAt).toLocaleDateString('pt-BR')}
                  {o.notes ? ` (${o.notes})` : ''}
                </span>
                <button
                  onClick={() => handleExit(o.id)}
                  className="text-xs font-medium text-green-700 hover:underline"
                >
                  Registrar saída
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Histórico de ocupação</h2>
        {pastOccupations.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum lote saiu deste pasto ainda.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {pastOccupations.map((o) => (
              <li key={o.id}>
                {o.headCount} animais — {new Date(o.enteredAt).toLocaleDateString('pt-BR')} até{' '}
                {o.exitedAt ? new Date(o.exitedAt).toLocaleDateString('pt-BR') : '—'}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}
