'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Pasture } from '@/lib/types';

export default function PasturesPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [pastures, setPastures] = useState<Pasture[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [areaHectares, setAreaHectares] = useState('');
  const [grassType, setGrassType] = useState('');
  const [animalCapacity, setAnimalCapacity] = useState('');

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<Pasture[]>(`/fazendas/${farmId}/pastagens`, { token: accessToken });
      setPastures(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar pastagens');
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
      await apiFetch<Pasture>(`/fazendas/${farmId}/pastagens`, {
        method: 'POST',
        token: accessToken,
        body: {
          name,
          areaHectares: Number(areaHectares),
          grassType: grassType || undefined,
          animalCapacity: Number(animalCapacity),
        },
      });
      setName('');
      setAreaHectares('');
      setGrassType('');
      setAnimalCapacity('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar pasto');
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
        <Link href={`/fazendas/${farmId}`} className="text-sm text-green-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">Pastagens</h1>
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
          <label className="text-xs font-medium text-gray-600">Área (ha)</label>
          <input
            type="number"
            step="0.01"
            required
            value={areaHectares}
            onChange={(e) => setAreaHectares(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Capacidade (animais)</label>
          <input
            type="number"
            required
            value={animalCapacity}
            onChange={(e) => setAnimalCapacity(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div className="col-span-2 sm:col-span-3">
          <label className="text-xs font-medium text-gray-600">Tipo de capim</label>
          <input
            type="text"
            value={grassType}
            onChange={(e) => setGrassType(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div className="col-span-full">
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {creating ? 'Cadastrando...' : 'Cadastrar pasto'}
          </button>
        </div>
      </form>

      {fetching ? (
        <p className="text-gray-500">Carregando pastos...</p>
      ) : pastures.length === 0 ? (
        <p className="text-gray-500">Nenhum pasto cadastrado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {pastures.map((pasture) => (
            <li key={pasture.id}>
              <Link
                href={`/fazendas/${farmId}/pastagens/${pasture.id}`}
                className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3 hover:border-green-600 hover:shadow-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">{pasture.name}</p>
                  <p className="text-sm text-gray-500">
                    {pasture.areaHectares} ha · {pasture.grassType ?? 'Capim não informado'}
                  </p>
                </div>
                <p className="text-sm text-gray-500">Cap. {pasture.animalCapacity} animais</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
