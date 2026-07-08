'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useConfirm } from '@/lib/confirm-context';
import { useToast } from '@/lib/toast-context';
import type { Pasture } from '@/lib/types';

export default function PasturesPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const { toastSuccess } = useToast();

  const [pastures, setPastures] = useState<Pasture[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [areaHectares, setAreaHectares] = useState('');
  const [grassType, setGrassType] = useState('');
  const [animalCapacity, setAnimalCapacity] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAreaHectares, setEditAreaHectares] = useState('');
  const [editGrassType, setEditGrassType] = useState('');
  const [editAnimalCapacity, setEditAnimalCapacity] = useState('');
  const [saving, setSaving] = useState(false);

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

  // Fecha a visualização rápida ao pressionar Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setEditingId(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      toastSuccess('Pasto cadastrado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar pasto');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(pasture: Pasture) {
    setEditingId(pasture.id);
    setEditName(pasture.name);
    setEditAreaHectares(String(pasture.areaHectares));
    setEditGrassType(pasture.grassType ?? '');
    setEditAnimalCapacity(String(pasture.animalCapacity));
  }

  async function handleSaveEdit(pastureId: string) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/pastagens/${pastureId}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          name: editName,
          areaHectares: Number(editAreaHectares),
          grassType: editGrassType || undefined,
          animalCapacity: Number(editAnimalCapacity),
        },
      });
      setEditingId(null);
      await loadData();
      toastSuccess('Pasto atualizado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar pasto');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(pasture: Pasture) {
    const ok = await confirm({
      title: 'Excluir pasto',
      message: `Excluir o pasto ${pasture.name}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/pastagens/${pasture.id}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
      toastSuccess('Pasto excluído.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir pasto');
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
        <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
          <p className="text-lg font-medium text-gray-700">Nenhum pasto cadastrado</p>
          <p className="mt-1 text-sm text-gray-500">Cadastre seu primeiro pasto para controlar a lotação e rotação do rebanho.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {pastures.map((pasture) => {
            const occupiedHeadCount = pasture.animalHeadCount ?? 0;
            return (
              <li
                key={pasture.id}
                className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3 hover:border-green-600 hover:shadow-sm"
              >
                <Link href={`/fazendas/${farmId}/pastagens/${pasture.id}`} className="flex-1">
                  <p className="font-medium text-gray-900">{pasture.name}</p>
                  <p className="text-sm text-gray-500">
                    {pasture.areaHectares} ha · {pasture.grassType ?? 'Capim não informado'}
                  </p>
                </Link>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-500">
                    {occupiedHeadCount}/{pasture.animalCapacity} animais
                  </p>
                  <button
                    type="button"
                    onClick={() => startEdit(pasture)}
                    className="text-sm font-medium text-green-700 hover:underline"
                  >
                    Visualização rápida
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(pasture)}
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingId(null);
          }}
        >
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Visualização rápida — {editName}
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
                <label className="text-xs font-medium text-gray-600">Nome</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Área (ha)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editAreaHectares}
                  onChange={(e) => setEditAreaHectares(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Capacidade</label>
                <input
                  type="number"
                  value={editAnimalCapacity}
                  onChange={(e) => setEditAnimalCapacity(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600">Tipo de capim</label>
                <input
                  type="text"
                  value={editGrassType}
                  onChange={(e) => setEditGrassType(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <Link
                href={`/fazendas/${farmId}/pastagens/${editingId}`}
                className="text-sm font-medium text-green-700 hover:underline"
              >
                Ver detalhes completos →
              </Link>
              <div className="flex gap-2">
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
        </div>
      )}
    </main>
  );
}
