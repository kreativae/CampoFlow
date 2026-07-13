'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import type {
  CropApplication,
  CropApplicationType,
  CropClosing as CropClosingData,
  CropCostCategory,
  CropCostEntry,
  CropFertilizerRecommendation,
  CropHistoryRow,
  CropReferenceOption,
  CropRotationGroup,
  PlantingCalcResult,
  PlantingWindow,
} from '@/lib/types';

const COST_CATEGORIES: { value: CropCostCategory; label: string }[] = [
  { value: 'SEMENTE', label: 'Semente' },
  { value: 'FERTILIZANTE', label: 'Fertilizante' },
  { value: 'DEFENSIVO', label: 'Defensivo' },
  { value: 'CALCARIO', label: 'Calcário' },
  { value: 'OPERACAO', label: 'Operação' },
  { value: 'MAO_DE_OBRA', label: 'Mão de obra' },
  { value: 'ARRENDAMENTO', label: 'Arrendamento' },
  { value: 'OUTRO', label: 'Outro' },
];

const COST_LABEL = Object.fromEntries(
  COST_CATEGORIES.map((o) => [o.value, o.label]),
) as Record<CropCostCategory, string>;

const APPLICATION_TYPES: { value: CropApplicationType; label: string }[] = [
  { value: 'PLANTIO', label: 'Plantio' },
  { value: 'ADUBACAO', label: 'Adubação' },
  { value: 'CALAGEM', label: 'Calagem' },
  { value: 'HERBICIDA', label: 'Herbicida' },
  { value: 'FUNGICIDA', label: 'Fungicida' },
  { value: 'INSETICIDA', label: 'Inseticida' },
  { value: 'DEFENSIVO', label: 'Defensivo' },
  { value: 'IRRIGACAO', label: 'Irrigação' },
  { value: 'OUTRO', label: 'Outro' },
];

const APPLICATION_LABEL = Object.fromEntries(
  APPLICATION_TYPES.map((o) => [o.value, o.label]),
) as Record<CropApplicationType, string>;

