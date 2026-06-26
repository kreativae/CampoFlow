'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Supply, SupplyMovementType } from '@/lib/types';

export default function SupplyDetailPage() {
  const { farmId, supplyId } = useParams<{ farmId: string; supplyId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [supply, setSupply] = useState<Supply | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [movementType, setMovementType] = useState<SupplyMovementType>('ENTRADA');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<Supply>(`/fazendas/${farmId}/insumos/${supplyId}`, {
        token: accessToken,
      });
      setSupply(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar o insumo');
    } finally {
      setFetching(false);
    }
  }, [farmId, supplyId, accessToken]);

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

  async function handleAddMovement(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/insumos/${supplyId}/movimentacoes`, {
        method: 'POST',
        token: accessToken,
        body: { type: movementType, quantity: Number(quantity), notes: notes || undefined },
      });
      setQuantity('');
      setNotes('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar movimento');
    } finally {
      setSubmitting(false);
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
        <Link href={`/fazendas/${farmId}/insumos`} className="text-sm text-green-700 hover:underline">
          ← Insumos
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">{supply?.name}</h1>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <section className="mb-8 grid grid-cols-2 gap-3">
        <SummaryCard label="Quantidade atual" value={`${supply?.currentQuantity} ${supply?.unit}`} />
        <SummaryCard label="Estoque mínimo" value={`${supply?.minimumQuantity} ${supply?.unit}`} />
      </section>

      <section className="mb-8 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Registrar movimento</h2>
        <form onSubmit={handleAddMovement} className="flex flex-wrap gap-2">
          <select
            value={movementType}
            onChange={(e) => setMovementType(e.target.value as SupplyMovementType)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          >
            <option value="ENTRADA">Entrada</option>
            <option value="SAIDA">Saída</option>
          </select>
          <input
            type="number"
            step="0.01"
            placeholder="Quantidade"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
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
            {submitting ? 'Salvando...' : 'Registrar'}
          </button>
        </form>
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Movimentos</h2>
        {!supply?.movements || supply.movements.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum movimento registrado.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {supply.movements.map((m) => (
              <li key={m.id}>
                {new Date(m.occurredAt).toLocaleDateString('pt-BR')} —{' '}
                {m.type === 'ENTRADA' ? '+' : '-'}
                {m.quantity} {supply.unit}
                {m.notes ? ` (${m.notes})` : ''}
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
