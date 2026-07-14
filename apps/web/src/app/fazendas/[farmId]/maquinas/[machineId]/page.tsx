'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useConfirm } from '@/lib/confirm-context';
import type { Machine, MachineMaintenance, MachineFuelRecord } from '@/lib/types';

export default function MachineDetailPage() {
  const { farmId, machineId } = useParams<{ farmId: string; machineId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();

  const [machine, setMachine] = useState<Machine | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [maintenanceDescription, setMaintenanceDescription] = useState('');
  const [maintenanceCost, setMaintenanceCost] = useState('');
  const [maintenanceHourMeter, setMaintenanceHourMeter] = useState('');
  const [maintenanceCreateTransaction, setMaintenanceCreateTransaction] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  const [fuelLiters, setFuelLiters] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [fuelHourMeter, setFuelHourMeter] = useState('');
  const [fuelCreateTransaction, setFuelCreateTransaction] = useState(false);
  const [savingFuel, setSavingFuel] = useState(false);

  const [chartGranularity, setChartGranularity] = useState<'day' | 'week' | 'month'>(
    'week',
  );

  const [editingMaintenanceId, setEditingMaintenanceId] = useState<string | null>(null);
  const [editMaintenanceDescription, setEditMaintenanceDescription] = useState('');
  const [editMaintenanceCost, setEditMaintenanceCost] = useState('');
  const [editMaintenanceHourMeter, setEditMaintenanceHourMeter] = useState('');
  const [editMaintenanceDate, setEditMaintenanceDate] = useState('');
  const [savingMaintenanceEdit, setSavingMaintenanceEdit] = useState(false);

  const [editingFuelId, setEditingFuelId] = useState<string | null>(null);
  const [editFuelLiters, setEditFuelLiters] = useState('');
  const [editFuelCost, setEditFuelCost] = useState('');
  const [editFuelHourMeter, setEditFuelHourMeter] = useState('');
  const [editFuelDate, setEditFuelDate] = useState('');
  const [savingFuelEdit, setSavingFuelEdit] = useState(false);

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
          createTransaction: maintenanceCreateTransaction,
        },
      });
      setMaintenanceDescription('');
      setMaintenanceCost('');
      setMaintenanceHourMeter('');
      setMaintenanceCreateTransaction(false);
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
          createTransaction: fuelCreateTransaction,
        },
      });
      setFuelLiters('');
      setFuelCost('');
      setFuelHourMeter('');
      setFuelCreateTransaction(false);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar abastecimento');
    } finally {
      setSavingFuel(false);
    }
  }

  function startEditMaintenance(m: MachineMaintenance) {
    setEditingMaintenanceId(m.id);
    setEditMaintenanceDescription(m.description);
    setEditMaintenanceCost(m.cost != null ? String(m.cost) : '');
    setEditMaintenanceHourMeter(m.hourMeterAt != null ? String(m.hourMeterAt) : '');
    setEditMaintenanceDate(m.performedAt.slice(0, 10));
  }

  async function handleSaveMaintenanceEdit(maintenanceId: string) {
    setSavingMaintenanceEdit(true);
    setError(null);
    try {
      await apiFetch(
        `/fazendas/${farmId}/maquinas/${machineId}/manutencoes/${maintenanceId}`,
        {
          method: 'PATCH',
          token: accessToken,
          body: {
            description: editMaintenanceDescription,
            cost: editMaintenanceCost ? Number(editMaintenanceCost) : undefined,
            hourMeterAt: editMaintenanceHourMeter
              ? Number(editMaintenanceHourMeter)
              : undefined,
            performedAt: editMaintenanceDate
              ? new Date(editMaintenanceDate).toISOString()
              : undefined,
          },
        },
      );
      setEditingMaintenanceId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar manutenção');
    } finally {
      setSavingMaintenanceEdit(false);
    }
  }

  async function handleDeleteMaintenance(maintenanceId: string) {
    const ok = await confirm({
      title: 'Excluir manutenção',
      message: 'Excluir este registro de manutenção? Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(
        `/fazendas/${farmId}/maquinas/${machineId}/manutencoes/${maintenanceId}`,
        { method: 'DELETE', token: accessToken },
      );
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir manutenção');
    }
  }

  function startEditFuel(f: MachineFuelRecord) {
    setEditingFuelId(f.id);
    setEditFuelLiters(String(f.liters));
    setEditFuelCost(f.cost != null ? String(f.cost) : '');
    setEditFuelHourMeter(f.hourMeterAt != null ? String(f.hourMeterAt) : '');
    setEditFuelDate(f.recordedAt.slice(0, 10));
  }

  async function handleSaveFuelEdit(fuelRecordId: string) {
    setSavingFuelEdit(true);
    setError(null);
    try {
      await apiFetch(
        `/fazendas/${farmId}/maquinas/${machineId}/registros-combustivel/${fuelRecordId}`,
        {
          method: 'PATCH',
          token: accessToken,
          body: {
            liters: editFuelLiters ? Number(editFuelLiters) : undefined,
            cost: editFuelCost ? Number(editFuelCost) : undefined,
            hourMeterAt: editFuelHourMeter ? Number(editFuelHourMeter) : undefined,
            recordedAt: editFuelDate
              ? new Date(editFuelDate).toISOString()
              : undefined,
          },
        },
      );
      setEditingFuelId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar abastecimento');
    } finally {
      setSavingFuelEdit(false);
    }
  }

  async function handleDeleteFuel(fuelRecordId: string) {
    const ok = await confirm({
      title: 'Excluir abastecimento',
      message: 'Excluir este registro de abastecimento? Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(
        `/fazendas/${farmId}/maquinas/${machineId}/registros-combustivel/${fuelRecordId}`,
        { method: 'DELETE', token: accessToken },
      );
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir abastecimento');
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
        <Link href={`/fazendas/${farmId}/maquinas`} className="text-sm text-emerald-700 hover:underline">
          ← Máquinas
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{machine?.name}</h1>
        <p className="text-sm text-gray-500">
          {machine?.brand ?? 'Marca não informada'} · {machine?.year ?? '—'}
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <section className="mb-8">
        <SummaryCard label="Horímetro atual" value={`${machine?.currentHourMeter ?? 0} h`} />
      </section>

      <section className="mb-8 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Gastos (manutenção + combustível)</h2>
          <div className="flex gap-1">
            {(['day', 'week', 'month'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setChartGranularity(g)}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  chartGranularity === g
                    ? 'bg-emerald-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {g === 'day' ? 'Dia' : g === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
        </div>
        <SpendingChart machine={machine} granularity={chartGranularity} />
      </section>

      <section className="mb-8 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Manutenção</h2>
        <form onSubmit={handleAddMaintenance} className="mb-4 flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Descrição"
            required
            value={maintenanceDescription}
            onChange={(e) => setMaintenanceDescription(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Custo (R$)"
            value={maintenanceCost}
            onChange={(e) => setMaintenanceCost(e.target.value)}
            className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Horímetro"
            value={maintenanceHourMeter}
            onChange={(e) => setMaintenanceHourMeter(e.target.value)}
            className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <label className="flex items-center gap-1.5 text-sm text-gray-600 whitespace-nowrap">
            <input
              type="checkbox"
              checked={maintenanceCreateTransaction}
              onChange={(e) => setMaintenanceCreateTransaction(e.target.checked)}
              className="rounded border-gray-300"
            />
            Lançar no financeiro
          </label>
          <button
            type="submit"
            disabled={savingMaintenance}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
          >
            {savingMaintenance ? 'Salvando...' : 'Registrar'}
          </button>
        </form>
        {!machine?.maintenances || machine.maintenances.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma manutenção registrada.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {machine.maintenances.map((m) =>
              editingMaintenanceId === m.id ? (
                <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-50 p-2">
                  <input
                    type="date"
                    value={editMaintenanceDate}
                    onChange={(e) => setEditMaintenanceDate(e.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                  <input
                    type="text"
                    value={editMaintenanceDescription}
                    onChange={(e) => setEditMaintenanceDescription(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Custo (R$)"
                    value={editMaintenanceCost}
                    onChange={(e) => setEditMaintenanceCost(e.target.value)}
                    className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Horímetro"
                    value={editMaintenanceHourMeter}
                    onChange={(e) => setEditMaintenanceHourMeter(e.target.value)}
                    className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                  <button
                    type="button"
                    disabled={savingMaintenanceEdit}
                    onClick={() => handleSaveMaintenanceEdit(m.id)}
                    className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {savingMaintenanceEdit ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingMaintenanceId(null)}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </li>
              ) : (
                <li key={m.id} className="flex items-center justify-between">
                  <span>
                    {new Date(m.performedAt).toLocaleDateString('pt-BR')} — {m.description}
                    {m.cost != null ? ` (R$ ${m.cost})` : ''}
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditMaintenance(m)}
                      className="text-xs font-medium text-emerald-700 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMaintenance(m.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Abastecimento</h2>
        <form onSubmit={handleAddFuel} className="mb-4 flex flex-wrap gap-2">
          <input
            type="number"
            step="0.1"
            placeholder="Litros"
            required
            value={fuelLiters}
            onChange={(e) => setFuelLiters(e.target.value)}
            className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Custo (R$)"
            value={fuelCost}
            onChange={(e) => setFuelCost(e.target.value)}
            className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Horímetro"
            value={fuelHourMeter}
            onChange={(e) => setFuelHourMeter(e.target.value)}
            className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <label className="flex items-center gap-1.5 text-sm text-gray-600 whitespace-nowrap">
            <input
              type="checkbox"
              checked={fuelCreateTransaction}
              onChange={(e) => setFuelCreateTransaction(e.target.checked)}
              className="rounded border-gray-300"
            />
            Lançar no financeiro
          </label>
          <button
            type="submit"
            disabled={savingFuel}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
          >
            {savingFuel ? 'Salvando...' : 'Registrar'}
          </button>
        </form>
        {!machine?.fuelRecords || machine.fuelRecords.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum abastecimento registrado.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {machine.fuelRecords.map((f) =>
              editingFuelId === f.id ? (
                <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-50 p-2">
                  <input
                    type="date"
                    value={editFuelDate}
                    onChange={(e) => setEditFuelDate(e.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Litros"
                    value={editFuelLiters}
                    onChange={(e) => setEditFuelLiters(e.target.value)}
                    className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Custo (R$)"
                    value={editFuelCost}
                    onChange={(e) => setEditFuelCost(e.target.value)}
                    className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Horímetro"
                    value={editFuelHourMeter}
                    onChange={(e) => setEditFuelHourMeter(e.target.value)}
                    className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                  <button
                    type="button"
                    disabled={savingFuelEdit}
                    onClick={() => handleSaveFuelEdit(f.id)}
                    className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {savingFuelEdit ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingFuelId(null)}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </li>
              ) : (
                <li key={f.id} className="flex items-center justify-between">
                  <span>
                    {new Date(f.recordedAt).toLocaleDateString('pt-BR')} — {f.liters}L
                    {f.cost != null ? ` (R$ ${f.cost})` : ''}
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditFuel(f)}
                      className="text-xs font-medium text-emerald-700 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFuel(f.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-3 inline-block">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

// Monday of the ISO week containing `date`, at midnight — used as the bucket key
// for "week" granularity so spending always groups by calendar week, not a
// rolling 7-day window.
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // shift Sunday(0) back to the previous Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function bucketKeyAndLabel(date: Date, granularity: 'day' | 'week' | 'month') {
  if (granularity === 'month') {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    return { key, label };
  }
  if (granularity === 'week') {
    const weekStart = startOfWeek(date);
    const key = weekStart.toISOString().slice(0, 10);
    const label = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return { key, label };
  }
  const key = date.toISOString().slice(0, 10);
  const label = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return { key, label };
}

function SpendingChart({
  machine,
  granularity,
}: {
  machine: Machine | null;
  granularity: 'day' | 'week' | 'month';
}) {
  const entries = [
    ...(machine?.maintenances ?? []).map((m) => ({
      date: new Date(m.performedAt),
      cost: m.cost ?? 0,
    })),
    ...(machine?.fuelRecords ?? []).map((f) => ({
      date: new Date(f.recordedAt),
      cost: f.cost ?? 0,
    })),
  ];

  if (entries.length === 0) {
    return <p className="text-sm text-gray-500">Sem registros de gasto ainda.</p>;
  }

  const buckets = new Map<string, { label: string; total: number; sortDate: Date }>();
  for (const entry of entries) {
    const { key, label } = bucketKeyAndLabel(entry.date, granularity);
    const existing = buckets.get(key);
    if (existing) {
      existing.total += entry.cost;
    } else {
      buckets.set(key, { label, total: entry.cost, sortDate: entry.date });
    }
  }

  const sorted = Array.from(buckets.values()).sort(
    (a, b) => a.sortDate.getTime() - b.sortDate.getTime(),
  );

  const width = 600;
  const height = 200;
  const padding = 32;
  const maxTotal = Math.max(...sorted.map((b) => b.total), 1);
  const barWidth = (width - padding * 2) / sorted.length;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Gastos por período"
    >
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="#e5e7eb"
      />
      {sorted.map((b, i) => {
        const barHeight = (b.total / maxTotal) * (height - padding * 2);
        const x = padding + i * barWidth;
        const y = height - padding - barHeight;
        return (
          <g key={`${b.label}-${i}`}>
            <rect
              x={x + barWidth * 0.15}
              y={y}
              width={barWidth * 0.7}
              height={barHeight}
              fill="#15803d"
              rx={2}
            />
            <text
              x={x + barWidth / 2}
              y={height - padding + 14}
              fontSize={9}
              fill="#9ca3af"
              textAnchor="middle"
            >
              {b.label}
            </text>
            <text
              x={x + barWidth / 2}
              y={y - 4}
              fontSize={9}
              fill="#374151"
              textAnchor="middle"
            >
              {b.total > 0 ? `R$ ${b.total.toFixed(0)}` : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