function currency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ---- #2 Calculadora de plantio -----------------------------------------
export function PlantingCalculator({
  farmId,
  token,
  references,
}: {
  farmId: string;
  token: string | null;
  references: CropReferenceOption[];
}) {
  const [area, setArea] = useState('');
  const [seedRate, setSeedRate] = useState('');
  const [seedPrice, setSeedPrice] = useState('');
  const [fertRate, setFertRate] = useState('');
  const [fertPrice, setFertPrice] = useState('');
  const [result, setResult] = useState<PlantingCalcResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCalc(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PlantingCalcResult>(
        `/fazendas/${farmId}/safras/calculadora-plantio`,
        {
          method: 'POST',
          token,
          body: {
            areaHectares: Number(area),
            seedRateKgPerHa: seedRate ? Number(seedRate) : undefined,
            seedPricePerKg: seedPrice ? Number(seedPrice) : undefined,
            fertilizerKgPerHa: fertRate ? Number(fertRate) : undefined,
            fertilizerPricePerKg: fertPrice ? Number(fertPrice) : undefined,
          },
        },
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao calcular');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
      <h2 className="mb-1 font-semibold text-gray-800">Calculadora de plantio</h2>
      <p className="mb-3 text-xs text-gray-500">
        Estime sementes, adubo e o custo para um talhão a partir do tamanho da área.
      </p>
      <form onSubmit={handleCalc} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Área (ha)</label>
          <input
            type="number"
            step="0.01"
            required
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Cultura (preenche semente)</label>
          <select
            onChange={(e) => {
              const ref = references.find((r) => r.key === e.target.value);
              if (ref?.seedRateKgPerHa != null) setSeedRate(String(ref.seedRateKgPerHa));
            }}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          >
            <option value="">—</option>
            {references.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Semente (kg/ha)</label>
          <input
            type="number"
            step="0.1"
            value={seedRate}
            onChange={(e) => setSeedRate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Preço semente (R$/kg)</label>
          <input
            type="number"
            step="0.01"
            value={seedPrice}
            onChange={(e) => setSeedPrice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Adubo (kg/ha)</label>
          <input
            type="number"
            step="0.1"
            value={fertRate}
            onChange={(e) => setFertRate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Preço adubo (R$/kg)</label>
          <input
            type="number"
            step="0.01"
            value={fertPrice}
            onChange={(e) => setFertPrice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
        </div>
        <div className="col-span-full">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
          >
            {loading ? 'Calculando...' : 'Calcular'}
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {result && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <Metric label="Semente total" value={result.seedTotalKg != null ? `${result.seedTotalKg} kg` : '—'} />
          <Metric label="Custo semente" value={result.seedCost != null ? currency(result.seedCost) : '—'} />
          <Metric label="Adubo total" value={result.fertilizerTotalKg != null ? `${result.fertilizerTotalKg} kg` : '—'} />
          <Metric label="Custo adubo" value={result.fertilizerCost != null ? currency(result.fertilizerCost) : '—'} />
          <Metric label="Custo total" value={result.totalCost != null ? currency(result.totalCost) : '—'} highlight />
          <Metric label="Custo por ha" value={result.costPerHa != null ? currency(result.costPerHa) : '—'} />
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded border p-2 ${highlight ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold text-gray-900">{value}</p>
    </div>
  );
}

// ---- #6 Rotação de culturas por talhão ---------------------------------
export function CropRotation({ farmId, token }: { farmId: string; token: string | null }) {
  const [groups, setGroups] = useState<CropRotationGroup[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<CropRotationGroup[]>(`/fazendas/${farmId}/safras/rotacao`, {
        token,
      });
      setGroups(data);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-8 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Rotação de culturas por talhão</h2>
        <button
          type="button"
          onClick={load}
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          {groups ? 'Atualizar' : 'Ver rotação'}
        </button>
      </div>
      {loading && <p className="mt-2 text-sm text-gray-400">Carregando...</p>}
      {groups && groups.length === 0 && !loading && (
        <p className="mt-2 text-sm text-gray-500">
          Nenhuma safra vinculada a talhão para analisar rotação.
        </p>
      )}
      {groups && groups.length > 0 && (
        <ul className="mt-3 space-y-3">
          {groups.map((g) => (
            <li key={g.mapFeatureId} className="rounded-lg border border-gray-100 p-3">
              <p className="font-medium text-gray-900">{g.label}</p>
              <p className="mt-1 text-sm text-gray-600">
                {g.history
                  .map((h) => `${h.cropName} (${new Date(h.plantedAt).toLocaleDateString('pt-BR')})`)
                  .join('  ←  ')}
              </p>
              <p className="mt-1 text-xs text-gray-500">{g.advice}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---- #1 + #3 + #4 Planejamento por safra (dentro do modal) --------------
export function CropPlanning({
  farmId,
  token,
  cycleId,
}: {
  farmId: string;
  token: string | null;
  cycleId: string;
}) {
  const [window, setWindow] = useState<PlantingWindow | null>(null);
  const [rec, setRec] = useState<CropFertilizerRecommendation | null>(null);
  const [applications, setApplications] = useState<CropApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form do caderno de campo
  const [appType, setAppType] = useState<CropApplicationType>('ADUBACAO');
  const [product, setProduct] = useState('');
  const [dosePerHa, setDosePerHa] = useState('');
  const [doseUnit, setDoseUnit] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [appliedAt, setAppliedAt] = useState('');
  const [carencia, setCarencia] = useState('');
  const [responsible, setResponsible] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = `/fazendas/${farmId}/safras/${cycleId}`;
      const [w, r, apps] = await Promise.all([
        apiFetch<PlantingWindow>(`${base}/janela-plantio`, { token }),
        apiFetch<CropFertilizerRecommendation>(`${base}/recomendacao`, { token }),
        apiFetch<CropApplication[]>(`${base}/aplicacoes`, { token }),
      ]);
      setWindow(w);
      setRec(r);
      setApplications(apps);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar planejamento');
    } finally {
      setLoading(false);
    }
  }, [farmId, cycleId, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleAddApplication(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/safras/${cycleId}/aplicacoes`, {
        method: 'POST',
        token,
        body: {
          type: appType,
          product,
          dosePerHa: dosePerHa ? Number(dosePerHa) : undefined,
          doseUnit: doseUnit || undefined,
          unitPrice: unitPrice ? Number(unitPrice) : undefined,
          appliedAt: appliedAt || undefined,
          preHarvestIntervalDays: carencia ? Number(carencia) : undefined,
          responsible: responsible || undefined,
        },
      });
      setProduct('');
      setDosePerHa('');
      setDoseUnit('');
      setUnitPrice('');
      setAppliedAt('');
      setCarencia('');
      setResponsible('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar aplicação');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteApplication(id: string) {
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/safras/${cycleId}/aplicacoes/${id}`, {
        method: 'DELETE',
        token,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir aplicação');
    }
  }

  if (loading) {
    return <p className="text-xs text-gray-400">Carregando planejamento...</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* #3 Janela de plantio */}
      {window && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-1 text-xs font-semibold text-gray-600">Janela de plantio (ZARC simplificado)</p>
          {window.recognized ? (
            <p className="text-sm">
              Recomendado: <span className="font-medium">{window.recommendedLabel}</span>{' '}
              <span
                className={`ml-1 rounded-lg px-1.5 py-0.5 text-xs font-medium ${
                  window.withinWindow
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {window.withinWindow ? 'Dentro da janela' : 'Fora da janela'}
              </span>
            </p>
          ) : (
            <p className="text-sm text-gray-600">{window.note}</p>
          )}
          {window.recognized && <p className="mt-1 text-xs text-gray-500">{window.note}</p>}
        </div>
      )}

      {/* #1 Recomendação de adubação e calagem */}
      {rec && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-1 text-xs font-semibold text-gray-600">
            Recomendação de adubação e calagem
          </p>
          {rec.fertilizer ? (
            <p className="text-sm text-gray-700">
              N {rec.fertilizer.nitrogenKgPerHa} · P₂O₅ {rec.fertilizer.phosphorusKgPerHa} · K₂O{' '}
              {rec.fertilizer.potassiumKgPerHa} kg/ha
              {rec.fertilizer.phosphorusTotalKg != null && (
                <span className="text-gray-500">
                  {' '}
                  (total P₂O₅ {rec.fertilizer.phosphorusTotalKg} kg / K₂O{' '}
                  {rec.fertilizer.potassiumTotalKg} kg)
                </span>
              )}
            </p>
          ) : null}
          {rec.liming && (
            <p className="mt-1 text-sm text-gray-700">
              Calagem:{' '}
              {rec.liming.limestoneTonPerHa != null
                ? `${rec.liming.limestoneTonPerHa} t/ha (V% alvo ${rec.liming.targetBaseSaturationPercent})`
                : '—'}
            </p>
          )}
          {rec.notes.map((n, i) => (
            <p key={i} className="mt-1 text-xs text-gray-500">
              {n}
            </p>
          ))}
        </div>
      )}

      {/* #4 Caderno de campo */}
      <div className="rounded-lg border border-gray-200 p-3">
        <p className="mb-2 text-xs font-semibold text-gray-600">Caderno de campo (aplicações)</p>
        <form onSubmit={handleAddApplication} className="grid grid-cols-2 gap-2">
          <select
            value={appType}
            onChange={(e) => setAppType(e.target.value as CropApplicationType)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          >
            {APPLICATION_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            required
            placeholder="Produto"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Dose/ha"
            value={dosePerHa}
            onChange={(e) => setDosePerHa(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <input
            type="text"
            placeholder="Unidade (kg/ha, L/ha)"
            value={doseUnit}
            onChange={(e) => setDoseUnit(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Preço unit. (R$)"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <input
            type="date"
            value={appliedAt}
            onChange={(e) => setAppliedAt(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <input
            type="number"
            placeholder="Carência (dias)"
            value={carencia}
            onChange={(e) => setCarencia(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <input
            type="text"
            placeholder="Responsável"
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
            className="col-span-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <button
            type="submit"
            disabled={saving}
            className="col-span-2 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Registrar aplicação'}
          </button>
        </form>

        {applications.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Nenhuma aplicação registrada ainda.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            {applications.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2 last:border-0">
                <span>
                  <span className="block">
                    {new Date(a.appliedAt).toLocaleDateString('pt-BR')} —{' '}
                    <span className="font-medium">{APPLICATION_LABEL[a.type]}</span>: {a.product}
                    {a.dosePerHa != null ? ` · ${a.dosePerHa} ${a.doseUnit ?? ''}` : ''}
                  </span>
                  <span className="text-xs text-gray-500">
                    {a.preHarvestIntervalDays != null ? `Carência ${a.preHarvestIntervalDays} dias` : ''}
                    {a.responsible ? ` · ${a.responsible}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteApplication(a.id)}
                  className="shrink-0 text-xs font-medium text-red-600 hover:underline"
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---- Fechamento da safra (custos manuais + resumo financeiro) -----------
export function CropClosing({
  farmId,
  token,
  cycleId,
}: {
  farmId: string;
  token: string | null;
  cycleId: string;
}) {
  const [closing, setClosing] = useState<CropClosingData | null>(null);
  const [entries, setEntries] = useState<CropCostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<CropCostCategory>('SEMENTE');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = `/fazendas/${farmId}/safras/${cycleId}`;
      const [c, e] = await Promise.all([
        apiFetch<CropClosingData>(`${base}/fechamento`, { token }),
        apiFetch<CropCostEntry[]>(`${base}/custos`, { token }),
      ]);
      setClosing(c);
      setEntries(e);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar fechamento');
    } finally {
      setLoading(false);
    }
  }, [farmId, cycleId, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleAddCost(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/safras/${cycleId}/custos`, {
        method: 'POST',
        token,
        body: { category, description, amount: Number(amount) },
      });
      setDescription('');
      setAmount('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar custo');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCost(id: string) {
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/safras/${cycleId}/custos/${id}`, {
        method: 'DELETE',
        token,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir custo');
    }
  }

  if (loading) {
    return <p className="text-xs text-gray-400">Carregando fechamento...</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {closing && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600">Resultado da safra</p>
            <button
              type="button"
              onClick={() => void load()}
              className="text-xs font-medium text-emerald-700 hover:underline"
            >
              Atualizar
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <Metric
              label="Produtividade"
              value={
                closing.production.productivityPerHa != null
                  ? `${closing.production.productivityPerHa} ${closing.unitLabel}/ha`
                  : '—'
              }
            />
            <Metric label="Custo total" value={currency(closing.costs.total)} />
            <Metric
              label="Custo/ha"
              value={closing.costs.perHectare != null ? currency(closing.costs.perHectare) : '—'}
            />
            <Metric
              label="Receita"
              value={closing.revenue.total != null ? currency(closing.revenue.total) : '—'}
            />
            <Metric
              label="Lucro"
              value={closing.result.profit != null ? currency(closing.result.profit) : '—'}
              highlight
            />
            <Metric
              label="Margem"
              value={
                closing.result.marginPercent != null
                  ? `${closing.result.marginPercent}%`
                  : '—'
              }
            />
            <Metric
              label={`Custo por ${closing.unitLabel}`}
              value={closing.costs.perUnit != null ? currency(closing.costs.perUnit) : '—'}
            />
            <Metric
              label="Preço de equilíbrio"
              value={
                closing.result.breakEvenPricePerUnit != null
                  ? `${currency(closing.result.breakEvenPricePerUnit)}/${closing.unitLabel}`
                  : '—'
              }
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Custos: caderno {currency(closing.costs.fieldBook)} · manuais{' '}
            {currency(closing.costs.manual)} · financeiro {currency(closing.costs.finance)}
          </p>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 p-3">
        <p className="mb-2 text-xs font-semibold text-gray-600">Custos manuais da safra</p>
        <form onSubmit={handleAddCost} className="grid grid-cols-2 gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CropCostCategory)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          >
            {COST_CATEGORIES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            required
            placeholder="Valor (R$)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <input
            type="text"
            required
            placeholder="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="col-span-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <button
            type="submit"
            disabled={saving}
            className="col-span-2 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Adicionar custo'}
          </button>
        </form>
        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Nenhum custo manual lançado.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                <span>
                  <span className="font-medium">{COST_LABEL[e.category]}</span>: {e.description}{' '}
                  — {currency(e.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteCost(e.id)}
                  className="shrink-0 text-xs font-medium text-red-600 hover:underline"
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-gray-400">
          Custos do caderno de campo (com preço) e lançamentos do Financeiro vinculados a esta
          safra entram automaticamente no total.
        </p>
      </div>
    </div>
  );
}

// ---- Histórico comparativo de safras -----------------------------------
export function CropHistory({ farmId, token }: { farmId: string; token: string | null }) {
  const [rows, setRows] = useState<CropHistoryRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<CropHistoryRow[]>(`/fazendas/${farmId}/safras/historico`, {
        token,
      });
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-8 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Histórico de safras (custos e resultados)</h2>
        <button
          type="button"
          onClick={load}
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          {rows ? 'Atualizar' : 'Ver histórico'}
        </button>
      </div>
      {loading && <p className="mt-2 text-sm text-gray-400">Carregando...</p>}
      {rows && rows.length === 0 && !loading && (
        <p className="mt-2 text-sm text-gray-500">Nenhuma safra registrada ainda.</p>
      )}
      {rows && rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                <th className="py-1 pr-3">Cultura</th>
                <th className="py-1 pr-3">Plantio</th>
                <th className="py-1 pr-3">Produtiv.</th>
                <th className="py-1 pr-3">Custo</th>
                <th className="py-1 pr-3">Receita</th>
                <th className="py-1 pr-3">Lucro</th>
                <th className="py-1">Margem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="py-1.5 pr-3 font-medium text-gray-900">
                    {r.cropName}
                    {r.variety ? ` (${r.variety})` : ''}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-600">
                    {new Date(r.plantedAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-600">
                    {r.productivityPerHa != null ? `${r.productivityPerHa} ${r.unitLabel}/ha` : '—'}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-600">{currency(r.totalCost)}</td>
                  <td className="py-1.5 pr-3 text-gray-600">
                    {r.revenue != null ? currency(r.revenue) : '—'}
                  </td>
                  <td
                    className={`py-1.5 pr-3 font-medium ${
                      r.profit != null && r.profit < 0 ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    {r.profit != null ? currency(r.profit) : '—'}
                  </td>
                  <td className="py-1.5 text-gray-600">
                    {r.marginPercent != null ? `${r.marginPercent}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
