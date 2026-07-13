'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useConfirm } from '@/lib/confirm-context';
import type { Supply, SupplyMovement, SupplyMovementType } from '@/lib/types';

export default function SupplyDetailPage() {
  const { farmId, supplyId } = useParams<{ farmId: string; supplyId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();

  const [supply, setSupply] = useState<Supply | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [movementType, setMovementType] = useState<SupplyMovementType>('ENTRADA');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editingMovementId, setEditingMovementId] = useState<string | null>(null);
  const [editMovementType, setEditMovementType] = useState<SupplyMovementType>('ENTRADA');
  const [editQuantity, setEditQuantity] = useState('');
  const [editOccurredAt, setEditOccurredAt] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingMovement, setSavingMovement] = useState(false);

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

  function startEditMovement(movement: SupplyMovement) {
    setEditingMovementId(movement.id);
    setEditMovementType(movement.type);
    setEditQuantity(String(movement.quantity));
    setEditOccurredAt(movement.occurredAt.slice(0, 10));
    setEditNotes(movement.notes ?? '');
  }

  async function handleSaveMovement(movementId: string) {
    setSavingMovement(true);
    setError(null);
    try {
      await apiFetch(
        `/fazendas/${farmId}/insumos/${supplyId}/movimentacoes/${movementId}`,
        {
          method: 'PATCH',
          token: accessToken,
          body: {
            type: editMovementType,
            quantity: Number(editQuantity),
            occurredAt: editOccurredAt || undefined,
            notes: editNotes || undefined,
          },
        },
      );
      setEditingMovementId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar movimento');
    } finally {
      setSavingMovement(false);
    }
  }

  async function handleDeleteMovement(movement: SupplyMovement) {
    const ok = await confirm({
      title: 'Excluir movimento',
      message: 'Excluir este movimento? O estoque atual será ajustado de volta.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(
        `/fazendas/${farmId}/insumos/${supplyId}/movimentacoes/${movement.id}`,
        { method: 'DELETE', token: accessToken },
      );
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir movimento');
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
    <main className="animate-fade-up mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
      <header className="mb-8">
        <Link href={`/fazendas/${farmId}/insumos`} className="text-sm text-emerald-700 hover:underline">
          ← Insumos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{supply?.name}</h1>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <section className="mb-8">
        <SummaryCard label="Quantidade atual" value={`${supply?.currentQuantity} ${supply?.unit}`} />
      </section>

      <section className="mb-8 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Registrar movimento</h2>
        <form onSubmit={handleAddMovement} className="flex flex-wrap gap-2">
          <select
            value={movementType}
            onChange={(e) => setMovementType(e.target.value as SupplyMovementType)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          >
            <option value="ENTRADA">Entrada</option>
            <option value="SAIDA">Saída</option>
          </select>
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Quantidade"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <input
            type="text"
            placeholder="Observações (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
          >
            {submitting ? 'Salvando...' : 'Registrar'}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Movimentos</h2>
        {!supply?.movements || supply.movements.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum movimento registrado.</p>
        ) : (
          <ul className="space-y-2 text-sm text-gray-700">
            {supply.movements.map((m) =>
              editingMovementId === m.id ? (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-600 p-2"
                >
                  <select
                    value={editMovementType}
                    onChange={(e) =>
                      setEditMovementType(e.target.value as SupplyMovementType)
                    }
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  >
                    <option value="ENTRADA">Entrada</option>
                    <option value="SAIDA">Saída</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                  <input
                    type="date"
                    value={editOccurredAt}
                    onChange={(e) => setEditOccurredAt(e.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                  <input
                    type="text"
                    placeholder="Observações"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                  <button
                    type="button"
                    disabled={savingMovement}
                    onClick={() => handleSaveMovement(m.id)}
                    className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {savingMovement ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingMovementId(null)}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </li>
              ) : (
                <li key={m.id} className="flex items-center justify-between">
                  <span>
                    {new Date(m.occurredAt).toLocaleDateString('pt-BR')} —{' '}
                    {m.type === 'ENTRADA' ? '+' : '-'}
                    {m.quantity} {supply.unit}
                    {m.notes ? ` (${m.notes})` : ''}
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditMovement(m)}
                      className="text-xs font-medium text-emerald-700 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMovement(m)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}
