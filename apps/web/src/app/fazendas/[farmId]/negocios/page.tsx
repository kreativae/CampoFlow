'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, apiDownload, ApiError } from '@/lib/api';
import type { Animal, Deal, DealItem, DealSummary, DealType, DealStatus } from '@/lib/types';

const ARROBA_KG = 15;

const STATUS_LABEL: Record<DealStatus, string> = {
  RASCUNHO: 'Rascunho',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};

const STATUS_COLOR: Record<DealStatus, string> = {
  RASCUNHO: 'bg-yellow-100 text-yellow-800',
  FINALIZADO: 'bg-green-100 text-green-800',
  CANCELADO: 'bg-red-100 text-red-800',
};

function computeSummary(
  items: { weightKg: number | null; unitPrice: number | null }[],
  pricePerUnit: number,
  priceUnit: string,
  freightCost: number,
  commissionPercent: number,
): DealSummary {
  const totalAnimals = items.length;
  const totalWeightKg = items.reduce((s, i) => s + (i.weightKg ?? 0), 0);
  const totalArrobas = totalWeightKg / ARROBA_KG;

  let subtotal: number;
  if (priceUnit === 'ARROBA') {
    subtotal = totalArrobas * pricePerUnit;
  } else {
    subtotal = totalAnimals * pricePerUnit;
  }

  const commissionValue = subtotal * (commissionPercent / 100);
  const grandTotal = subtotal + freightCost + commissionValue;

  return {
    totalAnimals,
    totalWeightKg,
    totalArrobas: Number(totalArrobas.toFixed(2)),
    subtotal: Number(subtotal.toFixed(2)),
    freightPerAnimal: totalAnimals > 0 ? Number((freightCost / totalAnimals).toFixed(2)) : 0,
    freightPerArroba: totalArrobas > 0 ? Number((freightCost / totalArrobas).toFixed(2)) : 0,
    commissionValue: Number(commissionValue.toFixed(2)),
    grandTotal: Number(grandTotal.toFixed(2)),
    pricePerAnimal: totalAnimals > 0 ? Number((grandTotal / totalAnimals).toFixed(2)) : 0,
    pricePerArroba: totalArrobas > 0 ? Number((grandTotal / totalArrobas).toFixed(2)) : 0,
  };
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface DraftItem {
  animalId?: string;
  earTag: string;
  weightKg: number | null;
  unitPrice: number | null;
}

export default function NegociosPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<DealType | ''>('');
  const [filterStatus, setFilterStatus] = useState<DealStatus | ''>('');

  // Form state
  const [dealType, setDealType] = useState<DealType>('VENDA');
  const [counterparty, setCounterparty] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [priceUnit, setPriceUnit] = useState<'ANIMAL' | 'ARROBA'>('ARROBA');
  const [freightCost, setFreightCost] = useState('');
  const [commissionPercent, setCommissionPercent] = useState('');
  const [dealDate, setDealDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);

  // Animal selection for VENDA
  const [showAnimalPicker, setShowAnimalPicker] = useState(false);
  const [animalSearch, setAnimalSearch] = useState('');

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (filterStatus) params.set('status', filterStatus);
      const qs = params.toString() ? `?${params}` : '';
      const [d, a] = await Promise.all([
        apiFetch<Deal[]>(`/fazendas/${farmId}/negocios${qs}`, { token: accessToken }),
        apiFetch<Animal[]>(`/fazendas/${farmId}/animais`, { token: accessToken }),
      ]);
      setDeals(d);
      setAnimals(a.filter((x) => x.active));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar dados');
    } finally {
      setFetching(false);
    }
  }, [farmId, accessToken, filterType, filterStatus]);

  useEffect(() => {
    if (!loading && user) loadData();
  }, [loading, user, loadData]);

  // Filtered animals for picker (exclude already selected)
  const selectedAnimalIds = useMemo(() => new Set(draftItems.map((i) => i.animalId).filter(Boolean)), [draftItems]);
  const filteredAnimals = useMemo(() => {
    const q = animalSearch.toLowerCase();
    return animals
      .filter((a) => !selectedAnimalIds.has(a.id))
      .filter((a) => !q || a.earTag.toLowerCase().includes(q) || (a.name ?? '').toLowerCase().includes(q));
  }, [animals, selectedAnimalIds, animalSearch]);

  const summary = useMemo(
    () =>
      computeSummary(
        draftItems,
        Number(pricePerUnit) || 0,
        priceUnit,
        Number(freightCost) || 0,
        Number(commissionPercent) || 0,
      ),
    [draftItems, pricePerUnit, priceUnit, freightCost, commissionPercent],
  );

  function addAnimalToDraft(animal: Animal) {
    setDraftItems((prev) => [
      ...prev,
      {
        animalId: animal.id,
        earTag: animal.earTag,
        weightKg: animal.currentWeightKg,
        unitPrice: null,
      },
    ]);
  }

  function addManualItem() {
    setDraftItems((prev) => [...prev, { earTag: '', weightKg: null, unitPrice: null }]);
  }

  function removeItem(idx: number) {
    setDraftItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof DraftItem, value: string) {
    setDraftItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        if (field === 'earTag') return { ...item, earTag: value };
        const num = value === '' ? null : Number(value);
        return { ...item, [field]: num };
      }),
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (draftItems.length === 0) {
      setError('Adicione ao menos um animal ao negócio.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/negocios`, {
        method: 'POST',
        token: accessToken,
        body: {
          type: dealType,
          counterparty: counterparty || undefined,
          pricePerUnit: Number(pricePerUnit) || 0,
          priceUnit,
          freightCost: Number(freightCost) || 0,
          commissionPercent: Number(commissionPercent) || 0,
          notes: notes || undefined,
          dealDate,
          items: draftItems.map((i) => ({
            animalId: i.animalId || undefined,
            earTag: i.earTag,
            weightKg: i.weightKg ?? undefined,
            unitPrice: i.unitPrice ?? undefined,
          })),
        },
      });
      resetForm();
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar negócio');
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setDealType('VENDA');
    setCounterparty('');
    setPricePerUnit('');
    setPriceUnit('ARROBA');
    setFreightCost('');
    setCommissionPercent('');
    setDealDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setDraftItems([]);
    setShowAnimalPicker(false);
    setAnimalSearch('');
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este negócio?')) return;
    try {
      await apiFetch(`/fazendas/${farmId}/negocios/${id}`, { method: 'DELETE', token: accessToken });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir');
    }
  }

  async function handleStatusChange(id: string, status: DealStatus) {
    try {
      await apiFetch(`/fazendas/${farmId}/negocios/${id}`, {
        method: 'PATCH',
        token: accessToken,
        body: { status },
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar status');
    }
  }

  function dealSummary(deal: Deal): DealSummary {
    return computeSummary(deal.items, deal.pricePerUnit, deal.priceUnit, deal.freightCost, deal.commissionPercent);
  }

  const animalsWithoutWeight = useMemo(
    () => draftItems.filter((i) => i.animalId && i.weightKg == null),
    [draftItems],
  );

  if (loading || !user || fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <Link href={`/fazendas/${farmId}`} className="text-sm text-green-700 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Negócios</h1>
          <p className="text-sm text-gray-500">Compra e venda de animais — cálculo de custos por animal e por arroba</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
          className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
        >
          {showForm ? 'Cancelar' : 'Novo negócio'}
        </button>
      </header>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {/* --- Formulário de criação --- */}
      {showForm && (
        <section className="mb-8 rounded border border-gray-200 bg-white p-4">
          <h2 className="mb-4 font-semibold text-gray-800">Novo negócio</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Tipo + data */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="text-xs font-medium text-gray-600">Tipo</label>
                <select
                  value={dealType}
                  onChange={(e) => setDealType(e.target.value as DealType)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="VENDA">Venda</option>
                  <option value="COMPRA">Compra</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Data</label>
                <input
                  type="date"
                  value={dealDate}
                  onChange={(e) => setDealDate(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600">Contraparte (comprador/vendedor)</label>
                <input
                  type="text"
                  value={counterparty}
                  onChange={(e) => setCounterparty(e.target.value)}
                  placeholder="Nome ou empresa"
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            {/* Preço, frete, comissão */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="text-xs font-medium text-gray-600">Preço por</label>
                <select
                  value={priceUnit}
                  onChange={(e) => setPriceUnit(e.target.value as 'ANIMAL' | 'ARROBA')}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="ARROBA">Arroba (@)</option>
                  <option value="ANIMAL">Animal</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Valor (R$/{priceUnit === 'ARROBA' ? '@' : 'cab.'})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pricePerUnit}
                  onChange={(e) => setPricePerUnit(e.target.value)}
                  placeholder="0,00"
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Frete total (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={freightCost}
                  onChange={(e) => setFreightCost(e.target.value)}
                  placeholder="0,00"
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Comissão (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="text-xs font-medium text-gray-600">Observações</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>

            {/* --- Animais --- */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">
                  Animais ({draftItems.length})
                </h3>
                <div className="flex gap-2">
                  {dealType === 'VENDA' && (
                    <button
                      type="button"
                      onClick={() => setShowAnimalPicker(!showAnimalPicker)}
                      className="rounded border border-green-600 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                    >
                      {showAnimalPicker ? 'Fechar seletor' : 'Importar do rebanho'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={addManualItem}
                    className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Adicionar manualmente
                  </button>
                </div>
              </div>

              {/* Animal picker */}
              {showAnimalPicker && (
                <div className="mb-3 rounded border border-green-200 bg-green-50 p-3">
                  <input
                    type="text"
                    value={animalSearch}
                    onChange={(e) => setAnimalSearch(e.target.value)}
                    placeholder="Buscar por brinco ou nome..."
                    className="mb-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <div className="max-h-48 overflow-y-auto">
                    {filteredAnimals.length === 0 ? (
                      <p className="text-xs text-gray-400">Nenhum animal disponível</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-left text-gray-500">
                            <th className="py-1">Brinco</th>
                            <th>Nome</th>
                            <th>Categoria</th>
                            <th>Peso (kg)</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAnimals.map((a) => (
                            <tr key={a.id} className="border-b border-gray-100 hover:bg-green-100">
                              <td className="py-1 font-mono">{a.earTag}</td>
                              <td>{a.name ?? '—'}</td>
                              <td>{a.category}</td>
                              <td>
                                {a.currentWeightKg != null ? (
                                  `${a.currentWeightKg} kg`
                                ) : (
                                  <span className="text-amber-600">Sem peso</span>
                                )}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  onClick={() => addAnimalToDraft(a)}
                                  className="text-green-700 hover:underline"
                                >
                                  Selecionar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {/* Warning: animals without weight */}
              {animalsWithoutWeight.length > 0 && (
                <p className="mb-2 rounded bg-amber-50 p-2 text-xs text-amber-700">
                  ⚠ {animalsWithoutWeight.length} animal(is) sem peso registrado no rebanho.
                  O cálculo por arroba pode ficar impreciso.
                </p>
              )}

              {/* Items table */}
              {draftItems.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-500">
                        <th className="py-2">Brinco</th>
                        <th>Peso (kg)</th>
                        <th>Arrobas</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="py-1.5">
                            {item.animalId ? (
                              <span className="font-mono text-sm">{item.earTag}</span>
                            ) : (
                              <input
                                type="text"
                                value={item.earTag}
                                onChange={(e) => updateItem(idx, 'earTag', e.target.value)}
                                placeholder="Brinco"
                                className="w-28 rounded border border-gray-300 px-2 py-1 text-sm"
                                required
                              />
                            )}
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.1"
                              value={item.weightKg ?? ''}
                              onChange={(e) => updateItem(idx, 'weightKg', e.target.value)}
                              placeholder="—"
                              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="text-xs text-gray-500">
                            {item.weightKg != null ? (item.weightKg / ARROBA_KG).toFixed(2) : '—'}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Live summary */}
            {draftItems.length > 0 && (
              <div className="rounded bg-gray-50 p-3">
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Resumo do negócio</h3>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <span className="text-xs text-gray-500">Animais</span>
                    <p className="font-medium">{summary.totalAnimals}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Peso total</span>
                    <p className="font-medium">{summary.totalWeightKg.toFixed(1)} kg</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Total em arrobas</span>
                    <p className="font-medium">{summary.totalArrobas} @</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Subtotal</span>
                    <p className="font-medium">{formatCurrency(summary.subtotal)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Frete/animal</span>
                    <p className="font-medium">{formatCurrency(summary.freightPerAnimal)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Frete/arroba</span>
                    <p className="font-medium">{formatCurrency(summary.freightPerArroba)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Comissão</span>
                    <p className="font-medium">{formatCurrency(summary.commissionValue)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 font-semibold">Total geral</span>
                    <p className="font-bold text-green-700">{formatCurrency(summary.grandTotal)}</p>
                  </div>
                </div>
                <div className="mt-2 border-t border-gray-200 pt-2">
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="text-xs text-gray-500">Custo/animal (total)</span>
                      <p className="font-semibold">{formatCurrency(summary.pricePerAnimal)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Custo/arroba (total)</span>
                      <p className="font-semibold">{formatCurrency(summary.pricePerArroba)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {creating ? 'Salvando...' : 'Salvar negócio'}
            </button>
          </form>
        </section>
      )}

      {/* --- Filtros --- */}
      <div className="mb-4 flex items-center gap-3">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as DealType | '')}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="VENDA">Vendas</option>
          <option value="COMPRA">Compras</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as DealStatus | '')}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="RASCUNHO">Rascunho</option>
          <option value="FINALIZADO">Finalizado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
      </div>

      {/* --- Lista de negócios --- */}
      {deals.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-gray-500">Nenhum negócio registrado.</p>
          <p className="mt-1 text-sm text-gray-400">
            Clique em &quot;Novo negócio&quot; para calcular uma compra ou venda.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {deals.map((deal) => {
            const s = dealSummary(deal);
            return (
              <li key={deal.id} className="rounded border border-gray-200 bg-white p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${deal.type === 'VENDA' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                        {deal.type === 'VENDA' ? 'Venda' : 'Compra'}
                      </span>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[deal.status]}`}>
                        {STATUS_LABEL[deal.status]}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(deal.dealDate).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    {deal.counterparty && (
                      <p className="mt-1 text-sm text-gray-600">{deal.counterparty}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {deal.status === 'RASCUNHO' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(deal.id, 'FINALIZADO')}
                          className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
                        >
                          Finalizar
                        </button>
                        <button
                          onClick={() => handleStatusChange(deal.id, 'CANCELADO')}
                          className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(deal.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  </div>
                </div>

                {/* Deal items summary */}
                <div className="mb-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="py-1">Brinco</th>
                        <th>Peso (kg)</th>
                        <th>Arrobas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deal.items.map((item) => (
                        <tr key={item.id} className="border-b border-gray-50">
                          <td className="py-1 font-mono">{item.earTag}</td>
                          <td>{item.weightKg != null ? `${item.weightKg}` : <span className="text-amber-600">—</span>}</td>
                          <td>{item.weightKg != null ? (item.weightKg / ARROBA_KG).toFixed(2) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary numbers */}
                <div className="grid grid-cols-2 gap-2 rounded bg-gray-50 p-2 text-xs sm:grid-cols-5">
                  <div>
                    <span className="text-gray-500">{s.totalAnimals} animais</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Peso: </span>
                    <span className="font-medium">{s.totalWeightKg.toFixed(1)} kg</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Frete: </span>
                    <span className="font-medium">{formatCurrency(deal.freightCost)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Comissão: </span>
                    <span className="font-medium">{formatCurrency(s.commissionValue)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Total: </span>
                    <span className="font-bold text-green-700">{formatCurrency(s.grandTotal)}</span>
                  </div>
                </div>

                {/* Per-unit breakdown */}
                <div className="mt-1 flex gap-4 text-xs text-gray-500">
                  <span>R$/{deal.priceUnit === 'ARROBA' ? '@' : 'cab.'}: <strong className="text-gray-700">{formatCurrency(deal.pricePerUnit)}</strong></span>
                  <span>Custo total/animal: <strong className="text-gray-700">{formatCurrency(s.pricePerAnimal)}</strong></span>
                  <span>Custo total/@: <strong className="text-gray-700">{formatCurrency(s.pricePerArroba)}</strong></span>
                </div>

                {deal.notes && <p className="mt-2 text-xs text-gray-400">{deal.notes}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
