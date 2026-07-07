'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useConfirm } from '@/lib/confirm-context';
import type {
  CropCycle,
  CropCycleStatus,
  CropReferenceOption,
  CropSaleUnit,
  MapFeature,
  SoilAnalysis,
} from '@/lib/types';
import {
  PlantingCalculator,
  CropRotation,
  CropPlanning,
  CropClosing,
  CropHistory,
} from './planning';

const STATUS_LABEL: Record<CropCycleStatus, string> = {
  PLANEJADA: 'Planejada',
  PLANTADA: 'Plantada',
  COLHIDA: 'Colhida',
};

const STATUS_COLOR: Record<CropCycleStatus, string> = {
  PLANEJADA: 'bg-gray-100 text-gray-700',
  PLANTADA: 'bg-amber-100 text-amber-800',
  COLHIDA: 'bg-green-100 text-green-800',
};

interface FormState {
  mapFeatureId: string;
  cropName: string;
  variety: string;
  areaHectares: string;
  plantedAt: string;
  expectedHarvestAt: string;
  harvestedAt: string;
  yieldKg: string;
  saleUnit: CropSaleUnit;
  salePricePerUnit: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  mapFeatureId: '',
  cropName: '',
  variety: '',
  areaHectares: '',
  plantedAt: '',
  expectedHarvestAt: '',
  harvestedAt: '',
  yieldKg: '',
  saleUnit: 'SACA60',
  salePricePerUnit: '',
  notes: '',
};

function buildCreateBody(form: FormState) {
  return {
    mapFeatureId: form.mapFeatureId || undefined,
    cropName: form.cropName,
    variety: form.variety || undefined,
    areaHectares: form.areaHectares ? Number(form.areaHectares) : undefined,
    plantedAt: form.plantedAt,
    expectedHarvestAt: form.expectedHarvestAt || undefined,
    harvestedAt: form.harvestedAt || undefined,
    yieldKg: form.yieldKg ? Number(form.yieldKg) : undefined,
    saleUnit: form.saleUnit,
    salePricePerUnit: form.salePricePerUnit ? Number(form.salePricePerUnit) : undefined,
    notes: form.notes || undefined,
  };
}

function buildUpdateBody(form: FormState) {
  return {
    mapFeatureId: form.mapFeatureId || null,
    cropName: form.cropName,
    variety: form.variety || undefined,
    areaHectares: form.areaHectares ? Number(form.areaHectares) : undefined,
    plantedAt: form.plantedAt,
    expectedHarvestAt: form.expectedHarvestAt || undefined,
    harvestedAt: form.harvestedAt || undefined,
    yieldKg: form.yieldKg ? Number(form.yieldKg) : undefined,
    saleUnit: form.saleUnit,
    salePricePerUnit: form.salePricePerUnit ? Number(form.salePricePerUnit) : undefined,
    notes: form.notes || undefined,
  };
}

