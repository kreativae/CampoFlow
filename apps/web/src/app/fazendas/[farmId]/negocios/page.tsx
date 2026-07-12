'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Handshake } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
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
  FINALIZADO: 'bg-emerald-100 text-emerald-800',
  CANCELADO: 'bg-red-100 text-red-800',
};

const TYPE_LABEL: Record<DealType, string> = {
  VENDA: 'Venda',
  COMPRA: 'Compra',
  ABATE: 'Abate',
};

const TYPE_COLOR: Record<DealType, string> = {
  VENDA: 'bg-blue-100 text-blue-800',
  COMPRA: 'bg-purple-100 text-purple-800',
  ABATE: 'bg-orange-100 text-orange-800',
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

  // Compra em lote
  const [quantity, setQuantity] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState('');
  const [installmentValue, setInstallmentValue] = useState('');
  const [totalValue, setTotalValue] = useState('');

  // Abate
  const [carcassYieldPercent, setCarcassYieldPercent] = useState('52');
  const [liveWeightPricePerKg, setLiveWeightPricePerKg] = useState('');
  const [funruralPercent, setFunruralPercent] = useState('1.5');
  const [senarPercent, setSenarPercent] = useState('0.2');
  const [slaughterFrequency, setSlaughterFrequency] = useState<'TRIMESTRAL' | 'SEMESTRAL'>('TRIMESTRAL');

  // Animal selection for VENDA and ABATE
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

  const selectedAnimalIds = useMemo(() => new Set(draftItems.map((i) => i.animalId).filter(Boolean)), [draftItems]);
  const filteredAnimals = useMemo(() => {
    const q = animalSearch.toLowerCase();
    return animals
      .filter((a) => !selectedAnimalIds.has(a.id))
      .filter((a) => !q || a.earTag.toLowerCase().includes(q) || (a.name ?? '').toLowerCase().includes(q));
  }, [animals, selectedAnimalIds, animalSearch]);

  // Venda summary
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

  // Compra summary
  const purchaseSummary = useMemo(() => {
    const qty = Number(quantity) || draftItems.length;
    const count = Number(installmentCount) || 0;
    const parcelaVal = Number(installmentValue) || 0;
    // Se parcelado, total = parcelas × valor da parcela; senão, total informado direto
    const total = isInstallment && count > 0 && parcelaVal > 0
      ? count * parcelaVal
      : Number(totalValue) || 0;
    const freight = Number(freightCost) || 0;
    const commission = total * ((Number(commissionPercent) || 0) / 100);
    const grandTotal = total + freight + commission;
    const installment = parcelaVal || (count > 0 ? total / count : 0);
    return {
      quantity: qty,
      installmentCount: count,
      installment,
      totalValue: total,
      commissionValue: commission,
      grandTotal,
      costPerAnimal: qty > 0 ? grandTotal / qty : 0,
    };
  }, [quantity, totalValue, installmentCount, installmentValue, freightCost, commissionPercent, draftItems.length, isInstallment]);

  // Abate summary
  const slaughterSummary = useMemo(() => {
    const yieldPct = (Number(carcassYieldPercent) || 52) / 100;
    const priceKg = Number(liveWeightPricePerKg) || 0;
    const freight = Number(freightCost) || 0;
    const commPct = Number(commissionPercent) || 0;
    const funPct = Number(funruralPercent) || 0;
    const senPct = Number(senarPercent) || 0;

    const totalAnimals = draftItems.length;
    const totalLiveWeight = draftItems.reduce((s, i) => s + (i.weightKg ?? 0), 0);
    const carcassWeight = totalLiveWeight * yieldPct;
    const carcassArrobas = carcassWeight / ARROBA_KG;
    const grossValue = totalLiveWeight * priceKg;
    const arrobaPrice = carcassArrobas > 0 ? grossValue / carcassArrobas : 0;
    const funruralValue = grossValue * (funPct / 100);
    const senarValue = grossValue * (senPct / 100);
    const commissionValue = grossValue * (commPct / 100);
    const netTotal = grossValue - funruralValue - senarValue - commissionValue - freight;

    return {
      totalAnimals,
      totalLiveWeight,
      carcassWeight: Number(carcassWeight.toFixed(1)),
      carcassArrobas: Number(carcassArrobas.toFixed(2)),
      arrobaPrice: Number(arrobaPrice.toFixed(2)),
      grossValue: Number(grossValue.toFixed(2)),
      funruralValue: Number(funruralValue.toFixed(2)),
      senarValue: Number(senarValue.toFixed(2)),
      commissionValue: Number(commissionValue.toFixed(2)),
      freight,
      netTotal: Number(netTotal.toFixed(2)),
      netPerAnimal: totalAnimals > 0 ? Number((netTotal / totalAnimals).toFixed(2)) : 0,
      netPerArroba: carcassArrobas > 0 ? Number((netTotal / carcassArrobas).toFixed(2)) : 0,
    };
  }, [draftItems, carcassYieldPercent, liveWeightPricePerKg, freightCost, commissionPercent, funruralPercent, senarPercent]);

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
    const isCompra = dealType === 'COMPRA';
    const isAbate = dealType === 'ABATE';

    if (isCompra && !Number(quantity) && draftItems.length === 0) {
      setError('Informe a quantidade de animais da compra.');
      return;
    }
    if (!isCompra && draftItems.length === 0) {
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
          ...(isCompra
            ? {
                quantity: Number(quantity) || undefined,
                installmentCount: Number(installmentCount) || undefined,
                installmentValue: Number(installmentValue) || undefined,
                totalValue: isInstallment
                  ? (Number(installmentCount) * Number(installmentValue)) || undefined
                  : Number(totalValue) || undefined,
              }
            : {}),
          ...(isAbate
            ? {
                carcassYieldPercent: Number(carcassYieldPercent) || undefined,
                liveWeightPricePerKg: Number(liveWeightPricePerKg) || undefined,
                funruralPercent: Number(funruralPercent) || undefined,
                senarPercent: Number(senarPercent) || undefined,
                slaughterFrequency,
              }
            : {}),
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
    setQuantity('');
    setInstallmentCount('');
    setInstallmentValue('');
    setTotalValue('');
    setIsInstallment(false);
    setCarcassYieldPercent('52');
    setLiveWeightPricePerKg('');
    setFunruralPercent('1.5');
    setSenarPercent('0.2');
    setSlaughterFrequency('TRIMESTRAL');
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

  async function handleDownloadReport(dealId: string) {
    try {
      await apiDownload(`/fazendas/${farmId}/relatorios/abate?format=pdf&dealId=${dealId}`, `abate-${dealId}.pdf`, accessToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao gerar relatório');
    }
  }

  function dealSummary(deal: Deal): DealSummary {
    const s = computeSummary(deal.items, deal.pricePerUnit, deal.priceUnit, deal.freightCost, deal.commissionPercent);
    if (deal.quantity || deal.totalValue) {
      const totalAnimals = deal.quantity ?? deal.items.length;
      const subtotal = deal.totalValue ?? s.subtotal;
      const commissionValue = subtotal * (deal.commissionPercent / 100);
      const grandTotal = subtotal + deal.freightCost + commissionValue;
      return {
        ...s,
        totalAnimals,
        subtotal,
        commissionValue: Number(commissionValue.toFixed(2)),
        grandTotal: Number(grandTotal.toFixed(2)),
        freightPerAnimal: totalAnimals > 0 ? Number((deal.freightCost / totalAnimals).toFixed(2)) : 0,
        pricePerAnimal: totalAnimals > 0 ? Number((grandTotal / totalAnimals).toFixed(2)) : 0,
      };
    }
    return s;
  }

  function slaughterDealSummary(deal: Deal) {
    const yieldPct = (deal.carcassYieldPercent ?? 52) / 100;
    const priceKg = deal.liveWeightPricePerKg ?? 0;
    const totalAnimals = deal.items.length;
    const totalLiveWeight = deal.items.reduce((s, i) => s + (i.weightKg ?? 0), 0);
    const carcassWeight = totalLiveWeight * yieldPct;
    const carcassArrobas = carcassWeight / ARROBA_KG;
    const grossValue = totalLiveWeight * priceKg;
    const funruralValue = grossValue * ((deal.funruralPercent ?? 0) / 100);
    const senarValue = grossValue * ((deal.senarPercent ?? 0) / 100);
    const commissionValue = grossValue * (deal.commissionPercent / 100);
    const netTotal = grossValue - funruralValue - senarValue - commissionValue - deal.freightCost;
    return { totalAnimals, totalLiveWeight, carcassWeight, carcassArrobas, grossValue, funruralValue, senarValue, commissionValue, netTotal };
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

  const showAnimals = dealType !== 'COMPRA';

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      <PageHeader
        icon={Handshake}
        title="Negócios"
        subtitle="Compra, venda e abate — custos por animal e por arroba"
        backHref={`/fazendas/${farmId}`}
        actions={
          <button
            onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-emerald-800"
          >
            {showForm ? 'Cancelar' : 'Novo negócio'}
          </button>
        }
      />

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {/* --- Formulário de criação --- */}
      {showForm && (
        <section className="mb-8 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
          <h2 className="mb-4 font-semibold text-gray-800">Novo negócio</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Tipo + data */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="text-xs font-medium text-gray-600">Tipo</label>
                <select
                  value={dealType}
                  onChange={(e) => setDealType(e.target.value as DealType)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="VENDA">Venda</option>
                  <option value="COMPRA">Compra</option>
                  <option value="ABATE">Abate</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Data</label>
                <input
                  type="date"
                  value={dealDate}
                  onChange={(e) => setDealDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600">
                  {dealType === 'ABATE' ? 'Frigorífico' : 'Contraparte (comprador/vendedor)'}
                </label>
                <input
                  type="text"
                  value={counterparty}
                  onChange={(e) => setCounterparty(e.target.value)}
                  placeholder={dealType === 'ABATE' ? 'Nome do frigorífico' : 'Nome ou empresa'}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            {/* Preço/valores por tipo */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {dealType === 'VENDA' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Preço por</label>
                    <select
                      value={priceUnit}
                      onChange={(e) => setPriceUnit(e.target.value as 'ANIMAL' | 'ARROBA')}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
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
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      required
                    />
                  </div>
                </>
              )}

              {dealType === 'COMPRA' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Quantidade de animais</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="0"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      required={draftItems.length === 0}
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 pb-2 text-xs font-medium text-gray-600">
                      <input
                        type="checkbox"
                        checked={isInstallment}
                        onChange={(e) => setIsInstallment(e.target.checked)}
                        className="rounded-lg border-gray-300"
                      />
                      Parcelado
                    </label>
                  </div>
                  {isInstallment ? (
                    <>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Nº de parcelas</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={installmentCount}
                          onChange={(e) => setInstallmentCount(e.target.value)}
                          placeholder="1"
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Valor da parcela (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={installmentValue}
                          onChange={(e) => setInstallmentValue(e.target.value)}
                          placeholder="0,00"
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Valor total (calculado)</label>
                        <p className="mt-1 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm font-medium text-gray-700">
                          {Number(installmentCount) > 0 && Number(installmentValue) > 0
                            ? formatCurrency(Number(installmentCount) * Number(installmentValue))
                            : 'R$ —'}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="text-xs font-medium text-gray-600">Valor total (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={totalValue}
                        onChange={(e) => setTotalValue(e.target.value)}
                        placeholder="0,00"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        required
                      />
                    </div>
                  )}
                </>
              )}

              {dealType === 'ABATE' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Valor do kg vivo (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={liveWeightPricePerKg}
                      onChange={(e) => setLiveWeightPricePerKg(e.target.value)}
                      placeholder="0,00"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Rendimento de carcaça (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={carcassYieldPercent}
                      onChange={(e) => setCarcassYieldPercent(e.target.value)}
                      placeholder="52"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Valor da @ (calculado)</label>
                    <p className="mt-1 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm font-medium text-gray-700">
                      {Number(liveWeightPricePerKg) > 0 && Number(carcassYieldPercent) > 0
                        ? formatCurrency((Number(liveWeightPricePerKg) / (Number(carcassYieldPercent) / 100)) * ARROBA_KG)
                        : 'R$ —'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Frequência</label>
                    <select
                      value={slaughterFrequency}
                      onChange={(e) => setSlaughterFrequency(e.target.value as 'TRIMESTRAL' | 'SEMESTRAL')}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="TRIMESTRAL">Trimestral</option>
                      <option value="SEMESTRAL">Semestral</option>
                    </select>
                  </div>
                </>
              )}

              {/* Deduções do abate */}
              {dealType === 'ABATE' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Funrural (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={funruralPercent}
                      onChange={(e) => setFunruralPercent(e.target.value)}
                      placeholder="1.5"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">SENAR (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={senarPercent}
                      onChange={(e) => setSenarPercent(e.target.value)}
                      placeholder="0.2"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600">Frete total (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={freightCost}
                  onChange={(e) => setFreightCost(e.target.value)}
                  placeholder="0,00"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
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
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
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
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>

            {/* --- Animais --- */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">
                  Animais ({draftItems.length})
                </h3>
                <div className="flex gap-2">
                  {showAnimals && (
                    <button
                      type="button"
                      onClick={() => setShowAnimalPicker(!showAnimalPicker)}
                      className="rounded-lg border border-emerald-600 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                    >
                      {showAnimalPicker ? 'Fechar seletor' : 'Importar do rebanho'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={addManualItem}
                    className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Adicionar manualmente
                  </button>
                </div>
              </div>

              {/* Animal picker */}
              {showAnimalPicker && (
                <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <input
                    type="text"
                    value={animalSearch}
                    onChange={(e) => setAnimalSearch(e.target.value)}
                    placeholder="Buscar por brinco ou nome..."
                    className="mb-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <div className="max-h-48 overflow-x-auto overflow-y-auto">
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
                            <tr key={a.id} className="border-b border-gray-100 hover:bg-emerald-100">
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
                                  className="text-emerald-700 hover:underline"
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
                <p className="mb-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
                  ⚠ {animalsWithoutWeight.length} animal(is) sem peso registrado no rebanho.
                  {dealType === 'ABATE'
                    ? ' O cálculo de rendimento de carcaça ficará impreciso.'
                    : ' O cálculo por arroba pode ficar impreciso.'}
                </p>
              )}

              {/* Items table */}
              {draftItems.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-500">
                        <th className="py-2">Brinco</th>
                        <th>Peso vivo (kg)</th>
                        {dealType === 'ABATE' ? (
                          <>
                            <th>Carcaça (kg)</th>
                            <th>Arrobas (carc.)</th>
                            <th>Valor est.</th>
                          </>
                        ) : (
                          <th>Arrobas</th>
                        )}
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftItems.map((item, idx) => {
                        const yld = (Number(carcassYieldPercent) || 52) / 100;
                        const carcKg = item.weightKg != null ? item.weightKg * yld : null;
                        const carcArr = carcKg != null ? carcKg / ARROBA_KG : null;
                        const estVal = item.weightKg != null ? item.weightKg * (Number(liveWeightPricePerKg) || 0) : null;
                        return (
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
                                  className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-sm"
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
                                className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                              />
                            </td>
                            {dealType === 'ABATE' ? (
                              <>
                                <td className="text-xs text-gray-500">
                                  {carcKg != null ? carcKg.toFixed(1) : '—'}
                                </td>
                                <td className="text-xs text-gray-500">
                                  {carcArr != null ? carcArr.toFixed(2) : '—'}
                                </td>
                                <td className="text-xs text-gray-500">
                                  {estVal != null ? formatCurrency(estVal) : '—'}
                                </td>
                              </>
                            ) : (
                              <td className="text-xs text-gray-500">
                                {item.weightKg != null ? (item.weightKg / ARROBA_KG).toFixed(2) : '—'}
                              </td>
                            )}
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Live summary — compra em lote */}
            {dealType === 'COMPRA' && (Number(quantity) > 0 || draftItems.length > 0) && (
              <div className="rounded-lg bg-gray-50 p-3">
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Resumo da compra</h3>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <span className="text-xs text-gray-500">Quantidade</span>
                    <p className="font-medium">{purchaseSummary.quantity} animais</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Parcelamento</span>
                    <p className="font-medium">
                      {purchaseSummary.installmentCount > 0
                        ? `${purchaseSummary.installmentCount}x de ${formatCurrency(purchaseSummary.installment)}`
                        : formatCurrency(purchaseSummary.installment)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Valor total</span>
                    <p className="font-medium">{formatCurrency(purchaseSummary.totalValue)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Comissão</span>
                    <p className="font-medium">{formatCurrency(purchaseSummary.commissionValue)}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-500">Total geral (c/ frete e comissão)</span>
                    <p className="font-bold text-emerald-700">{formatCurrency(purchaseSummary.grandTotal)}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-500">Custo por animal</span>
                    <p className="font-bold text-emerald-700">{formatCurrency(purchaseSummary.costPerAnimal)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Live summary — venda */}
            {dealType === 'VENDA' && draftItems.length > 0 && (
              <div className="rounded-lg bg-gray-50 p-3">
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
                    <span className="text-xs font-semibold text-gray-500">Total geral</span>
                    <p className="font-bold text-emerald-700">{formatCurrency(summary.grandTotal)}</p>
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

            {/* Live summary — abate */}
            {dealType === 'ABATE' && draftItems.length > 0 && (
              <div className="rounded-lg bg-orange-50 p-3">
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Resumo do abate</h3>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <span className="text-xs text-gray-500">Animais</span>
                    <p className="font-medium">{slaughterSummary.totalAnimals}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Peso vivo total</span>
                    <p className="font-medium">{slaughterSummary.totalLiveWeight.toFixed(1)} kg</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Peso carcaça</span>
                    <p className="font-medium">{slaughterSummary.carcassWeight} kg</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Arrobas (carcaça)</span>
                    <p className="font-medium">{slaughterSummary.carcassArrobas} @</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Valor da @</span>
                    <p className="font-medium">{formatCurrency(slaughterSummary.arrobaPrice)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Valor bruto</span>
                    <p className="font-medium">{formatCurrency(slaughterSummary.grossValue)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Funrural ({funruralPercent}%)</span>
                    <p className="font-medium text-red-600">- {formatCurrency(slaughterSummary.funruralValue)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">SENAR ({senarPercent}%)</span>
                    <p className="font-medium text-red-600">- {formatCurrency(slaughterSummary.senarValue)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Comissão ({commissionPercent || '0'}%)</span>
                    <p className="font-medium text-red-600">- {formatCurrency(slaughterSummary.commissionValue)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Frete</span>
                    <p className="font-medium text-red-600">- {formatCurrency(slaughterSummary.freight)}</p>
                  </div>
                </div>
                <div className="mt-2 border-t border-orange-200 pt-2">
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="text-xs font-semibold text-gray-500">Valor líquido</span>
                      <p className="font-bold text-emerald-700">{formatCurrency(slaughterSummary.netTotal)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Líquido/animal</span>
                      <p className="font-semibold">{formatCurrency(slaughterSummary.netPerAnimal)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Líquido/@</span>
                      <p className="font-semibold">{formatCurrency(slaughterSummary.netPerArroba)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
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
          className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="VENDA">Vendas</option>
          <option value="COMPRA">Compras</option>
          <option value="ABATE">Abates</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as DealStatus | '')}
          className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="RASCUNHO">Rascunho</option>
          <option value="FINALIZADO">Finalizado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
      </div>

      {/* --- Lista de negócios --- */}
      {deals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-gray-500">Nenhum negócio registrado.</p>
          <p className="mt-1 text-sm text-gray-400">
            Clique em &quot;Novo negócio&quot; para calcular uma compra, venda ou abate.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {deals.map((deal) => {
            const isAbate = deal.type === 'ABATE';
            const s = isAbate ? null : dealSummary(deal);
            const sa = isAbate ? slaughterDealSummary(deal) : null;

            return (
              <li key={deal.id} className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[deal.type]}`}>
                        {TYPE_LABEL[deal.type]}
                      </span>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[deal.status]}`}>
                        {STATUS_LABEL[deal.status]}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(deal.dealDate).toLocaleDateString('pt-BR')}
                      </span>
                      {isAbate && deal.slaughterFrequency && (
                        <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {deal.slaughterFrequency === 'TRIMESTRAL' ? 'Trimestral' : 'Semestral'}
                        </span>
                      )}
                    </div>
                    {deal.counterparty && (
                      <p className="mt-1 text-sm text-gray-600">{deal.counterparty}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isAbate && deal.status === 'FINALIZADO' && (
                      <button
                        onClick={() => handleDownloadReport(deal.id)}
                        className="rounded-lg bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-200"
                      >
                        Relatório PDF
                      </button>
                    )}
                    {deal.status === 'RASCUNHO' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(deal.id, 'FINALIZADO')}
                          className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200"
                        >
                          Finalizar
                        </button>
                        <button
                          onClick={() => handleStatusChange(deal.id, 'CANCELADO')}
                          className="rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
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

                {/* Deal items table */}
                {deal.items.length > 0 && (
                  <div className="mb-2 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="py-1">Brinco</th>
                          <th>Peso vivo (kg)</th>
                          {isAbate ? (
                            <>
                              <th>Carcaça (kg)</th>
                              <th>Arrobas</th>
                            </>
                          ) : (
                            <th>Arrobas</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {deal.items.map((item) => {
                          const yld = isAbate ? (deal.carcassYieldPercent ?? 52) / 100 : 1;
                          const carcKg = item.weightKg != null ? item.weightKg * yld : null;
                          return (
                            <tr key={item.id} className="border-b border-gray-50">
                              <td className="py-1 font-mono">{item.earTag}</td>
                              <td>{item.weightKg != null ? `${item.weightKg}` : <span className="text-amber-600">—</span>}</td>
                              {isAbate ? (
                                <>
                                  <td>{carcKg != null ? carcKg.toFixed(1) : '—'}</td>
                                  <td>{carcKg != null ? (carcKg / ARROBA_KG).toFixed(2) : '—'}</td>
                                </>
                              ) : (
                                <td>{item.weightKg != null ? (item.weightKg / ARROBA_KG).toFixed(2) : '—'}</td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Summary numbers — ABATE */}
                {isAbate && sa && (
                  <>
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-orange-50 p-2 text-xs sm:grid-cols-5">
                      <div>
                        <span className="text-gray-500">{sa.totalAnimals} animais</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Carcaça: </span>
                        <span className="font-medium">{sa.carcassWeight.toFixed(1)} kg ({(((deal.carcassYieldPercent ?? 52))).toFixed(1)}%)</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Bruto: </span>
                        <span className="font-medium">{formatCurrency(sa.grossValue)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Deduções: </span>
                        <span className="font-medium text-red-600">
                          {formatCurrency(sa.funruralValue + sa.senarValue + sa.commissionValue + deal.freightCost)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Líquido: </span>
                        <span className="font-bold text-emerald-700">{formatCurrency(sa.netTotal)}</span>
                      </div>
                    </div>
                    <div className="mt-1 flex gap-4 text-xs text-gray-500">
                      <span>Funrural: <strong className="text-gray-700">{formatCurrency(sa.funruralValue)}</strong></span>
                      <span>SENAR: <strong className="text-gray-700">{formatCurrency(sa.senarValue)}</strong></span>
                      <span>Comissão: <strong className="text-gray-700">{formatCurrency(sa.commissionValue)}</strong></span>
                      <span>Frete: <strong className="text-gray-700">{formatCurrency(deal.freightCost)}</strong></span>
                      <span>Líq/animal: <strong className="text-gray-700">{formatCurrency(sa.totalAnimals > 0 ? sa.netTotal / sa.totalAnimals : 0)}</strong></span>
                    </div>
                  </>
                )}

                {/* Summary numbers — COMPRA/VENDA */}
                {!isAbate && s && (
                  <>
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-2 text-xs sm:grid-cols-5">
                      <div>
                        <span className="text-gray-500">{s.totalAnimals} animais</span>
                      </div>
                      {s.totalWeightKg > 0 && (
                        <div>
                          <span className="text-gray-500">Peso: </span>
                          <span className="font-medium">{s.totalWeightKg.toFixed(1)} kg</span>
                        </div>
                      )}
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
                        <span className="font-bold text-emerald-700">{formatCurrency(s.grandTotal)}</span>
                      </div>
                    </div>

                    <div className="mt-1 flex gap-4 text-xs text-gray-500">
                      {deal.quantity || deal.totalValue ? (
                        <>
                          {(() => {
                            const parcela =
                              deal.installmentValue ||
                              (deal.installmentCount && deal.totalValue
                                ? deal.totalValue / deal.installmentCount
                                : 0);
                            if (!parcela) return null;
                            return (
                              <span>
                                Parcela:{' '}
                                <strong className="text-gray-700">
                                  {deal.installmentCount ? `${deal.installmentCount}x de ` : ''}
                                  {formatCurrency(parcela)}
                                </strong>
                              </span>
                            );
                          })()}
                          <span>Custo por animal: <strong className="text-gray-700">{formatCurrency(s.pricePerAnimal)}</strong></span>
                        </>
                      ) : (
                        <>
                          <span>R$/{deal.priceUnit === 'ARROBA' ? '@' : 'cab.'}: <strong className="text-gray-700">{formatCurrency(deal.pricePerUnit)}</strong></span>
                          <span>Custo total/animal: <strong className="text-gray-700">{formatCurrency(s.pricePerAnimal)}</strong></span>
                          <span>Custo total/@: <strong className="text-gray-700">{formatCurrency(s.pricePerArroba)}</strong></span>
                        </>
                      )}
                    </div>
                  </>
                )}

                {deal.notes && <p className="mt-2 text-xs text-gray-400">{deal.notes}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
