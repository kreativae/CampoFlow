'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, apiUpload, apiDownload, ApiError } from '@/lib/api';
import type {
  MapFeature,
  SoilAnalysis,
  SoilAnalysisPhoto,
  SoilAnalysisRecommendation,
} from '@/lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

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
  const [areaLabel, setAreaLabel] = useState('');
  const [form, setForm] = useState<FormState>({});

  const [chartField, setChartField] = useState<keyof SoilAnalysis>('ph');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCollectedAt, setEditCollectedAt] = useState('');
  const [editAreaLabel, setEditAreaLabel] = useState('');
  const [editForm, setEditForm] = useState<FormState>({});
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [uploadingPhotosFor, setUploadingPhotosFor] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [selectedPhotoCount, setSelectedPhotoCount] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
      if (areaLabel) formData.append('areaLabel', areaLabel);
      for (const { key } of FIELD_DEFS) {
        const value = form[key];
        if (value) formData.append(key, value);
      }
      const file = fileInputRef.current?.files?.[0];
      if (file) formData.append('documento', file);

      await apiUpload(`/fazendas/${farmId}/analises-solo`, formData, accessToken);
      setCollectedAt('');
      setAreaLabel('');
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

  function startEdit(analysis: SoilAnalysis) {
    setEditingId(analysis.id);
    setEditCollectedAt(analysis.collectedAt.slice(0, 10));
    setEditAreaLabel(analysis.areaLabel ?? '');
    setEditNotes(analysis.notes ?? '');
    const next: FormState = {};
    for (const { key } of FIELD_DEFS) {
      const value = analysis[key];
      if (value != null) next[key] = String(value);
    }
    setEditForm(next);
  }

  async function handleSaveEdit(id: string) {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        collectedAt: editCollectedAt,
        areaLabel: editAreaLabel || undefined,
        notes: editNotes || undefined,
      };
      for (const { key } of FIELD_DEFS) {
        const value = editForm[key];
        body[key] = value ? Number(value) : undefined;
      }
      await apiFetch(`/fazendas/${farmId}/analises-solo/${id}`, {
        method: 'PATCH',
        token: accessToken,
        body,
      });
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar análise');
    } finally {
      setSaving(false);
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

  async function handleUploadPhotos(analysisId: string) {
    const input = photoInputRefs.current[analysisId];
    const files = input?.files;
    if (!files || files.length === 0) {
      setPhotoError('Selecione ao menos uma foto antes de enviar.');
      return;
    }

    setUploadingPhotos(true);
    setPhotoError(null);
    try {
      const formData = new FormData();
      const metadata: { takenAt?: string; latitude?: number; longitude?: number }[] = [];

      for (let i = 0; i < files.length; i++) {
        formData.append('fotos', files[i]);
        const meta: { takenAt?: string; latitude?: number; longitude?: number } = {};

        if (files[i].lastModified) {
          meta.takenAt = new Date(files[i].lastModified).toISOString();
        }
        metadata.push(meta);
      }
      formData.append('metadata', JSON.stringify(metadata));

      await apiUpload(
        `/fazendas/${farmId}/analises-solo/${analysisId}/fotos`,
        formData,
        accessToken,
      );
      if (input) input.value = '';
      setSelectedPhotoCount(0);
      setUploadingPhotosFor(null);
      await loadData();
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : 'Erro ao enviar fotos');
    } finally {
      setUploadingPhotos(false);
    }
  }

  async function handleDeletePhoto(analysisId: string, photoId: string) {
    setError(null);
    try {
      await apiFetch(
        `/fazendas/${farmId}/analises-solo/${analysisId}/fotos/${photoId}`,
        { method: 'DELETE', token: accessToken },
      );
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir foto');
    }
  }

  async function handleDownloadPhoto(analysisId: string, photo: SoilAnalysisPhoto) {
    setError(null);
    try {
      await apiDownload(
        `/fazendas/${farmId}/analises-solo/${analysisId}/fotos/${photo.id}/baixar`,
        photo.fileName,
        accessToken,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao baixar foto');
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
        <Link href={`/fazendas/${farmId}/mapa`} className="text-sm text-emerald-700 hover:underline">
          ← Mapa da Fazenda
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Análises de solo — {feature?.name ?? '...'}
        </h1>
        <p className="text-sm text-gray-500">
          Histórico de coletas para esta área. A recomendação de calagem usa o método da
          saturação por bases (heurística — não substitui avaliação agronômica).
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <form
        onSubmit={handleCreate}
        className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4 sm:grid-cols-3"
      >
        <div>
          <label className="text-xs font-medium text-gray-600">Data da coleta</label>
          <input
            type="date"
            required
            value={collectedAt}
            onChange={(e) => setCollectedAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Identificação da área (opcional)</label>
          <input
            type="text"
            value={areaLabel}
            onChange={(e) => setAreaLabel(e.target.value)}
            placeholder="Ex.: Talhão 3"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
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
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
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
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
          >
            {creating ? 'Salvando...' : 'Registrar análise'}
          </button>
        </div>
      </form>

      {history.length >= 2 && (
        <section className="mb-8 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Evolução dos valores</h2>
            <select
              value={chartField}
              onChange={(e) => setChartField(e.target.value as keyof SoilAnalysis)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            >
              {FIELD_DEFS.map(({ key, label }) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <SoilEvolutionChart history={history} field={chartField} />
        </section>
      )}

      {history.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma análise registrada para esta área ainda.</p>
      ) : (
        <ul className="space-y-4">
          {history
            .slice()
            .reverse()
            .map((a) => {
              const rec = recommendations[a.id];
              const photos = a.photos ?? [];
              return (
                <li key={a.id} className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
                  {editingId === a.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600">Data da coleta</label>
                          <input
                            type="date"
                            value={editCollectedAt}
                            onChange={(e) => setEditCollectedAt(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Identificação da área</label>
                          <input
                            type="text"
                            value={editAreaLabel}
                            onChange={(e) => setEditAreaLabel(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                          />
                        </div>
                        {FIELD_DEFS.map(({ key, label }) => (
                          <div key={key}>
                            <label className="text-xs font-medium text-gray-600">{label}</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editForm[key] ?? ''}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, [key]: e.target.value }))
                              }
                              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                            />
                          </div>
                        ))}
                        <div className="col-span-full">
                          <label className="text-xs font-medium text-gray-600">Observações</label>
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleSaveEdit(a.id)}
                          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
                        >
                          {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900">
                          {new Date(a.collectedAt).toLocaleDateString('pt-BR')}
                          {a.areaLabel ? ` — ${a.areaLabel}` : ''}
                        </p>
                        <div className="flex gap-3">
                          {a.documentFileName && (
                            <button
                              onClick={() => handleDownload(a)}
                              className="text-sm text-emerald-700 hover:underline"
                            >
                              Baixar laudo
                            </button>
                          )}
                          <button
                            onClick={() => startEdit(a)}
                            className="text-sm text-emerald-700 hover:underline"
                          >
                            Editar
                          </button>
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

                      {a.notes && <p className="mt-2 text-sm text-gray-600">{a.notes}</p>}

                      {rec && (
                        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
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

                      {/* --- Fotos --- */}
                      <div className="mt-4 border-t border-gray-100 pt-3">
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="text-sm font-medium text-gray-700">
                            Fotos ({photos.length})
                          </h3>
                          <button
                            type="button"
                            onClick={() => { setUploadingPhotosFor(uploadingPhotosFor === a.id ? null : a.id); setSelectedPhotoCount(0); setPhotoError(null); }}
                            className="text-xs font-medium text-emerald-700 hover:underline"
                          >
                            {uploadingPhotosFor === a.id ? 'Cancelar' : 'Anexar fotos'}
                          </button>
                        </div>

                        {uploadingPhotosFor === a.id && (
                          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                            {photoError && (
                              <p className="mb-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">{photoError}</p>
                            )}
                            <input
                              ref={(el) => { photoInputRefs.current[a.id] = el; }}
                              type="file"
                              accept="image/*"
                              multiple
                              className="block w-full text-sm"
                              onChange={(e) => { setSelectedPhotoCount(e.target.files?.length ?? 0); setPhotoError(null); }}
                            />
                            <p className="mt-1 text-xs text-gray-400">
                              Selecione uma ou mais imagens. A data de modificação do arquivo será usada como data da foto.
                            </p>
                            <button
                              type="button"
                              disabled={uploadingPhotos}
                              onClick={() => handleUploadPhotos(a.id)}
                              className="mt-2 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
                            >
                              {uploadingPhotos ? 'Enviando...' : selectedPhotoCount > 0 ? `Enviar ${selectedPhotoCount} foto${selectedPhotoCount > 1 ? 's' : ''}` : 'Enviar fotos'}
                            </button>
                          </div>
                        )}

                        {photos.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {photos.map((photo) => (
                              <div
                                key={photo.id}
                                className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
                              >
                                <PhotoThumbnail
                                  url={`${API_URL}/fazendas/${farmId}/analises-solo/${a.id}/fotos/${photo.id}/baixar`}
                                  alt={photo.caption || photo.fileName}
                                  token={accessToken}
                                />
                                <div className="p-1.5">
                                  <p className="truncate text-xs font-medium text-gray-700">
                                    {photo.fileName}
                                  </p>
                                  <div className="flex flex-wrap gap-x-2 text-[10px] text-gray-400">
                                    {photo.takenAt && (
                                      <span>
                                        {new Date(photo.takenAt).toLocaleString('pt-BR', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    )}
                                    {photo.latitude != null && photo.longitude != null && (
                                      <span>
                                        {photo.latitude.toFixed(4)}, {photo.longitude.toFixed(4)}
                                      </span>
                                    )}
                                    <span>
                                      {(photo.sizeBytes / 1024).toFixed(0)} KB
                                    </span>
                                  </div>
                                </div>
                                <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadPhoto(a.id, photo)}
                                    className="rounded-lg bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 shadow-sm hover:bg-white"
                                  >
                                    Baixar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePhoto(a.id, photo.id)}
                                    className="rounded-lg bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-red-600 shadow-sm hover:bg-white"
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {photos.length === 0 && uploadingPhotosFor !== a.id && (
                          <p className="text-xs text-gray-400">
                            Nenhuma foto anexada. Clique em &quot;Anexar fotos&quot; para adicionar registros visuais.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </li>
              );
            })}
        </ul>
      )}
    </main>
  );
}

function PhotoThumbnail({
  url,
  alt,
  token,
}: {
  url: string;
  alt: string;
  token?: string | null;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    fetch(url, { headers })
      .then((res) => {
        if (!res.ok) return;
        return res.blob();
      })
      .then((blob) => {
        if (!blob) return;
        revoke = URL.createObjectURL(blob);
        setSrc(revoke);
      })
      .catch(() => {});

    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [url, token]);

  if (!src) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-gray-100 text-xs text-gray-400">
        Carregando...
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="aspect-square w-full object-cover" />
  );
}

function SoilEvolutionChart({
  history,
  field,
}: {
  history: SoilAnalysis[];
  field: keyof SoilAnalysis;
}) {
  const points = history.filter((a) => a[field] != null);
  if (points.length < 2) {
    return (
      <p className="text-sm text-gray-500">
        É preciso de pelo menos 2 análises com este indicador para o gráfico.
      </p>
    );
  }

  const width = 600;
  const height = 200;
  const padding = 28;
  const values = points.map((p) => p[field] as number);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const coords = points.map((p, i) => {
    const x = padding + (i / (points.length - 1)) * (width - padding * 2);
    const y =
      height - padding - (((p[field] as number) - minValue) / range) * (height - padding * 2);
    return { x, y, ...p };
  });

  const path = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Evolução do indicador"
    >
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="#e5e7eb"
      />
      <path d={path} fill="none" stroke="#15803d" strokeWidth={2} />
      {coords.map((c) => (
        <circle key={c.id} cx={c.x} cy={c.y} r={3} fill="#15803d" />
      ))}
      <text x={padding} y={14} fontSize={8} fill="#6b7280">
        {maxValue.toFixed(2)}
      </text>
      <text x={padding} y={height - padding + 12} fontSize={8} fill="#6b7280">
        {minValue.toFixed(2)}
      </text>
      <text x={coords[0].x} y={height - 6} fontSize={7} fill="#9ca3af">
        {new Date(coords[0].collectedAt).toLocaleDateString('pt-BR')}
      </text>
      <text
        x={coords[coords.length - 1].x}
        y={height - 6}
        fontSize={7}
        fill="#9ca3af"
        textAnchor="end"
      >
        {new Date(coords[coords.length - 1].collectedAt).toLocaleDateString('pt-BR')}
      </text>
    </svg>
  );
}