export default function CropsPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();

  const [cycles, setCycles] = useState<CropCycle[]>([]);
  const [features, setFeatures] = useState<MapFeature[]>([]);
  const [references, setReferences] = useState<CropReferenceOption[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [soilPreview, setSoilPreview] = useState<SoilAnalysis | null>(null);
  const [loadingSoilPreview, setLoadingSoilPreview] = useState(false);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [cyclesData, featuresData, referencesData] = await Promise.all([
        apiFetch<CropCycle[]>(`/fazendas/${farmId}/safras`, { token: accessToken }),
        apiFetch<MapFeature[]>(`/fazendas/${farmId}/elementos-mapa`, { token: accessToken }),
        apiFetch<CropReferenceOption[]>(`/fazendas/${farmId}/safras/referencias/culturas`, {
          token: accessToken,
        }),
      ]);
      setCycles(cyclesData);
      setFeatures(featuresData);
      setReferences(referencesData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar as safras');
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loading, user, loadData, router]);

  useEffect(() => {
    if (!editingId || !editForm.mapFeatureId) {
      return;
    }
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingSoilPreview(true);
    apiFetch<SoilAnalysis[]>(
      `/fazendas/${farmId}/analises-solo?mapFeatureId=${editForm.mapFeatureId}`,
      { token: accessToken },
    )
      .then((list) => {
        if (!cancelled) setSoilPreview(list[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setSoilPreview(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingSoilPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editingId, editForm.mapFeatureId, farmId, accessToken]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await apiFetch<CropCycle>(`/fazendas/${farmId}/safras`, {
        method: 'POST',
        token: accessToken,
        body: buildCreateBody(form),
      });
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar a safra');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(cycle: CropCycle) {
    setEditingId(cycle.id);
    setSoilPreview(null);
    setEditForm({
      mapFeatureId: cycle.mapFeatureId ?? '',
      cropName: cycle.cropName,
      variety: cycle.variety ?? '',
      areaHectares: cycle.areaHectares != null ? String(cycle.areaHectares) : '',
      plantedAt: cycle.plantedAt.slice(0, 10),
      expectedHarvestAt: cycle.expectedHarvestAt ? cycle.expectedHarvestAt.slice(0, 10) : '',
      harvestedAt: cycle.harvestedAt ? cycle.harvestedAt.slice(0, 10) : '',
      yieldKg: cycle.yieldKg != null ? String(cycle.yieldKg) : '',
      saleUnit: cycle.saleUnit ?? 'SACA60',
      salePricePerUnit: cycle.salePricePerUnit != null ? String(cycle.salePricePerUnit) : '',
      notes: cycle.notes ?? '',
    });
  }

  async function handleSaveEdit(id: string) {
    setSaving(true);
    setError(null);
    try {
      const body = buildUpdateBody(editForm);
      await apiFetch(`/fazendas/${farmId}/safras/${id}`, {
        method: 'PATCH',
        token: accessToken,
        body,
      });
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar a safra');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cycle: CropCycle) {
    const ok = await confirm({
      title: 'Excluir safra',
      message: `Excluir o registro de ${cycle.cropName}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/safras/${cycle.id}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir a safra');
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
        <Link href={`/fazendas/${farmId}`} className="text-sm text-green-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">Safras</h1>
        <p className="text-sm text-gray-500">
          Organize o plantio da propriedade: cultura, talhão, datas de plantio/colheita e
          produtividade de cada ciclo.
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
        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-600">Cultura</label>
          <input
            type="text"
            required
            value={form.cropName}
            onChange={(e) => setForm((f) => ({ ...f, cropName: e.target.value }))}
            placeholder="Ex.: Soja"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Variedade (opcional)</label>
          <input
            type="text"
            value={form.variety}
            onChange={(e) => setForm((f) => ({ ...f, variety: e.target.value }))}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Área (ha)</label>
          <input
            type="number"
            step="0.01"
            value={form.areaHectares}
            onChange={(e) => setForm((f) => ({ ...f, areaHectares: e.target.value }))}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-600">Talhão (opcional)</label>
          <select
            value={form.mapFeatureId}
            onChange={(e) => setForm((f) => ({ ...f, mapFeatureId: e.target.value }))}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          >
            <option value="">Sem vínculo</option>
            {features.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Data do plantio</label>
          <input
            type="date"
            required
            value={form.plantedAt}
            onChange={(e) => setForm((f) => ({ ...f, plantedAt: e.target.value }))}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Previsão de colheita</label>
          <input
            type="date"
            value={form.expectedHarvestAt}
            onChange={(e) => setForm((f) => ({ ...f, expectedHarvestAt: e.target.value }))}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div className="col-span-full">
          <label className="text-xs font-medium text-gray-600">Observações</label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div className="col-span-full">
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {creating ? 'Salvando...' : 'Registrar safra'}
          </button>
        </div>
      </form>

      <PlantingCalculator farmId={farmId} token={accessToken} references={references} />
      <CropHistory farmId={farmId} token={accessToken} />
      <CropRotation farmId={farmId} token={accessToken} />

      {cycles.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma safra registrada ainda.</p>
      ) : (
        <ul className="space-y-3">
          {cycles.map((c) => {
            const feature = features.find((f) => f.id === c.mapFeatureId);
            return (
              <li key={c.id} className="rounded border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">
                    {c.cropName}
                    {c.variety ? ` — ${c.variety}` : ''}
                  </p>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[c.status]}`}
                  >
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {feature ? `${feature.name} · ` : ''}
                  {c.areaHectares != null ? `${c.areaHectares} ha · ` : ''}
                  Plantio em {new Date(c.plantedAt).toLocaleDateString('pt-BR')}
                  {c.expectedHarvestAt
                    ? ` · previsão de colheita ${new Date(c.expectedHarvestAt).toLocaleDateString('pt-BR')}`
                    : ''}
                  {c.harvestedAt
                    ? ` · colhido em ${new Date(c.harvestedAt).toLocaleDateString('pt-BR')}`
                    : ''}
                  {c.yieldKg != null ? ` · ${c.yieldKg} kg produzidos` : ''}
                </p>
                {c.notes && <p className="mt-1 text-sm text-gray-600">{c.notes}</p>}
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    className="text-sm font-medium text-green-700 hover:underline"
                  >
                    Visualização rápida
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c)}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Excluir
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Visualização rápida — {editForm.cropName}
              </h2>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600">Cultura</label>
                <input
                  type="text"
                  value={editForm.cropName}
                  onChange={(e) => setEditForm((f) => ({ ...f, cropName: e.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Variedade</label>
                <input
                  type="text"
                  value={editForm.variety}
                  onChange={(e) => setEditForm((f) => ({ ...f, variety: e.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Área (ha)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.areaHectares}
                  onChange={(e) => setEditForm((f) => ({ ...f, areaHectares: e.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600">Talhão</label>
                <select
                  value={editForm.mapFeatureId}
                  onChange={(e) => {
                    if (!e.target.value) setSoilPreview(null);
                    setEditForm((f) => ({ ...f, mapFeatureId: e.target.value }));
                  }}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                >
                  <option value="">Sem vínculo</option>
                  {features.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {editForm.mapFeatureId && (
                <div className="col-span-2 rounded border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-1 text-xs font-semibold text-gray-600">
                    Última análise de solo do talhão
                  </p>
                  {loadingSoilPreview ? (
                    <p className="text-xs text-gray-400">Carregando...</p>
                  ) : soilPreview ? (
                    <div className="text-xs text-gray-700">
                      <p>
                        Coletada em {new Date(soilPreview.collectedAt).toLocaleDateString('pt-BR')}
                      </p>
                      <p className="mt-1">
                        {soilPreview.ph != null ? `pH ${soilPreview.ph} · ` : ''}
                        {soilPreview.baseSaturationPercent != null
                          ? `V% ${soilPreview.baseSaturationPercent} · `
                          : ''}
                        {soilPreview.ctcCmolcDm3 != null
                          ? `CTC ${soilPreview.ctcCmolcDm3} cmolc/dm³`
                          : ''}
                      </p>
                      <Link
                        href={`/fazendas/${farmId}/mapa/solo/${editForm.mapFeatureId}`}
                        className="mt-1 inline-block font-medium text-green-700 hover:underline"
                      >
                        Ver análises de solo →
                      </Link>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Nenhuma análise de solo registrada para este talhão ainda.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600">Plantio</label>
                <input
                  type="date"
                  value={editForm.plantedAt}
                  onChange={(e) => setEditForm((f) => ({ ...f, plantedAt: e.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Previsão de colheita</label>
                <input
                  type="date"
                  value={editForm.expectedHarvestAt}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, expectedHarvestAt: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Colheita realizada</label>
                <input
                  type="date"
                  value={editForm.harvestedAt}
                  onChange={(e) => setEditForm((f) => ({ ...f, harvestedAt: e.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Produção (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.yieldKg}
                  onChange={(e) => setEditForm((f) => ({ ...f, yieldKg: e.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Unidade de venda</label>
                <select
                  value={editForm.saleUnit}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, saleUnit: e.target.value as CropSaleUnit }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                >
                  <option value="SACA60">Saca (60kg)</option>
                  <option value="KG">Quilo (kg)</option>
                  <option value="ARROBA">Arroba (@)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Preço de venda (R$/un.)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.salePricePerUnit}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, salePricePerUnit: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600">Observações</label>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 border-t border-gray-200 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-800">
                Planejamento de plantio
              </h3>
              <CropPlanning farmId={farmId} token={accessToken} cycleId={editingId} />
            </div>

            <div className="mt-6 border-t border-gray-200 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-800">
                Fechamento da safra (custos e resultado)
              </h3>
              <p className="mb-3 text-xs text-gray-500">
                Salve o preço e a produção acima para atualizar o resultado.
              </p>
              <CropClosing farmId={farmId} token={accessToken} cycleId={editingId} />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveEdit(editingId)}
                className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
