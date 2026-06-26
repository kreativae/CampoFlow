'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Commodity, LatestQuotation, Quotation } from '@/lib/types';

const COMMODITY_OPTIONS: { value: Commodity; label: string }[] = [
  { value: 'BOI_GORDO', label: 'Boi Gordo' },
  { value: 'VACA_GORDA', label: 'Vaca Gorda' },
  { value: 'NOVILHA', label: 'Novilha' },
  { value: 'BEZERRO', label: 'Bezerro' },
  { value: 'REPOSICAO', label: 'Reposição' },
  { value: 'COURO', label: 'Couro' },
  { value: 'SEBO', label: 'Sebo' },
  { value: 'LEITE', label: 'Leite' },
  { value: 'MILHO', label: 'Milho' },
  { value: 'SOJA', label: 'Soja' },
  { value: 'SORGO', label: 'Sorgo' },
  { value: 'FARELO_SOJA', label: 'Farelo de Soja' },
];

function commodityLabel(commodity: Commodity) {
  return COMMODITY_OPTIONS.find((opt) => opt.value === commodity)?.label ?? commodity;
}

export default function QuotationsPage() {
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [latest, setLatest] = useState<LatestQuotation[]>([]);
  const [selectedCommodity, setSelectedCommodity] = useState<Commodity>('BOI_GORDO');
  const [history, setHistory] = useState<Quotation[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [formCommodity, setFormCommodity] = useState<Commodity>('BOI_GORDO');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('R$/@');
  const [source, setSource] = useState('');

  const loadHistory = useCallback(async (commodity: Commodity) => {
    try {
      const data = await apiFetch<Quotation[]>(`/cotacoes?commodity=${commodity}`, {
        token: accessToken,
      });
      setHistory(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar histórico');
    }
  }, [accessToken]);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const latestData = await apiFetch<LatestQuotation[]>('/cotacoes/recente', {
        token: accessToken,
      });
      setLatest(latestData);
      await loadHistory(selectedCommodity);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar cotações');
    } finally {
      setFetching(false);
    }
  }, [accessToken, loadHistory, selectedCommodity]);

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

  useEffect(() => {
    if (loading || !user) return;
    // Re-fetching when the user changes the commodity selector is the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHistory(selectedCommodity);
    // Only the commodity change should re-trigger this fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCommodity]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await apiFetch<Quotation>('/cotacoes', {
        method: 'POST',
        token: accessToken,
        body: { commodity: formCommodity, price: Number(price), unit, source: source || undefined },
      });
      setPrice('');
      setSource('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao lançar cotação');
    } finally {
      setCreating(false);
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
        <Link href="/fazendas" className="text-sm text-green-700 hover:underline">
          ← Propriedades
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">Cotações</h1>
        <p className="text-sm text-gray-500">
          Preços de mercado, lançados manualmente. Integração automática com fontes externas
          (Scot Consultoria, CEPEA, B3) é uma evolução futura.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <form
        onSubmit={handleCreate}
        className="mb-8 grid grid-cols-2 gap-3 rounded border border-gray-200 bg-white p-4 sm:grid-cols-4"
      >
        <div>
          <label className="text-xs font-medium text-gray-600">Produto</label>
          <select
            value={formCommodity}
            onChange={(e) => setFormCommodity(e.target.value as Commodity)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          >
            {COMMODITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Preço</label>
          <input
            type="number"
            step="0.01"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Unidade</label>
          <input
            type="text"
            required
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Fonte (opcional)</label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div className="col-span-full">
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {creating ? 'Salvando...' : 'Lançar cotação'}
          </button>
        </div>
      </form>

      <section className="mb-8">
        <h2 className="mb-3 font-semibold text-gray-800">Últimos preços</h2>
        {latest.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma cotação lançada ainda.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {latest.map((q) => (
              <li key={q.commodity} className="rounded border border-gray-200 bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  {commodityLabel(q.commodity)}
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {q.price} {q.unit}
                </p>
                {q.changePercent !== 0 && (
                  <p className={q.changePercent > 0 ? 'text-sm text-green-700' : 'text-sm text-red-600'}>
                    {q.changePercent > 0 ? '↑' : '↓'} {Math.abs(q.changePercent)}%
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Histórico</h2>
          <select
            value={selectedCommodity}
            onChange={(e) => setSelectedCommodity(e.target.value as Commodity)}
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-green-600 focus:outline-none"
          >
            {COMMODITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Sem registros para este produto.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {history.map((q) => (
              <li key={q.id}>
                {new Date(q.recordedAt).toLocaleDateString('pt-BR')} — {q.price} {q.unit}
                {q.source ? ` (${q.source})` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
