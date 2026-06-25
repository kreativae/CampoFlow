'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type {
  Animal,
  AnimalEvent,
  GainSummary,
  PregnancyDiagnosisResult,
  ReproductiveEvent,
  ReproductiveEventType,
  VaccinationRecord,
  WeighingRecord,
} from '@/lib/types';

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

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [weighings, setWeighings] = useState<WeighingRecord[]>([]);
  const [gainSummary, setGainSummary] = useState<GainSummary | null>(null);
  const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([]);
  const [reproductiveEvents, setReproductiveEvents] = useState<ReproductiveEvent[]>([]);
  const [history, setHistory] = useState<AnimalEvent[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newWeight, setNewWeight] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);

  const [vaccineName, setVaccineName] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [savingVaccination, setSavingVaccination] = useState(false);

  const [reproEventType, setReproEventType] = useState<ReproductiveEventType>('IATF');
  const [reproResult, setReproResult] = useState<PregnancyDiagnosisResult | ''>('');
  const [savingReproEvent, setSavingReproEvent] = useState(false);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const base = `/farms/${farmId}/animals/${animalId}`;
      const [
        animalData,
        weighingsData,
        gainData,
        vaccinationsData,
        reproductiveEventsData,
        historyData,
      ] = await Promise.all([
        apiFetch<Animal>(base, { token: accessToken }),
        apiFetch<WeighingRecord[]>(`${base}/weighings`, { token: accessToken }),
        apiFetch<GainSummary>(`${base}/weighings/gain-summary`, { token: accessToken }),
        apiFetch<VaccinationRecord[]>(`${base}/vaccinations`, { token: accessToken }),
        apiFetch<ReproductiveEvent[]>(`${base}/reproductive-events`, { token: accessToken }),
        apiFetch<AnimalEvent[]>(`${base}/history`, { token: accessToken }),
      ]);
      setAnimal(animalData);
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
      router.replace('/login');
      return;
    }
    // Fetching data on mount via an async callback is the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loading, user, loadData, router]);

  async function handleAddWeighing(event: FormEvent) {
    event.preventDefault();
    setSavingWeight(true);
    setError(null);
    try {
      await apiFetch(`/farms/${farmId}/animals/${animalId}/weighings`, {
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

  async function handleScheduleVaccination(event: FormEvent) {
    event.preventDefault();
    setSavingVaccination(true);
    setError(null);
    try {
      await apiFetch(`/farms/${farmId}/animals/${animalId}/vaccinations`, {
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
      await apiFetch(`/farms/${farmId}/animals/${animalId}/reproductive-events`, {
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

  async function handleApplyVaccination(vaccinationId: string) {
    setError(null);
    try {
      await apiFetch(
        `/farms/${farmId}/animals/${animalId}/vaccinations/${vaccinationId}/apply`,
        { method: 'PATCH', token: accessToken, body: {} },
      );
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao confirmar vacina');
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
        <Link href={`/farms/${farmId}/animals`} className="text-sm text-green-700 hover:underline">
          ← Rebanho
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">{animal?.earTag}</h1>
        <p className="text-sm text-gray-500">
          {animal?.category} · {animal?.sex === 'FEMALE' ? 'Fêmea' : 'Macho'} ·{' '}
          {animal?.breed ?? 'Raça não informada'}
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <section className="mb-8 grid grid-cols-3 gap-3">
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

      <section className="mb-8 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Pesagens</h2>
        <form onSubmit={handleAddWeighing} className="mb-4 flex gap-2">
          <input
            type="number"
            step="0.1"
            placeholder="Peso (kg)"
            required
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={savingWeight}
            className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {savingWeight ? 'Salvando...' : 'Registrar'}
          </button>
        </form>
        {weighings.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma pesagem registrada.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {weighings
              .slice()
              .reverse()
              .map((w) => (
                <li key={w.id}>
                  {new Date(w.weighedAt).toLocaleDateString('pt-BR')} — {w.weightKg} kg
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="mb-8 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Vacinação</h2>
        <form onSubmit={handleScheduleVaccination} className="mb-4 flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Nome da vacina"
            required
            value={vaccineName}
            onChange={(e) => setVaccineName(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
          <input
            type="date"
            required
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={savingVaccination}
            className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {savingVaccination ? 'Salvando...' : 'Agendar'}
          </button>
        </form>
        {vaccinations.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma vacina agendada.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {vaccinations.map((v) => (
              <li key={v.id} className="flex items-center justify-between">
                <span>
                  {v.vaccineName} — {new Date(v.scheduledDate).toLocaleDateString('pt-BR')}
                  {v.administeredAt ? ' (aplicada)' : ' (pendente)'}
                </span>
                {!v.administeredAt && (
                  <button
                    onClick={() => handleApplyVaccination(v.id)}
                    className="text-xs font-medium text-green-700 hover:underline"
                  >
                    Marcar como aplicada
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8 rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Reprodução</h2>
        <form onSubmit={handleAddReproductiveEvent} className="mb-4 flex flex-wrap gap-2">
          <select
            value={reproEventType}
            onChange={(e) => setReproEventType(e.target.value as ReproductiveEventType)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
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
              className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
            >
              <option value="">Resultado...</option>
              <option value="PRENHE">Prenhe</option>
              <option value="VAZIA">Vazia</option>
            </select>
          )}
          <button
            type="submit"
            disabled={savingReproEvent}
            className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {savingReproEvent ? 'Salvando...' : 'Registrar evento'}
          </button>
        </form>
        {reproductiveEvents.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum evento reprodutivo registrado.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {reproductiveEvents.map((e) => (
              <li key={e.id}>
                {new Date(e.eventDate).toLocaleDateString('pt-BR')} —{' '}
                {REPRODUCTIVE_EVENT_OPTIONS.find((opt) => opt.value === e.type)?.label ?? e.type}
                {e.result ? ` (${e.result === 'PRENHE' ? 'Prenhe' : 'Vazia'})` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Histórico</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum evento registrado.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {history.map((e) => (
              <li key={e.id}>
                {new Date(e.occurredAt).toLocaleDateString('pt-BR')} — {e.type}
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
    <div className="rounded border border-gray-200 bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}
