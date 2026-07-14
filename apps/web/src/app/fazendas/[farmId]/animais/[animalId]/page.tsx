'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useConfirm } from '@/lib/confirm-context';
import type {
  Animal,
  AnimalEvent,
  GainSummary,
  Pasture,
  PregnancyDiagnosisResult,
  ReproductiveEvent,
  ReproductiveEventType,
  VaccinationRecord,
  WeighingRecord,
} from '@/lib/types';
import { ANIMAL_EVENT_TYPE_LABEL } from '@/lib/types';

const REPRODUCTIVE_EVENT_OPTIONS: { value: ReproductiveEventType; label: string }[] = [
  { value: 'IATF', label: 'IATF' },
  { value: 'MONTA_NATURAL', label: 'Monta natural' },
  { value: 'INSEMINACAO', label: 'Inseminação' },
  { value: 'DIAGNOSTICO_PRENHEZ', label: 'Diagnóstico de prenhez' },
  { value: 'PARTO', label: 'Parto' },
  { value: 'ABORTO', label: 'Aborto' },
];

export default function AnimalDetailPage() {
  const { farmId, animalId } = useParams<{ farmId: string; animalId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [pastures, setPastures] = useState<Pasture[]>([]);
  const [movePastureId, setMovePastureId] = useState('');
  const [savingPasture, setSavingPasture] = useState(false);
  const [weighings, setWeighings] = useState<WeighingRecord[]>([]);
  const [gainSummary, setGainSummary] = useState<GainSummary | null>(null);
  const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([]);
  const [reproductiveEvents, setReproductiveEvents] = useState<ReproductiveEvent[]>([]);
  const [history, setHistory] = useState<AnimalEvent[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newWeight, setNewWeight] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);

  const [editingWeighingId, setEditingWeighingId] = useState<string | null>(null);
  const [editWeighingKg, setEditWeighingKg] = useState('');
  const [editWeighingDate, setEditWeighingDate] = useState('');
  const [savingWeighingEdit, setSavingWeighingEdit] = useState(false);

  const [vaccineName, setVaccineName] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [savingVaccination, setSavingVaccination] = useState(false);

  const [editingVaccinationId, setEditingVaccinationId] = useState<string | null>(
    null,
  );
  const [editVaccinationScheduledDate, setEditVaccinationScheduledDate] =
    useState('');
  const [editVaccinationAdministeredAt, setEditVaccinationAdministeredAt] =
    useState('');
  const [savingVaccinationEdit, setSavingVaccinationEdit] = useState(false);

  const [reproEventType, setReproEventType] = useState<ReproductiveEventType>('IATF');
  const [reproResult, setReproResult] = useState<PregnancyDiagnosisResult | ''>('');
  const [savingReproEvent, setSavingReproEvent] = useState(false);

  const [editingReproId, setEditingReproId] = useState<string | null>(null);
  const [editReproType, setEditReproType] = useState<ReproductiveEventType>('IATF');
  const [editReproResult, setEditReproResult] = useState<PregnancyDiagnosisResult | ''>('');
  const [editReproDate, setEditReproDate] = useState('');
  const [savingReproEdit, setSavingReproEdit] = useState(false);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const base = `/fazendas/${farmId}/animais/${animalId}`;
      const [
        animalData,
        pasturesData,
        weighingsData,
        gainData,
        vaccinationsData,
        reproductiveEventsData,
        historyData,
      ] = await Promise.all([
        apiFetch<Animal>(base, { token: accessToken }),
        apiFetch<Pasture[]>(`/fazendas/${farmId}/pastagens`, { token: accessToken }),
        apiFetch<WeighingRecord[]>(`${base}/pesagens`, { token: accessToken }),
        apiFetch<GainSummary>(`${base}/pesagens/resumo-ganho`, { token: accessToken }),
        apiFetch<VaccinationRecord[]>(`${base}/vacinacoes`, { token: accessToken }),
        apiFetch<ReproductiveEvent[]>(`${base}/eventos-reprodutivos`, { token: accessToken }),
        apiFetch<AnimalEvent[]>(`${base}/historico`, { token: accessToken }),
      ]);
      setAnimal(animalData);
      setPastures(pasturesData);
      setMovePastureId(animalData.pastureId ?? '');
      setWeighings(weighingsData);
      setGainSummary(gainData);
      setVaccinations(vaccinationsData);
      setReproductiveEvents(reproductiveEventsData);
      setHistory(historyData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar dados do animal');
    } finally {
      setFetching(false);
    }
  }, [farmId, animalId, accessToken]);

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

  async function handleChangePasture(event: FormEvent) {
    event.preventDefault();
    setSavingPasture(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/mover-pasto`, {
        method: 'POST',
        token: accessToken,
        body: {
          animalIds: [animalId],
          pastureId: movePastureId || null,
        },
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao trocar o pasto do animal');
    } finally {
      setSavingPasture(false);
    }
  }

  async function handleAddWeighing(event: FormEvent) {
    event.preventDefault();
    setSavingWeight(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/${animalId}/pesagens`, {
        method: 'POST',
        token: accessToken,
        body: { weightKg: Number(newWeight) },
      });
      setNewWeight('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar pesagem');
    } finally {
      setSavingWeight(false);
    }
  }

  function startEditWeighing(w: WeighingRecord) {
    setEditingWeighingId(w.id);
    setEditWeighingKg(String(w.weightKg));
    setEditWeighingDate(w.weighedAt.slice(0, 10));
  }

  async function handleSaveWeighingEdit(weighingId: string) {
    setSavingWeighingEdit(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/${animalId}/pesagens/${weighingId}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          weightKg: Number(editWeighingKg),
          weighedAt: editWeighingDate
            ? new Date(editWeighingDate).toISOString()
            : undefined,
        },
      });
      setEditingWeighingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar pesagem');
    } finally {
      setSavingWeighingEdit(false);
    }
  }

  async function handleDeleteWeighing(weighingId: string) {
    const ok = await confirm({
      title: 'Excluir pesagem',
      message: 'Excluir esta pesagem? Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/${animalId}/pesagens/${weighingId}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir pesagem');
    }
  }

  async function handleScheduleVaccination(event: FormEvent) {
    event.preventDefault();
    setSavingVaccination(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/${animalId}/vacinacoes`, {
        method: 'POST',
        token: accessToken,
        body: { vaccineName, scheduledDate },
      });
      setVaccineName('');
      setScheduledDate('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao agendar vacina');
    } finally {
      setSavingVaccination(false);
    }
  }

  async function handleAddReproductiveEvent(event: FormEvent) {
    event.preventDefault();
    setSavingReproEvent(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/${animalId}/eventos-reprodutivos`, {
        method: 'POST',
        token: accessToken,
        body: {
          type: reproEventType,
          result: reproEventType === 'DIAGNOSTICO_PRENHEZ' && reproResult ? reproResult : undefined,
        },
      });
      setReproResult('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar evento reprodutivo');
    } finally {
      setSavingReproEvent(false);
    }
  }

  function startEditReproEvent(e: ReproductiveEvent) {
    setEditingReproId(e.id);
    setEditReproType(e.type);
    setEditReproResult(e.result ?? '');
    setEditReproDate(e.eventDate.slice(0, 10));
  }

  async function handleSaveReproEdit(eventId: string) {
    setSavingReproEdit(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/${animalId}/eventos-reprodutivos/${eventId}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          type: editReproType,
          result: editReproType === 'DIAGNOSTICO_PRENHEZ' && editReproResult ? editReproResult : undefined,
          eventDate: editReproDate
            ? new Date(editReproDate).toISOString()
            : undefined,
        },
      });
      setEditingReproId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar evento reprodutivo');
    } finally {
      setSavingReproEdit(false);
    }
  }

  async function handleDeleteReproEvent(eventId: string) {
    const ok = await confirm({
      title: 'Excluir evento reprodutivo',
      message: 'Excluir este evento reprodutivo? Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/${animalId}/eventos-reprodutivos/${eventId}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir evento reprodutivo');
    }
  }

  async function handleApplyVaccination(vaccinationId: string) {
    setError(null);
    try {
      await apiFetch(
        `/fazendas/${farmId}/animais/${animalId}/vacinacoes/${vaccinationId}/aplicar`,
        { method: 'PATCH', token: accessToken, body: {} },
      );
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao confirmar vacina');
    }
  }

  function startEditVaccination(v: VaccinationRecord) {
    setEditingVaccinationId(v.id);
    setEditVaccinationScheduledDate(v.scheduledDate.slice(0, 10));
    setEditVaccinationAdministeredAt(
      v.administeredAt ? v.administeredAt.slice(0, 10) : '',
    );
  }

  async function handleSaveVaccinationEdit(vaccinationId: string) {
    setSavingVaccinationEdit(true);
    setError(null);
    try {
      await apiFetch(
        `/fazendas/${farmId}/animais/${animalId}/vacinacoes/${vaccinationId}`,
        {
          method: 'PATCH',
          token: accessToken,
          body: {
            scheduledDate: editVaccinationScheduledDate
              ? new Date(editVaccinationScheduledDate).toISOString()
              : undefined,
            administeredAt: editVaccinationAdministeredAt
              ? new Date(editVaccinationAdministeredAt).toISOString()
              : undefined,
          },
        },
      );
      setEditingVaccinationId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar vacina');
    } finally {
      setSavingVaccinationEdit(false);
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
        <Link href={`/fazendas/${farmId}/animais`} className="text-sm text-emerald-700 hover:underline">
          ← Rebanho
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{animal?.earTag}</h1>
        <p className="text-sm text-gray-500">
          {animal?.category} · {animal?.sex === 'FEMALE' ? 'Fêmea' : 'Macho'} ·{' '}
          {animal?.breed ?? 'Raça não informada'}
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCard label="Peso atual" value={`${animal?.currentWeightKg ?? '—'} kg`} />
        <SummaryCard
          label="Ganho diário médio"
          value={`${gainSummary?.averageDailyGainKg ?? 0} kg`}
        />
        <SummaryCard
          label="Ganho mensal médio"
          value={`${gainSummary?.averageMonthlyGainKg ?? 0} kg`}
        />
      </section>

      <section className="mb-8 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Pasto</h2>
        <p className="mb-3 text-sm text-gray-500">
          Pasto atual:{' '}
          <span className="font-medium text-gray-800">
            {pastures.find((p) => p.id === animal?.pastureId)?.name ?? 'Sem pasto'}
          </span>
        </p>
        <form onSubmit={handleChangePasture} className="flex flex-wrap gap-2">
          <select
            value={movePastureId}
            onChange={(e) => setMovePastureId(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          >
            <option value="">— Sem pasto —</option>
            {pastures.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={savingPasture || movePastureId === (animal?.pastureId ?? '')}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
          >
            {savingPasture ? 'Salvando...' : 'Trocar pasto'}
          </button>
        </form>
      </section>

      <section className="mb-8 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Pesagens</h2>
        <form onSubmit={handleAddWeighing} className="mb-4 flex gap-2">
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="Peso (kg)"
            required
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <button
            type="submit"
            disabled={savingWeight}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
          >
            {savingWeight ? 'Salvando...' : 'Registrar'}
          </button>
        </form>
        {weighings.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma pesagem registrada.</p>
        ) : (
          <>
            <WeightEvolutionChart weighings={weighings} />
            <ul className="space-y-1 text-sm text-gray-700">
              {weighings
                .slice()
                .reverse()
                .map((w) =>
                  editingWeighingId === w.id ? (
                    <li key={w.id} className="flex flex-wrap items-center gap-2 py-1">
                      <input
                        type="date"
                        value={editWeighingDate}
                        onChange={(e) => setEditWeighingDate(e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                      />
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={editWeighingKg}
                        onChange={(e) => setEditWeighingKg(e.target.value)}
                        className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                      />
                      <button
                        type="button"
                        disabled={savingWeighingEdit}
                        onClick={() => handleSaveWeighingEdit(w.id)}
                        className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {savingWeighingEdit ? 'Salvando...' : 'Salvar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingWeighingId(null)}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </li>
                  ) : (
                    <li key={w.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        {new Date(w.weighedAt).toLocaleDateString('pt-BR')} —{' '}
                        {w.weightKg} kg
                      </span>
                      <span className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditWeighing(w)}
                          className="text-xs font-medium text-emerald-700 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWeighing(w.id)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Excluir
                        </button>
                      </span>
                    </li>
                  ),
                )}
            </ul>
          </>
        )}
      </section>

      <section className="mb-8 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Vacinação</h2>
        <form onSubmit={handleScheduleVaccination} className="mb-4 flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Nome da vacina"
            required
            value={vaccineName}
            onChange={(e) => setVaccineName(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <input
            type="date"
            required
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
          <button
            type="submit"
            disabled={savingVaccination}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
          >
            {savingVaccination ? 'Salvando...' : 'Agendar'}
          </button>
        </form>
        {vaccinations.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma vacina agendada.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {vaccinations.map((v) =>
              editingVaccinationId === v.id ? (
                <li key={v.id} className="flex flex-wrap items-center gap-2 py-1">
                  <span className="font-medium">{v.vaccineName}</span>
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    Agendada para
                    <input
                      type="date"
                      value={editVaccinationScheduledDate}
                      onChange={(e) => setEditVaccinationScheduledDate(e.target.value)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    />
                  </label>
                  {v.administeredAt && (
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      Aplicada em
                      <input
                        type="date"
                        value={editVaccinationAdministeredAt}
                        onChange={(e) =>
                          setEditVaccinationAdministeredAt(e.target.value)
                        }
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={savingVaccinationEdit}
                    onClick={() => handleSaveVaccinationEdit(v.id)}
                    className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {savingVaccinationEdit ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingVaccinationId(null)}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </li>
              ) : (
                <li key={v.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {v.vaccineName} — {new Date(v.scheduledDate).toLocaleDateString('pt-BR')}
                    {v.administeredAt ? ' (aplicada)' : ' (pendente)'}
                  </span>
                  <span className="flex gap-2">
                    {!v.administeredAt && (
                      <button
                        type="button"
                        onClick={() => handleApplyVaccination(v.id)}
                        className="text-xs font-medium text-emerald-700 hover:underline"
                      >
                        Marcar como aplicada
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startEditVaccination(v)}
                      className="text-xs font-medium text-emerald-700 hover:underline"
                    >
                      Editar
                    </button>
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <section className="mb-8 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Reprodução</h2>
        <form onSubmit={handleAddReproductiveEvent} className="mb-4 flex flex-wrap gap-2">
          <select
            value={reproEventType}
            onChange={(e) => setReproEventType(e.target.value as ReproductiveEventType)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          >
            {REPRODUCTIVE_EVENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {reproEventType === 'DIAGNOSTICO_PRENHEZ' && (
            <select
              value={reproResult}
              onChange={(e) => setReproResult(e.target.value as PregnancyDiagnosisResult | '')}
              required
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            >
              <option value="">Resultado...</option>
              <option value="PRENHE">Prenhe</option>
              <option value="VAZIA">Vazia</option>
            </select>
          )}
          <button
            type="submit"
            disabled={savingReproEvent}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
          >
            {savingReproEvent ? 'Salvando...' : 'Registrar evento'}
          </button>
        </form>
        {reproductiveEvents.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum evento reprodutivo registrado.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {reproductiveEvents.map((e) =>
              editingReproId === e.id ? (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-1">
                  <input
                    type="date"
                    value={editReproDate}
                    onChange={(ev) => setEditReproDate(ev.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                  <select
                    value={editReproType}
                    onChange={(ev) => setEditReproType(ev.target.value as ReproductiveEventType)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  >
                    {REPRODUCTIVE_EVENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {editReproType === 'DIAGNOSTICO_PRENHEZ' && (
                    <select
                      value={editReproResult}
                      onChange={(ev) => setEditReproResult(ev.target.value as PregnancyDiagnosisResult | '')}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    >
                      <option value="">Resultado...</option>
                      <option value="PRENHE">Prenhe</option>
                      <option value="VAZIA">Vazia</option>
                    </select>
                  )}
                  <button
                    type="button"
                    disabled={savingReproEdit}
                    onClick={() => handleSaveReproEdit(e.id)}
                    className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {savingReproEdit ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingReproId(null)}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </li>
              ) : (
                <li key={e.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {new Date(e.eventDate).toLocaleDateString('pt-BR')} —{' '}
                    {REPRODUCTIVE_EVENT_OPTIONS.find((opt) => opt.value === e.type)?.label ?? e.type}
                    {e.result ? ` (${e.result === 'PRENHE' ? 'Prenhe' : 'Vazia'})` : ''}
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditReproEvent(e)}
                      className="text-xs font-medium text-emerald-700 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteReproEvent(e.id)}
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
        <h2 className="mb-3 font-semibold text-gray-800">Histórico</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum evento registrado.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {history.map((e) => (
              <li key={e.id}>
                {new Date(e.occurredAt).toLocaleDateString('pt-BR')} —{' '}
                {ANIMAL_EVENT_TYPE_LABEL[e.type] ?? e.type}
                {e.description ? `: ${e.description}` : ''}
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
    <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function WeightEvolutionChart({ weighings }: { weighings: WeighingRecord[] }) {
  if (weighings.length < 2) {
    return (
      <p className="mb-4 text-sm text-gray-500">
        É preciso de pelo menos 2 pesagens para o gráfico de evolução.
      </p>
    );
  }

  const points = weighings
    .slice()
    .sort((a, b) => new Date(a.weighedAt).getTime() - new Date(b.weighedAt).getTime());

  const width = 600;
  const height = 200;
  const padding = 28;
  const weights = points.map((p) => p.weightKg);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const range = maxWeight - minWeight || 1;

  const coords = points.map((p, i) => {
    const x = padding + (i / (points.length - 1)) * (width - padding * 2);
    const y =
      height - padding - ((p.weightKg - minWeight) / range) * (height - padding * 2);
    return { x, y, ...p };
  });

  const path = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mb-4 w-full"
      role="img"
      aria-label="Evolução de peso"
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
        {maxWeight.toFixed(1)} kg
      </text>
      <text x={padding} y={height - padding + 12} fontSize={8} fill="#6b7280">
        {minWeight.toFixed(1)} kg
      </text>
      <text x={coords[0].x} y={height - 6} fontSize={7} fill="#9ca3af">
        {new Date(coords[0].weighedAt).toLocaleDateString('pt-BR')}
      </text>
      <text
        x={coords[coords.length - 1].x}
        y={height - 6}
        fontSize={7}
        fill="#9ca3af"
        textAnchor="end"
      >
        {new Date(coords[coords.length - 1].weighedAt).toLocaleDateString('pt-BR')}
      </text>
    </svg>
  );
}
