'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useConfirm } from '@/lib/confirm-context';
import type { Machine, MachineCostSummary, MachineType } from '@/lib/types';

const TYPE_OPTIONS: { value: MachineType; label: string }[] = [
  { value: 'TRATOR', label: 'Trator' },
  { value: 'CAMINHAO', label: 'Caminhão' },
  { value: 'IMPLEMENTO', label: 'Implemento' },
  { value: 'OUTRO', label: 'Outro' },
];

function typeLabel(type: MachineType) {
  return TYPE_OPTIONS.find((opt) => opt.value === type)?.label ?? type;
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function MachinesPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();

  const [machines, setMachines] = useState<Machine[]>([]);
  const [costs, setCosts] = useState<MachineCostSummary[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<MachineType>('TRATOR');
  const [brand, setBrand] = useState('');
  const [year, setYear] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<MachineType>('TRATOR');
  const [editBrand, setEditBrand] = useState('');
  const [editYear, setEditYear] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [machinesData, costsData] = await Promise.all([
        apiFetch<Machine[]>(`/fazendas/${farmId}/maquinas`, { token: accessToken }),
        apiFetch<MachineCostSummary[]>(`/fazendas/${farmId}/maquinas/custos`, { token: accessToken }),
      ]);
      setMachines(machinesData);
      setCosts(costsData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar máquinas');
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
      await apiFetch<Machine>(`/fazendas/${farmId}/maquinas`, {
        method: 'POST',
        token: accessToken,
        body: { name, type, brand: brand || undefined, year: year ? Number(year) : undefined },
      });
      setName('');
      setBrand('');
      setYear('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar máquina');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(machine: Machine) {
    setEditingId(machine.id);
    setEditName(machine.name);
    setEditType(machine.type);
    setEditBrand(machine.brand ?? '');
    setEditYear(machine.year ? String(machine.year) : '');
  }

  async function handleSaveEdit(machineId: string) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/maquinas/${machineId}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          name: editName,
          type: editType,
          brand: editBrand || undefined,
          year: editYear ? Number(editYear) : undefined,
        },
      });
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar máquina');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(machine: Machine) {
    const ok = await confirm({
      title: 'Excluir máquina',
      message: `Excluir a máquina ${machine.name}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/maquinas/${machine.id}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir máquina');
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
        <h1 className="text-2xl font-semibold text-green-800">Máquinas</h1>
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
          <label className="text-xs font-medium text-gray-600">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MachineType)}
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
          <label className="text-xs font-medium text-gray-600">Ano</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-600">Marca (opcional)</label>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>

        <div className="col-span-full">
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {creating ? 'Cadastrando...' : 'Cadastrar máquina'}
          </button>
        </div>
      </form>

      {fetching ? (
        <p className="text-gray-500">Carregando máquinas...</p>
      ) : machines.length === 0 ? (
        <p className="text-gray-500">Nenhuma máquina cadastrada ainda.</p>
      ) : (
        <ul className="space-y-2">
          {machines.map((machine) => {
            const cost = costs.find((c) => c.machineId === machine.id);
            if (editingId === machine.id) {
              return (
                <li
                  key={machine.id}
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
                      onChange={(e) => setEditType(e.target.value as MachineType)}
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
                    <label className="text-xs font-medium text-gray-600">Ano</label>
                    <input
                      type="number"
                      value={editYear}
                      onChange={(e) => setEditYear(e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600">Marca</label>
                    <input
                      type="text"
                      value={editBrand}
                      onChange={(e) => setEditBrand(e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-full flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveEdit(machine.id)}
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
              );
            }
            return (
              <li
                key={machine.id}
                className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3 hover:border-green-600 hover:shadow-sm"
              >
                <Link href={`/fazendas/${farmId}/maquinas/${machine.id}`} className="flex-1">
                  <p className="font-medium text-gray-900">{machine.name}</p>
                  <p className="text-sm text-gray-500">
                    {typeLabel(machine.type)} · {machine.currentHourMeter}h
                  </p>
                </Link>
                <div className="flex items-center gap-3">
                  {cost && (
                    <p className="text-sm text-gray-500">Custo total: {formatCurrency(cost.totalCost)}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => startEdit(machine)}
                    className="text-sm font-medium text-green-700 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(machine)}
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
    </main>
  );
}
