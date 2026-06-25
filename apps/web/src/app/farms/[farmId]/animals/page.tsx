'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Animal, AnimalCategory, AnimalSex, Pasture } from '@/lib/types';

const SEX_OPTIONS: AnimalSex[] = ['FEMALE', 'MALE'];
const CATEGORY_OPTIONS: AnimalCategory[] = [
  'BEZERRO',
  'BEZERRA',
  'NOVILHO',
  'NOVILHA',
  'GARROTE',
  'BOI',
  'VACA',
  'TOURO',
  'MATRIZ',
];

export default function AnimalsPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [animals, setAnimals] = useState<Animal[]>([]);
  const [pastures, setPastures] = useState<Pasture[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [earTag, setEarTag] = useState('');
  const [sex, setSex] = useState<AnimalSex>('FEMALE');
  const [category, setCategory] = useState<AnimalCategory>('VACA');
  const [breed, setBreed] = useState('');
  const [pastureId, setPastureId] = useState('');

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [animalsData, pasturesData] = await Promise.all([
        apiFetch<Animal[]>(`/farms/${farmId}/animals`, { token: accessToken }),
        apiFetch<Pasture[]>(`/farms/${farmId}/pastures`, { token: accessToken }),
      ]);
      setAnimals(animalsData);
      setPastures(pasturesData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar o rebanho');
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
      await apiFetch<Animal>(`/farms/${farmId}/animals`, {
        method: 'POST',
        token: accessToken,
        body: {
          earTag,
          sex,
          category,
          breed: breed || undefined,
          pastureId: pastureId || undefined,
        },
      });
      setEarTag('');
      setBreed('');
      setPastureId('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar animal');
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
        <Link href={`/farms/${farmId}`} className="text-sm text-green-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">Rebanho</h1>
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
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs font-medium text-gray-600">Brinco</label>
          <input
            type="text"
            required
            value={earTag}
            onChange={(e) => setEarTag(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Sexo</label>
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value as AnimalSex)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          >
            {SEX_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'FEMALE' ? 'Fêmea' : 'Macho'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Categoria</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as AnimalCategory)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Raça</label>
          <input
            type="text"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Pasto</label>
          <select
            value={pastureId}
            onChange={(e) => setPastureId(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          >
            <option value="">— Sem pasto —</option>
            {pastures.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-full">
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {creating ? 'Cadastrando...' : 'Cadastrar animal'}
          </button>
        </div>
      </form>

      {fetching ? (
        <p className="text-gray-500">Carregando animais...</p>
      ) : animals.length === 0 ? (
        <p className="text-gray-500">Nenhum animal cadastrado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {animals.map((animal) => (
            <li key={animal.id}>
              <Link
                href={`/farms/${farmId}/animals/${animal.id}`}
                className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3 hover:border-green-600 hover:shadow-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">{animal.earTag}</p>
                  <p className="text-sm text-gray-500">
                    {animal.category} · {animal.breed ?? 'Raça não informada'}
                  </p>
                </div>
                <p className="text-sm text-gray-500">
                  {animal.currentWeightKg ? `${animal.currentWeightKg} kg` : '—'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
