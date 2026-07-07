'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { useConfirm } from '@/lib/confirm-context';
import type { Supply, SupplyAlert, SupplyCategory } from '@/lib/types';

const CATEGORY_OPTIONS: { value: SupplyCategory; label: string }[] = [
  { value: 'SAL_MINERAL', label: 'Sal Mineral' },
  { value: 'RACAO', label: 'Ração' },
  { value: 'FERTILIZANTE', label: 'Fertilizante' },
  { value: 'HERBICIDA', label: 'Herbicida' },
  { value: 'DEFENSIVO', label: 'Defensivo' },
  { value: 'OUTROS', label: 'Outros' },
];

const UNIT_OPTIONS = ['kg', 't', 'L', 'mL', 'un', 'sc', 'fardo', 'dose'];
const CUSTOM_UNIT = '__custom__';

function categoryLabel(supply: { category: SupplyCategory; customCategory: string | null }) {
  if (supply.category === 'OUTROS' && supply.customCategory) {
    return supply.customCategory;
  }
  return CATEGORY_OPTIONS.find((opt) => opt.value === supply.category)?.label ?? supply.category;
}

export default function SuppliesPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const { toastSuccess } = useToast();
  const router = useRouter();
  const confirm = useConfirm();

  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [alerts, setAlerts] = useState<SupplyAlert[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<SupplyCategory>('SAL_MINERAL');
  const [customCategory, setCustomCategory] = useState('');
  const [unitSelect, setUnitSelect] = useState('kg');
  const [customUnit, setCustomUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expirationDate, setExpirationDate] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<SupplyCategory>('SAL_MINERAL');
  const [editCustomCategory, setEditCustomCategory] = useState('');
  const [editUnitSelect, setEditUnitSelect] = useState('kg');
  const [editCustomUnit, setEditCustomUnit] = useState('');
  const [editMinimumQuantity, setEditMinimumQuantity] = useState('');
  const [editExpirationDate, setEditExpirationDate] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [suppliesData, alertsData] = await Promise.all([
        apiFetch<Supply[]>(`/fazendas/${farmId}/insumos`, { token: accessToken }),
        apiFetch<SupplyAlert[]>(`/fazendas/${farmId}/insumos/alertas`, { token: accessToken }),
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
      router.replace('/entrar');
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
      await apiFetch<Supply>(`/fazendas/${farmId}/insumos`, {
        method: 'POST',
        token: accessToken,
        body: {
          name,
          category,
          customCategory: category === 'OUTROS' ? customCategory || undefined : undefined,
          unit: unitSelect === CUSTOM_UNIT ? customUnit : unitSelect,
          initialQuantity: quantity ? Number(quantity) : undefined,
          expirationDate: expirationDate || undefined,
        },
      });
      setName('');
      setCustomCategory('');
      setCustomUnit('');
      setQuantity('');
      setExpirationDate('');
      await loadData();
      toastSuccess('Insumo cadastrado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar insumo');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(supply: Supply) {
    setEditingId(supply.id);
    setEditName(supply.name);
    setEditCategory(supply.category);
    setEditCustomCategory(supply.customCategory ?? '');
    if (UNIT_OPTIONS.includes(supply.unit)) {
      setEditUnitSelect(supply.unit);
      setEditCustomUnit('');
    } else {
      setEditUnitSelect(CUSTOM_UNIT);
      setEditCustomUnit(supply.unit);
    }
    setEditMinimumQuantity(String(supply.minimumQuantity));
    setEditExpirationDate(supply.expirationDate ? supply.expirationDate.slice(0, 10) : '');
  }

  async function handleSaveEdit(supplyId: string) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/insumos/${supplyId}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          name: editName,
          category: editCategory,
          customCategory:
            editCategory === 'OUTROS' ? editCustomCategory || undefined : undefined,
          unit: editUnitSelect === CUSTOM_UNIT ? editCustomUnit : editUnitSelect,
          minimumQuantity: Number(editMinimumQuantity),
          expirationDate: editExpirationDate || undefined,
        },
      });
      setEditingId(null);
      await loadData();
      toastSuccess('Insumo atualizado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar insumo');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(supply: Supply) {
    const ok = await confirm({
      title: 'Excluir insumo',
      message: `Excluir o insumo ${supply.name}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/insumos/${supply.id}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
      toastSuccess('Insumo excluído.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir insumo');
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
        <Link href={`/fazendas/${farmId}`} className="text-sm text-green-700 hover:underline">
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
          {category === 'OUTROS' && (
            <input
              type="text"
              placeholder="Nome da categoria"
              required
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              className="mt-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
            />
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Unidade</label>
          <select
            value={unitSelect}
            onChange={(e) => setUnitSelect(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          >
            {UNIT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value={CUSTOM_UNIT}>Outra...</option>
          </select>
          {unitSelect === CUSTOM_UNIT && (
            <input
              type="text"
              placeholder="Unidade personalizada"
              required
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value)}
              className="mt-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
            />
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Quantidade</label>
          <input
            type="number"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
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
          {supplies.map((supply) =>
            editingId === supply.id ? (
              <li
                key={supply.id}
                className="grid grid-cols-2 gap-3 rounded border border-green-600 bg-white p-4 sm:grid-cols-4"
              >
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600">Nome</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Categoria</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as SupplyCategory)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {editCategory === 'OUTROS' && (
                    <input
                      type="text"
                      placeholder="Nome da categoria"
                      value={editCustomCategory}
                      onChange={(e) => setEditCustomCategory(e.target.value)}
                      className="mt-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                    />
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Unidade</label>
                  <select
                    value={editUnitSelect}
                    onChange={(e) => setEditUnitSelect(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                  >
                    {UNIT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                    <option value={CUSTOM_UNIT}>Outra...</option>
                  </select>
                  {editUnitSelect === CUSTOM_UNIT && (
                    <input
                      type="text"
                      placeholder="Unidade personalizada"
                      value={editCustomUnit}
                      onChange={(e) => setEditCustomUnit(e.target.value)}
                      className="mt-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                    />
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">
                    Estoque mínimo (alertas)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editMinimumQuantity}
                    onChange={(e) => setEditMinimumQuantity(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600">Validade</label>
                  <input
                    type="date"
                    value={editExpirationDate}
                    onChange={(e) => setEditExpirationDate(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="col-span-full flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveEdit(supply.id)}
                    className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </li>
            ) : (
              <li
                key={supply.id}
                className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3 hover:border-green-600 hover:shadow-sm"
              >
                <Link href={`/fazendas/${farmId}/insumos/${supply.id}`} className="flex-1">
                  <p className="font-medium text-gray-900">{supply.name}</p>
                  <p className="text-sm text-gray-500">{categoryLabel(supply)}</p>
                </Link>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-500">
                    {supply.currentQuantity} {supply.unit}
                  </p>
                  <button
                    type="button"
                    onClick={() => startEdit(supply)}
                    className="text-sm font-medium text-green-700 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(supply)}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </main>
  );
}
