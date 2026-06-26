'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Machine } from '@/lib/types';

export default function MachineDetailPage() {
  const { farmId, machineId } = useParams<{ farmId: string; machineId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [machine, setMachine] = useState<Machine | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [maintenanceDescription, setMaintenanceDescription] = useState('');
  const [maintenanceCost, setMaintenanceCost] = useState('');
  const [maintenanceHourMeter, setMaintenanceHourMeter] = useState('');
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  const [fuelLiters, setFuelLiters] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [fuelHourMeter, setFuelHourMeter] = useState('');
  const [savingFuel, setSavingFuel] = useState(false);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<Machine>(`/fazendas/${farmId}/maquinas/${machineId}`, {
        token: accessToken,
      });
      setMachine(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar a máquina');
    } finally {
      setFetching(false);
    }
  }, [farmId, machineId, accessToken]);

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

  async function handleAddMaintenance(event: FormEvent) {
    event.preventDefault();
    setSavingMaintenance(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/maquinas/${machineId}/manutencoes`, {
        method: 'POST',
        token: accessToken,
        body: {
          description: maintenanceDescription,
          cost: maintenanceCost ? Number(maintenanceCost) : undefined,
          hourMeterAt: maintenanceHourMeter ? Number(maintenanceHourMeter) : undefined,
        },
      });
      setMaintenanceDescription('');
      setMaintenanceCost('');
      setMaintenanceHourMeter('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar manutenção');
    } finally {
      setSavingMaintenance(false);
    }
  }

  async function handleAddFuel(event: FormEvent) {
    event.preventDefault();
    setSavingFuel(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/maquinas/${machineId}/registros-combustivel`, {
        method: 'POST',
        token: accessToken,
        body: {
          liters: Number(fuelLiters),
          cost: fuelCost ? Number(fuelCost) : undefined,
          hourMeterAt: fuelHourMeter ? Number(fuelHourMeter) : undefined,
        },
      });
      setFuelLiters('');
      setFuelCost('');
      setFuelHourMeter('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar abastecimento');
    } finally {
      setSavingFuel(false);
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
        <Link href={`/fazendas/${farmId}/maquinas`} className="text-sm text-green-700 hover:underline">
          ← Máquinas
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">{machine?.name}</h1>
        <p className="text-sm text-gray-500">
          {machine?.brand ?? 'Marca não informada'} · {machine?.year ?? '—'}
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <section className="mb-8">
        <SummaryCard label="Horímetro atual" value={`${machine?.currentHourMeter ?? 0} h`} />
      </section>

      <section className="mb-8 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Manutenção</h2>
        <form onSubmit={handleAddMaintenance} className="mb-4 flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Descrição"
            required
            value={maintenanceDescription}
            onChange={(e) => setMaintenanceDescription(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Custo (R$)"
            value={maintenanceCost}
            onChange={(e) => setMaintenanceCost(e.target.value)}
            className="w-32 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Horímetro"
            value={maintenanceHourMeter}
            onChange={(e) => setMaintenanceHourMeter(e.target.value)}
            className="w-32 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={savingMaintenance}
            className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {savingMaintenance ? 'Salvando...' : 'Registrar'}
          </button>
        </form>
        {!machine?.maintenances || machine.maintenances.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma manutenção registrada.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {machine.maintenances.map((m) => (
              <li key={m.id}>
                {new Date(m.performedAt).toLocaleDateString('pt-BR')} — {m.description}
                {m.cost != null ? ` (R$ ${m.cost})` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Abastecimento</h2>
        <form onSubmit={handleAddFuel} className="mb-4 flex flex-wrap gap-2">
          <input
            type="number"
            step="0.1"
            placeholder="Litros"
            required
            value={fuelLiters}
            onChange={(e) => setFuelLiters(e.target.value)}
            className="w-28 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Custo (R$)"
            value={fuelCost}
            onChange={(e) => setFuelCost(e.target.value)}
            className="w-32 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Horímetro"
            value={fuelHourMeter}
            onChange={(e) => setFuelHourMeter(e.target.value)}
            className="w-32 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={savingFuel}
            className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {savingFuel ? 'Salvando...' : 'Registrar'}
          </button>
        </form>
        {!machine?.fuelRecords || machine.fuelRecords.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum abastecimento registrado.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {machine.fuelRecords.map((f) => (
              <li key={f.id}>
                {new Date(f.recordedAt).toLocaleDateString('pt-BR')} — {f.liters}L
                {f.cost != null ? ` (R$ ${f.cost})` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3 inline-block">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}
