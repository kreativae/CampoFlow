'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
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

  const [farm, setFarm] = useState<Farm | null>(null);
  const [features, setFeatures] = useState<MapFeature[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<MapFeatureType>('PASTAGEM');
  const [geometryType, setGeometryType] = useState<GeometryType>('PONTO');
  const [coordinatesText, setCoordinatesText] = useState('');

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [farmData, featuresData] = await Promise.all([
        apiFetch<Farm>(`/farms/${farmId}`, { token: accessToken }),
        apiFetch<MapFeature[]>(`/farms/${farmId}/map-features`, { token: accessToken }),
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
      const coordinates = parseCoordinates(coordinatesText);
      await apiFetch<MapFeature>(`/farms/${farmId}/map-features`, {
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
        <Link href={`/farms/${farmId}`} className="text-sm text-green-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">Mapa da Fazenda</h1>
        <p className="text-sm text-gray-500">
          Mapa renderizado com Leaflet + OpenStreetMap (sem necessidade de chave de API).
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="mb-8 overflow-hidden rounded border border-gray-200">
        <FarmMap center={center} features={features} />
      </div>

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
        <p className="text-gray-500">Nenhum elemento cadastrado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {features.map((f) => (
            <li key={f.id} className="rounded border border-gray-200 bg-white px-4 py-3">
              <p className="font-medium text-gray-900">{f.name}</p>
              <p className="text-sm text-gray-500">
                {TYPE_OPTIONS.find((opt) => opt.value === f.type)?.label} ·{' '}
                {f.geometryType === 'PONTO' ? 'Ponto' : `Polígono (${f.coordinates.length} pontos)`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
