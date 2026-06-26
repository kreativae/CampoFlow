'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Supply, SupplyAlert, SupplyCategory } from '@/lib/types';

const CATEGORY_OPTIONS: { value: SupplyCategory; label: string }[] = [
  { value: 'SAL_MINERAL', label: 'Sal Mineral' },
  { value: 'RACAO', label: 'Ração' },
  { value: 'FERTILIZANTE', label: 'Fertilizante' },
  { value: 'HERBICIDA', label: 'Herbicida' },
  { value: 'DEFENSIVO', label: 'Defensivo' },
  { value: 'OUTROS', label: 'Outros' },
];

function categoryLabel(category: SupplyCategory) {
  return CATEGORY_OPTIONS.find((opt) => opt.value === category)?.label ?? category;
}

export default function SuppliesPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [alerts, setAlerts] = useState<SupplyAlert[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<SupplyCategory>('SAL_MINERAL');
  const [unit, setUnit] = useState('kg');
  const [initialQuantity, setInitialQuantity] = useState('');
  const [minimumQuantity, setMinimumQuantity] = useState('');
  const [expirationDate, setExpirationDate] = useState('');

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [suppliesData, alertsData] = await Promise.all([
        apiFetch<Supply[]>(`/farms/${farmId}/supplies`, { token: accessToken }),
        apiFetch<SupplyAlert[]>(`/farms/${farmId}/supplies/alerts`, { token: accessToken }),
      ]);
      setSupplies(suppliesData);
      setAlerts(alertsData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar insumos');
    } finally {
      setFetching(false);
    }
  }, [farmId, accessToken]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
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
      await apiFetch<Supply>(`/farms/${farmId}/supplies`, {
        method: 'POST',
        token: accessToken,
        body: {
          name,
          category,
          unit,
          initialQuantity: initialQuantity ? Number(initialQuantity) : undefined,
          minimumQuantity: Number(minimumQuantity),
          expirationDate: expirationDate || undefined,
        },
      });
      setName('');
      setInitialQuantity('');
      setMinimumQuantity('');
      setExpirationDate('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar insumo');
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
      <header className="mb-8">
        <Link href={`/farms/${farmId}`} className="text-sm text-green-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">Insumos</h1>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {alerts.length > 0 && (
        <div className="mb-8 rounded border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-800">Alertas</h2>
          <ul className="space-y-1 text-sm text-amber-900">
            {alerts.map((a) => (
              <li key={a.id}>
                {a.name}
                {a.lowStock ? ` — estoque baixo (${a.currentQuantity}/${a.minimumQuantity} ${a.unit})` : ''}
                {a.expired
                  ? ' — vencido'
                  : a.expiringSoon
                    ? ' — vence em breve'
                    : ''}
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
          <label className="text-xs font-medium text-gray-600">Nome</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Categoria</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SupplyCategory)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
          <label className="text-xs font-medium text-gray-600">Qtd. inicial</label>
          <input
            type="number"
            step="0.01"
            value={initialQuantity}
            onChange={(e) => setInitialQuantity(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Estoque mínimo</label>
          <input
            type="number"
            step="0.01"
            required
            value={minimumQuantity}
            onChange={(e) => setMinimumQuantity(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-600">Validade (opcional)</label>
          <input
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div className="col-span-full">
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {creating ? 'Cadastrando...' : 'Cadastrar insumo'}
          </button>
        </div>
      </form>

      {fetching ? (
        <p className="text-gray-500">Carregando insumos...</p>
      ) : supplies.length === 0 ? (
        <p className="text-gray-500">Nenhum insumo cadastrado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {supplies.map((supply) => (
            <li key={supply.id}>
              <Link
                href={`/farms/${farmId}/supplies/${supply.id}`}
                className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3 hover:border-green-600 hover:shadow-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">{supply.name}</p>
                  <p className="text-sm text-gray-500">{categoryLabel(supply.category)}</p>
                </div>
                <p className="text-sm text-gray-500">
                  {supply.currentQuantity} {supply.unit}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
