'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { BrazilianState, Commodity, LatestQuotation, Quotation } from '@/lib/types';

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
  { value: 'MERCADO_FUTURO', label: 'Mercado Futuro' },
  { value: 'BOI_MUNDO', label: 'Boi no Mundo' },
  { value: 'ATACADO', label: 'Atacado' },
  { value: 'EQUIVALENTES', label: 'Equivalentes' },
];

const STATE_OPTIONS: { value: BrazilianState; label: string }[] = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];

const ALL_STATES_FILTER = 'TODOS';
const NATIONAL_FILTER = 'NACIONAL';
type StateFilter = BrazilianState | typeof ALL_STATES_FILTER | typeof NATIONAL_FILTER;

function commodityLabel(commodity: Commodity) {
  return COMMODITY_OPTIONS.find((opt) => opt.value === commodity)?.label ?? commodity;
}

function stateLabel(state: BrazilianState | null) {
  if (!state) return 'Nacional';
  return STATE_OPTIONS.find((opt) => opt.value === state)?.label ?? state;
}

// Simple inline line chart (no chart library dependency) for a single commodity+state
// price series, oldest to newest.
function PriceSparkline({ points }: { points: { date: string; price: number }[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-gray-500">É preciso de pelo menos 2 registros para o gráfico.</p>;
  }

  const width = 600;
  const height = 160;
  const padding = 28;
  const prices = points.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;

  const coords = points.map((p, i) => {
    const x = padding + (i / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((p.price - minPrice) / range) * (height - padding * 2);
    return { x, y, ...p };
  });

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Histórico de preços">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" />
      <path d={path} fill="none" stroke="#15803d" strokeWidth={2} />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={3} fill="#15803d" />
      ))}
      <text x={padding} y={14} fontSize={11} fill="#6b7280">
        {maxPrice.toFixed(2)}
      </text>
      <text x={padding} y={height - padding + 14} fontSize={11} fill="#6b7280">
        {minPrice.toFixed(2)}
      </text>
      <text x={coords[0].x} y={height - 6} fontSize={10} fill="#9ca3af">
        {new Date(coords[0].date).toLocaleDateString('pt-BR')}
      </text>
      <text
        x={coords[coords.length - 1].x}
        y={height - 6}
        fontSize={10}
        fill="#9ca3af"
        textAnchor="end"
      >
        {new Date(coords[coords.length - 1].date).toLocaleDateString('pt-BR')}
      </text>
    </svg>
  );
}

