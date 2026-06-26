'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, apiUpload, apiDownload, ApiError } from '@/lib/api';
import type {
  MapFeature,
  SoilAnalysis,
  SoilAnalysisRecommendation,
} from '@/lib/types';

const FIELD_DEFS: { key: keyof SoilAnalysis; label: string }[] = [
  { key: 'ph', label: 'pH' },
  { key: 'phosphorusMgDm3', label: 'P (mg/dm³)' },
  { key: 'potassiumCmolcDm3', label: 'K (cmolc/dm³)' },
  { key: 'calciumCmolcDm3', label: 'Ca (cmolc/dm³)' },
  { key: 'magnesiumCmolcDm3', label: 'Mg (cmolc/dm³)' },
  { key: 'aluminumCmolcDm3', label: 'Al (cmolc/dm³)' },
  { key: 'organicMatterPercent', label: 'Matéria orgânica (%)' },
  { key: 'baseSaturationPercent', label: 'Saturação de bases V (%)' },
  { key: 'ctcCmolcDm3', label: 'CTC (cmolc/dm³)' },
];

type FormState = Partial<Record<keyof SoilAnalysis, string>>;

export default function SoilAnalysisPage() {
  const { farmId, mapFeatureId } = useParams<{ farmId: string; mapFeatureId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [feature, setFeature] = useState<MapFeature | null>(null);
  const [history, setHistory] = useState<SoilAnalysis[]>([]);
  const [recommendations, setRecommendations] = useState<
    Record<string, SoilAnalysisRecommendation>
  >({});
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [collectedAt, setCollectedAt] = useState('');
  const [form, setForm] = useState<FormState>({});

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [featureData, historyData] = await Promise.all([
        apiFetch<MapFeature>(`/fazendas/${farmId}/elementos-mapa/${mapFeatureId}`, {
          token: accessToken,
        }),
        apiFetch<SoilAnalysis[]>(
          `/fazendas/${farmId}/analises-solo/historico?mapFeatureId=${mapFeatureId}`,
          { token: accessToken },
        ),
      ]);
      setFeature(featureData);
      setHistory(historyData);

      const recs = await Promise.all(
        historyData.map((a) =>
          apiFetch<SoilAnalysisRecommendation>(
            `/fazendas/${farmId}/analises-solo/${a.id}/recomendacao`,
            { token: accessToken },
          ).then((rec) => [a.id, rec] as const),
        ),
      );
      setRecommendations(Object.fromEntries(recs));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar análises de solo');
    } finally {
      setFetching(false);
    }
  }, [farmId, mapFeatureId, accessToken]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loading, user, loadData, router]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('mapFeatureId', mapFeatureId);
      formData.append('collectedAt', collectedAt);
      for (const { key } of FIELD_DEFS) {
        const value = form[key];
        if (value) formData.append(key, value);
      }
      const file = fileInputRef.current?.files?.[0];
      if (file) formData.append('documento', file);

      await apiUpload(`/fazendas/${farmId}/analises-solo`, formData, accessToken);
      setCollectedAt('');
      setForm({});
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar análise de solo');
    } finally {
      setCreating(false);
    }
  }

  async function handleDownload(analysis: SoilAnalysis) {
    if (!analysis.documentFileName) return;
    setError(null);
    try {
      await apiDownload(
        `/fazendas/${farmId}/analises-solo/${analysis.id}/baixar`,
        analysis.documentFileName,
        accessToken,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao baixar o laudo');
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/analises-solo/${id}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir análise');
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
        <Link href={`/fazendas/${farmId}/mapa`} className="text-sm text-green-700 hover:underline">
          ← Mapa da Fazenda
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">
          Análises de solo — {feature?.name ?? '...'}
        </h1>
        <p className="text-sm text-gray-500">
          Histórico de coletas para esta área. A recomendação de calagem usa o método da
          saturação por bases (heurística — não substitui avaliação agronômica).
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <form
        onSubmit={handleCreate}
        className="mb-8 grid grid-cols-2 gap-3 rounded border border-gray-200 bg-white p-4 sm:grid-cols-3"
      >
        <div>
          <label className="text-xs font-medium text-gray-600">Data da coleta</label>
          <input
            type="date"
            required
            value={collectedAt}
            onChange={(e) => setCollectedAt(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>
        {FIELD_DEFS.map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs font-medium text-gray-600">{label}</label>
            <input
              type="number"
              step="0.01"
              value={form[key] ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
            />
          </div>
        ))}
        <div className="col-span-full">
          <label className="text-xs font-medium text-gray-600">Laudo em PDF (opcional)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="mt-1 block w-full text-sm"
          />
        </div>
        <div className="col-span-full">
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {creating ? 'Salvando...' : 'Registrar análise'}
          </button>
        </div>
      </form>

      {history.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma análise registrada para esta área ainda.</p>
      ) : (
        <ul className="space-y-4">
          {history
            .slice()
            .reverse()
            .map((a) => {
              const rec = recommendations[a.id];
              return (
                <li key={a.id} className="rounded border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">
                      {new Date(a.collectedAt).toLocaleDateString('pt-BR')}
                    </p>
                    <div className="flex gap-3">
                      {a.documentFileName && (
                        <button
                          onClick={() => handleDownload(a)}
                          className="text-sm text-green-700 hover:underline"
                        >
                          Baixar laudo
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>

                  <dl className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-700 sm:grid-cols-3">
                    {FIELD_DEFS.filter(({ key }) => a[key] != null).map(({ key, label }) => (
                      <div key={key}>
                        <dt className="text-xs text-gray-500">{label}</dt>
                        <dd>{a[key] as number}</dd>
                      </div>
                    ))}
                  </dl>

                  {rec && (
                    <div className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="font-medium">
                        {rec.limingNeeded
                          ? `Calagem recomendada: ${rec.limestoneTonPerHa} t/ha (meta V% ${rec.targetBaseSaturationPercent}%)`
                          : 'Calagem não indicada pela heurística.'}
                      </p>
                      <ul className="mt-1 list-inside list-disc">
                        {rec.notes.map((note, i) => (
                          <li key={i}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
      )}
    </main>
  );
}
