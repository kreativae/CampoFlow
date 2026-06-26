'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Farm } from '@/lib/types';

export default function FarmsPage() {
  const { user, accessToken, loading, logout } = useAuth();
  const router = useRouter();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFarmName, setNewFarmName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadFarms = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<Farm[]>('/fazendas', { token: accessToken });
      setFarms(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar propriedades');
    } finally {
      setFetching(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    // Fetching data on mount via an async callback is the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFarms();
  }, [loading, user, loadFarms, router]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await apiFetch<Farm>('/fazendas', {
        method: 'POST',
        token: accessToken,
        body: { name: newFarmName },
      });
      setNewFarmName('');
      await loadFarms();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar propriedade');
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
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-green-800">CampoFlow</h1>
          <p className="text-sm text-gray-500">Olá, {user.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/cotacoes" className="text-sm font-medium text-green-700 hover:underline">
            Cotações
          </Link>
          <Link href="/seguranca" className="text-sm font-medium text-green-700 hover:underline">
            Segurança
          </Link>
          <button
            onClick={logout}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Sair
          </button>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleCreate} className="mb-8 flex gap-2">
        <input
          type="text"
          placeholder="Nome da nova propriedade"
          required
          value={newFarmName}
          onChange={(e) => setNewFarmName(e.target.value)}
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {creating ? 'Criando...' : 'Criar'}
        </button>
      </form>

      {fetching ? (
        <p className="text-gray-500">Carregando propriedades...</p>
      ) : farms.length === 0 ? (
        <p className="text-gray-500">Nenhuma propriedade cadastrada ainda.</p>
      ) : (
        <ul className="space-y-2">
          {farms.map((farm) => (
            <li key={farm.id}>
              <Link
                href={`/fazendas/${farm.id}`}
                className="block rounded border border-gray-200 bg-white px-4 py-3 hover:border-green-600 hover:shadow-sm"
              >
                <p className="font-medium text-gray-900">{farm.name}</p>
                <p className="text-sm text-gray-500">{farm.type}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