export default function QuotationsPage() {
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [latest, setLatest] = useState<LatestQuotation[]>([]);
  const [selectedCommodity, setSelectedCommodity] = useState<Commodity>('BOI_GORDO');
  const [stateFilter, setStateFilter] = useState<StateFilter>(ALL_STATES_FILTER);
  const [history, setHistory] = useState<Quotation[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [formCommodity, setFormCommodity] = useState<Commodity>('BOI_GORDO');
  const [formState, setFormState] = useState<BrazilianState | ''>('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('R$/@');
  const [source, setSource] = useState('');

  const loadHistory = useCallback(
    async (commodity: Commodity, filter: StateFilter) => {
      try {
        const params = new URLSearchParams({ commodity });
        if (filter === NATIONAL_FILTER) {
          // The API has no "national only" filter param; fetch everything for the
          // commodity and filter client-side to state === null.
        } else if (filter !== ALL_STATES_FILTER) {
          params.set('state', filter);
        }
        const data = await apiFetch<Quotation[]>(`/cotacoes?${params.toString()}`, {
          token: accessToken,
        });
        setHistory(filter === NATIONAL_FILTER ? data.filter((q) => q.state === null) : data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar histórico');
      }
    },
    [accessToken],
  );

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const latestData = await apiFetch<LatestQuotation[]>('/cotacoes/recente', {
        token: accessToken,
      });
      setLatest(latestData);
      await loadHistory(selectedCommodity, stateFilter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar cotações');
    } finally {
      setFetching(false);
    }
    // Only runs on mount; commodity/state changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

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
    // Re-fetching when the user changes the commodity/state selector is the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHistory(selectedCommodity, stateFilter);
    // Only the commodity/state filter change should re-trigger this fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCommodity, stateFilter]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await apiFetch('/cotacoes/atualizar', { method: 'POST', token: accessToken });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar cotações automáticas');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await apiFetch<Quotation>('/cotacoes', {
        method: 'POST',
        token: accessToken,
        body: {
          commodity: formCommodity,
          state: formState || undefined,
          price: Number(price),
          unit,
          source: source || undefined,
        },
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

  const latestForSelectedCommodity = latest
    .filter((q) => q.commodity === selectedCommodity)
    .sort((a, b) => {
      if (a.state === b.state) return 0;
      if (a.state === null) return -1;
      if (b.state === null) return 1;
      return stateLabel(a.state).localeCompare(stateLabel(b.state));
    });

  const sparklinePoints = history
    .slice()
    .reverse()
    .map((q) => ({ date: q.recordedAt, price: q.price }));

  return (
    <main className="animate-fade-up mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/fazendas" className="text-sm text-emerald-700 hover:underline">
            ← Propriedades
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Cotações</h1>
          <p className="text-sm text-gray-500">
            Soja, milho e boi gordo são atualizados automaticamente a cada poucas horas (fonte:
            Redação Agro, referência CEPEA/ESALQ — gratuita e não-oficial, sem garantia de
            disponibilidade). Os demais produtos, a quebra por estado e qualquer correção ficam
            por lançamento manual — Scot Consultoria e CEPEA não oferecem API pública para isso.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="shrink-0 rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300 disabled:opacity-50"
        >
          {refreshing ? 'Atualizando...' : 'Atualizar agora'}
        </button>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <form
        onSubmit={handleCreate}
        className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4 sm:grid-cols-5"
      >
        <div>
          <label className="text-xs font-medium text-gray-600">Produto</label>
          <select
            value={formCommodity}
            onChange={(e) => setFormCommodity(e.target.value as Commodity)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          >
            {COMMODITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Estado (opcional)</label>
          <select
            value={formState}
            onChange={(e) => setFormState(e.target.value as BrazilianState | '')}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          >
            <option value="">Nacional</option>
            {STATE_OPTIONS.map((opt) => (
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
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Unidade</label>
          <input
            type="text"
            required
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Fonte (opcional)</label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
        </div>

        <div className="col-span-full">
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
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
            {COMMODITY_OPTIONS.filter((opt) =>
              latest.some((q) => q.commodity === opt.value),
            ).map((opt) => {
              const q = latest.find((l) => l.commodity === opt.value && l.state === null) ??
                latest.find((l) => l.commodity === opt.value);
              if (!q) return null;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => setSelectedCommodity(opt.value)}
                    className={`w-full rounded-lg border p-3 text-left hover:border-emerald-600 ${
                      selectedCommodity === opt.value
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <p className="text-xs uppercase tracking-wide text-gray-500">{opt.label}</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {q.price} {q.unit}
                    </p>
                    {q.changePercent !== 0 && (
                      <p className={q.changePercent > 0 ? 'text-sm text-emerald-700' : 'text-sm text-red-600'}>
                        {q.changePercent > 0 ? '↑' : '↓'} {Math.abs(q.changePercent)}%
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      {q.source ? q.source : 'Lançamento manual'}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mb-8 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
        <h2 className="mb-3 font-semibold text-gray-800">
          Cotação por estado — {commodityLabel(selectedCommodity)}
        </h2>
        {latestForSelectedCommodity.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum registro para este produto ainda.</p>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2">Estado</th>
                <th className="py-2">Preço</th>
                <th className="py-2">Variação</th>
                <th className="py-2">Atualizado em</th>
                <th className="py-2">Fonte</th>
              </tr>
            </thead>
            <tbody>
              {latestForSelectedCommodity.map((q) => (
                <tr key={`${q.commodity}-${q.state ?? 'nacional'}`} className="border-b border-gray-100">
                  <td className="py-2 font-medium text-gray-900">{stateLabel(q.state)}</td>
                  <td className="py-2">
                    {q.price} {q.unit}
                  </td>
                  <td className="py-2">
                    {q.changePercent !== 0 ? (
                      <span className={q.changePercent > 0 ? 'text-emerald-700' : 'text-red-600'}>
                        {q.changePercent > 0 ? '↑' : '↓'} {Math.abs(q.changePercent)}%
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 text-gray-500">
                    {new Date(q.recordedAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-2 text-gray-500">{q.source ?? 'Lançamento manual'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-gray-800">Histórico</h2>
          <div className="flex gap-2">
            <select
              value={selectedCommodity}
              onChange={(e) => setSelectedCommodity(e.target.value as Commodity)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            >
              {COMMODITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as StateFilter)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            >
              <option value={ALL_STATES_FILTER}>Todos os estados</option>
              <option value={NATIONAL_FILTER}>Nacional</option>
              {STATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {stateFilter !== ALL_STATES_FILTER && history.length >= 2 && (
          <div className="mb-4">
            <PriceSparkline points={sparklinePoints} />
          </div>
        )}

        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Sem registros para este filtro.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {history.map((q) => (
              <li key={q.id} className="flex justify-between">
                <span>
                  {new Date(q.recordedAt).toLocaleDateString('pt-BR')} —{' '}
                  <span className="font-medium">{stateLabel(q.state)}</span> — {q.price} {q.unit}
                  {q.source ? ` (${q.source})` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
