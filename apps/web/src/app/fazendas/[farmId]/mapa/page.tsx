'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useConfirm } from '@/lib/confirm-context';
import type { Farm, GeometryType, MapFeature, MapFeatureType } from '@/lib/types';

const FarmMap = dynamic(() => import('./farm-map'), { ssr: false });

const TYPE_OPTIONS: { value: MapFeatureType; label: string }[] = [
  { value: 'CERCA', label: 'Cerca' },
  { value: 'PASTAGEM', label: 'Pastagem' },
  { value: 'NASCENTE', label: 'Nascente' },
  { value: 'RESERVA', label: 'Reserva' },
  { value: 'OUTRO', label: 'Outro' },
];

const DEFAULT_CENTER: [number, number] = [-15.793889, -47.882778];

function parseCoordinates(raw: string): [number, number][] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [lat, lng] = line.split(',').map((v) => Number(v.trim()));
      return [lat, lng] as [number, number];
    });
}

export default function FarmMapPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();

  const [farm, setFarm] = useState<Farm | null>(null);
  const [features, setFeatures] = useState<MapFeature[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [focusedFeature, setFocusedFeature] = useState<MapFeature | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  function handleViewOnMap(feature: MapFeature) {
    setFocusedFeature(feature);
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const [name, setName] = useState('');
  const [type, setType] = useState<MapFeatureType>('PASTAGEM');
  const [geometryType, setGeometryType] = useState<GeometryType>('PONTO');
  const [coordinatesText, setCoordinatesText] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<MapFeatureType>('PASTAGEM');
  const [editGeometryType, setEditGeometryType] = useState<GeometryType>('PONTO');
  const [editCoordinatesText, setEditCoordinatesText] = useState('');
  const [saving, setSaving] = useState(false);

  const [savingLocation, setSavingLocation] = useState(false);

  const [cityQuery, setCityQuery] = useState('');
  const [citySearching, setCitySearching] = useState(false);
  const [cityResults, setCityResults] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const citySearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [farmData, featuresData] = await Promise.all([
        apiFetch<Farm>(`/fazendas/${farmId}`, { token: accessToken }),
        apiFetch<MapFeature[]>(`/fazendas/${farmId}/elementos-mapa`, { token: accessToken }),
      ]);
      setFarm(farmData);
      setFeatures(featuresData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar o mapa');
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
      const coordinates = parseCoordinates(coordinatesText);
      await apiFetch<MapFeature>(`/fazendas/${farmId}/elementos-mapa`, {
        method: 'POST',
        token: accessToken,
        body: { name, type, geometryType, coordinates },
      });
      setName('');
      setCoordinatesText('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar elemento do mapa');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(feature: MapFeature) {
    setEditingId(feature.id);
    setEditName(feature.name);
    setEditType(feature.type);
    setEditGeometryType(feature.geometryType);
    setEditCoordinatesText(feature.coordinates.map(([lat, lng]) => `${lat}, ${lng}`).join('\n'));
  }

  async function handleSaveEdit(featureId: string) {
    setSaving(true);
    setError(null);
    try {
      const coordinates = parseCoordinates(editCoordinatesText);
      await apiFetch(`/fazendas/${farmId}/elementos-mapa/${featureId}`, {
        method: 'PATCH',
        token: accessToken,
        body: { name: editName, type: editType, geometryType: editGeometryType, coordinates },
      });
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar elemento do mapa');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(feature: MapFeature) {
    const ok = await confirm({
      title: 'Excluir elemento do mapa',
      message: `Excluir o elemento ${feature.name}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/elementos-mapa/${feature.id}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir elemento do mapa');
    }
  }

  async function runCitySearch(query: string) {
    setCitySearching(true);
    setError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=br&q=${encodeURIComponent(query)}`,
      );
      if (!res.ok) throw new Error('Erro ao buscar localização');
      const results = (await res.json()) as { display_name: string; lat: string; lon: string }[];
      setCityResults(
        results.map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) })),
      );
    } catch {
      setError('Erro ao buscar a cidade/estado. Tente novamente.');
    } finally {
      setCitySearching(false);
    }
  }

  function handleCityQueryChange(value: string) {
    setCityQuery(value);
    if (citySearchDebounce.current) clearTimeout(citySearchDebounce.current);
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setCityResults([]);
      return;
    }
    citySearchDebounce.current = setTimeout(() => {
      void runCitySearch(trimmed);
    }, 400);
  }

  async function selectCityResult(result: { label: string; lat: number; lng: number }) {
    setCityResults([]);
    setCityQuery('');
    setSavingLocation(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}`, {
        method: 'PATCH',
        token: accessToken,
        body: { latitude: result.lat, longitude: result.lng },
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar a localização da fazenda');
    } finally {
      setSavingLocation(false);
    }
  }

  async function handleQuickCreate(lat: number, lng: number, featureName: string, featureType: MapFeatureType) {
    await apiFetch<MapFeature>(`/fazendas/${farmId}/elementos-mapa`, {
      method: 'POST',
      token: accessToken,
      body: { name: featureName, type: featureType, geometryType: 'PONTO', coordinates: [[lat, lng]] },
    });
    await loadData();
  }

  if (loading || !user || fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  const center: [number, number] =
    farm?.latitude != null && farm?.longitude != null
      ? [farm.latitude, farm.longitude]
      : DEFAULT_CENTER;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8">
        <Link href={`/fazendas/${farmId}`} className="text-sm text-green-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">Solo</h1>
        <p className="text-sm text-gray-500">
          Mapa renderizado com Leaflet + OpenStreetMap (sem necessidade de chave de API).
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div ref={mapRef} className="mb-2 overflow-hidden rounded border border-gray-200">
        <FarmMap
          center={center}
          features={features}
          onQuickCreate={handleQuickCreate}
          focusFeature={focusedFeature}
        />
      </div>
      <p className="mb-8 text-xs text-gray-400">
        Dica: clique com o botão direito no mapa para cadastrar um novo elemento naquele ponto.
      </p>

      <section className="mb-8 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Localização da fazenda</h2>
        <p className="mb-3 text-sm text-gray-500">
          Comece a digitar a cidade/estado da fazenda para posicionar o mapa corretamente.
        </p>

        <div className="relative">
          <label className="text-xs font-medium text-gray-600">Cidade, estado</label>
          <input
            type="text"
            value={cityQuery}
            onChange={(e) => handleCityQueryChange(e.target.value)}
            placeholder="Ex.: Uberaba, MG"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
          {citySearching && <p className="mt-1 text-xs text-gray-400">Buscando...</p>}
          {cityResults.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full max-h-48 space-y-1 overflow-y-auto rounded border border-gray-200 bg-white p-2 shadow-md">
              {cityResults.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => selectCityResult(r)}
                    className="w-full rounded px-2 py-1 text-left text-sm text-gray-700 hover:bg-green-50"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {savingLocation && <p className="mt-2 text-xs text-gray-400">Salvando localização...</p>}
      </section>

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
          <label className="text-xs font-medium text-gray-600">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MapFeatureType)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Geometria</label>
          <select
            value={geometryType}
            onChange={(e) => setGeometryType(e.target.value as GeometryType)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          >
            <option value="PONTO">Ponto</option>
            <option value="POLIGONO">Polígono</option>
          </select>
        </div>

        <div className="col-span-full">
          <label className="text-xs font-medium text-gray-600">
            Coordenadas (uma por linha, formato &quot;lat, lng&quot;
            {geometryType === 'PONTO' ? ' — apenas uma linha' : ' — mínimo 3 linhas'})
          </label>
          <textarea
            required
            rows={3}
            value={coordinatesText}
            onChange={(e) => setCoordinatesText(e.target.value)}
            placeholder={'-15.793889, -47.882778'}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div className="col-span-full">
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {creating ? 'Salvando...' : 'Adicionar ao mapa'}
          </button>
        </div>
      </form>

      {features.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
          <p className="text-lg font-medium text-gray-700">Nenhum elemento no mapa</p>
          <p className="mt-1 text-sm text-gray-500">Cadastre cercas, cochos, represas e outros pontos de interesse da propriedade.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {features.map((f) =>
            editingId === f.id ? (
              <li
                key={f.id}
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
                  <label className="text-xs font-medium text-gray-600">Tipo</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as MapFeatureType)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Geometria</label>
                  <select
                    value={editGeometryType}
                    onChange={(e) => setEditGeometryType(e.target.value as GeometryType)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                  >
                    <option value="PONTO">Ponto</option>
                    <option value="POLIGONO">Polígono</option>
                  </select>
                </div>
                <div className="col-span-full">
                  <label className="text-xs font-medium text-gray-600">Coordenadas</label>
                  <textarea
                    rows={3}
                    value={editCoordinatesText}
                    onChange={(e) => setEditCoordinatesText(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                  />
                </div>
                <div className="col-span-full flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveEdit(f.id)}
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
                key={f.id}
                className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900">{f.name}</p>
                  <p className="text-sm text-gray-500">
                    {TYPE_OPTIONS.find((opt) => opt.value === f.type)?.label} ·{' '}
                    {f.geometryType === 'PONTO' ? 'Ponto' : `Polígono (${f.coordinates.length} pontos)`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/fazendas/${farmId}/mapa/solo/${f.id}`}
                    className="shrink-0 text-sm font-medium text-green-700 hover:underline"
                  >
                    Análises de solo →
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleViewOnMap(f)}
                    className="text-sm font-medium text-green-700 hover:underline"
                  >
                    Ver no mapa
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(f)}
                    className="text-sm font-medium text-green-700 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(f)}
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
