'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useConfirm } from '@/lib/confirm-context';
import { useToast } from '@/lib/toast-context';
import type {
  Animal,
  AnimalCategory,
  AnimalSex,
  Pasture,
  ReproductiveEventType,
} from '@/lib/types';

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

const REPRODUCTIVE_EVENT_OPTIONS: { value: ReproductiveEventType; label: string }[] = [
  { value: 'IATF', label: 'IATF' },
  { value: 'MONTA_NATURAL', label: 'Monta natural' },
  { value: 'INSEMINACAO', label: 'Inseminação' },
  { value: 'DIAGNOSTICO_PRENHEZ', label: 'Diagnóstico de prenhez' },
  { value: 'PARTO', label: 'Parto' },
  { value: 'ABORTO', label: 'Aborto' },
];

type VaccinationStatus = 'APLICADA' | 'AGENDADA';

const VACCINATION_STATUS_OPTIONS: { value: VaccinationStatus; label: string }[] = [
  { value: 'APLICADA', label: 'Aplicadas' },
  { value: 'AGENDADA', label: 'Agendadas' },
];

interface VaccinationRecordSummary {
  animalId: string;
  administeredAt: string | null;
}

interface ReproductiveEventSummary {
  animalId: string;
  type: ReproductiveEventType;
}

export default function AnimalsPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const { toastSuccess } = useToast();

  const [animals, setAnimals] = useState<Animal[]>([]);
  const [pastures, setPastures] = useState<Pasture[]>([]);
  const [vaccinations, setVaccinations] = useState<VaccinationRecordSummary[]>([]);
  const [reproductiveEvents, setReproductiveEvents] = useState<ReproductiveEventSummary[]>(
    [],
  );
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [earTag, setEarTag] = useState('');
  const [sex, setSex] = useState<AnimalSex>('FEMALE');
  const [category, setCategory] = useState<AnimalCategory>('VACA');
  const [breed, setBreed] = useState('');
  const [pastureId, setPastureId] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEarTag, setEditEarTag] = useState('');
  const [editCategory, setEditCategory] = useState<AnimalCategory>('VACA');
  const [editBreed, setEditBreed] = useState('');
  const [editPastureId, setEditPastureId] = useState('');
  const [editName, setEditName] = useState('');
  const [editRfid, setEditRfid] = useState('');
  const [editSex, setEditSex] = useState<AnimalSex>('FEMALE');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editCurrentWeightKg, setEditCurrentWeightKg] = useState('');
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [movePastureId, setMovePastureId] = useState('');
  const [moving, setMoving] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategories, setFilterCategories] = useState<Set<AnimalCategory>>(new Set());
  const [filterSexes, setFilterSexes] = useState<Set<AnimalSex>>(new Set());
  const [filterPastureIds, setFilterPastureIds] = useState<Set<string>>(new Set());
  const [filterVaccinationStatuses, setFilterVaccinationStatuses] = useState<
    Set<VaccinationStatus>
  >(new Set());
  const [filterReproductionTypes, setFilterReproductionTypes] = useState<
    Set<ReproductiveEventType>
  >(new Set());

  function toggleInSet<T>(set: Set<T>, value: T, setter: (next: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [animalsData, pasturesData, vaccinationsData, reproductiveEventsData] =
        await Promise.all([
          apiFetch<Animal[]>(`/fazendas/${farmId}/animais`, { token: accessToken }),
          apiFetch<Pasture[]>(`/fazendas/${farmId}/pastagens`, { token: accessToken }),
          apiFetch<VaccinationRecordSummary[]>(`/fazendas/${farmId}/sanidade/vacinacoes`, {
            token: accessToken,
          }),
          apiFetch<ReproductiveEventSummary[]>(`/fazendas/${farmId}/reproducao/eventos`, {
            token: accessToken,
          }),
        ]);
      setAnimals(animalsData);
      setPastures(pasturesData);
      setVaccinations(vaccinationsData);
      setReproductiveEvents(reproductiveEventsData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar o rebanho');
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

  // Fecha a visualização rápida / mover de pasto ao pressionar Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setEditingId(null);
        setMoveModalOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await apiFetch<Animal>(`/fazendas/${farmId}/animais`, {
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
      toastSuccess('Animal cadastrado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar animal');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(animal: Animal) {
    setEditingId(animal.id);
    setEditEarTag(animal.earTag);
    setEditCategory(animal.category);
    setEditBreed(animal.breed ?? '');
    setEditPastureId(animal.pastureId ?? '');
    setEditName(animal.name ?? '');
    setEditRfid(animal.rfid ?? '');
    setEditSex(animal.sex);
    setEditBirthDate(animal.birthDate ? animal.birthDate.slice(0, 10) : '');
    setEditCurrentWeightKg(
      animal.currentWeightKg !== null ? String(animal.currentWeightKg) : '',
    );
  }

  async function handleSaveEdit(animalId: string) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/${animalId}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          earTag: editEarTag,
          category: editCategory,
          breed: editBreed || undefined,
          pastureId: editPastureId || undefined,
          name: editName || undefined,
          rfid: editRfid || undefined,
          sex: editSex,
          birthDate: editBirthDate || undefined,
          currentWeightKg: editCurrentWeightKg
            ? Number(editCurrentWeightKg)
            : undefined,
        },
      });
      setEditingId(null);
      await loadData();
      toastSuccess('Animal atualizado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar animal');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(animal: Animal) {
    const ok = await confirm({
      title: 'Excluir animal',
      message: `Excluir o animal ${animal.earTag}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/${animal.id}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
      toastSuccess('Animal excluído.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir animal');
    }
  }

  async function handleMovePasture() {
    if (selected.size === 0) return;
    setMoving(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/animais/mover-pasto`, {
        method: 'POST',
        token: accessToken,
        body: {
          animalIds: Array.from(selected),
          pastureId: movePastureId || null,
        },
      });
      setMoveModalOpen(false);
      setMovePastureId('');
      const moved = selected.size;
      setSelected(new Set());
      await loadData();
      toastSuccess(`${moved} brinco(s) movido(s) de pasto.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao mover os brincos de pasto');
    } finally {
      setMoving(false);
    }
  }

  function toggleSelected(animalId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(animalId);
      else next.delete(animalId);
      return next;
    });
  }

  const filteredAnimals = animals.filter((a) => {
    if (
      searchTerm &&
      !a.earTag.toLowerCase().includes(searchTerm.trim().toLowerCase())
    ) {
      return false;
    }
    if (filterCategories.size > 0 && !filterCategories.has(a.category)) return false;
    if (filterSexes.size > 0 && !filterSexes.has(a.sex)) return false;
    if (
      filterPastureIds.size > 0 &&
      !(a.pastureId && filterPastureIds.has(a.pastureId))
    ) {
      return false;
    }
    if (filterVaccinationStatuses.size > 0) {
      const animalVaccinations = vaccinations.filter((v) => v.animalId === a.id);
      const matches =
        (filterVaccinationStatuses.has('APLICADA') &&
          animalVaccinations.some((v) => v.administeredAt !== null)) ||
        (filterVaccinationStatuses.has('AGENDADA') &&
          animalVaccinations.some((v) => v.administeredAt === null));
      if (!matches) return false;
    }
    if (filterReproductionTypes.size > 0) {
      const hasType = reproductiveEvents.some(
        (e) => e.animalId === a.id && filterReproductionTypes.has(e.type),
      );
      if (!hasType) return false;
    }
    return true;
  });

  const hasActiveFilters = Boolean(
    filterCategories.size ||
      filterSexes.size ||
      filterPastureIds.size ||
      filterVaccinationStatuses.size ||
      filterReproductionTypes.size,
  );

  const activeFilterCount =
    filterCategories.size +
    filterSexes.size +
    filterPastureIds.size +
    filterVaccinationStatuses.size +
    filterReproductionTypes.size;

  function clearFilters() {
    setFilterCategories(new Set());
    setFilterSexes(new Set());
    setFilterPastureIds(new Set());
    setFilterVaccinationStatuses(new Set());
    setFilterReproductionTypes(new Set());
  }

  function toggleSelectAll(checked: boolean) {
    setSelected(checked ? new Set(filteredAnimals.map((a) => a.id)) : new Set());
  }

  const selectedAnimals = animals.filter((a) => selected.has(a.id));
  const selectedTotalWeightKg = selectedAnimals.reduce(
    (sum, a) => sum + (a.currentWeightKg ?? 0),
    0,
  );

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
        <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
          <p className="text-lg font-medium text-gray-700">Nenhum animal cadastrado</p>
          <p className="mt-1 text-sm text-gray-500">Comece cadastrando seu primeiro animal usando o formulário acima.</p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <label className="flex items-center gap-2 text-gray-600">
              <input
                type="checkbox"
                checked={
                  filteredAnimals.length > 0 &&
                  selected.size === filteredAnimals.length
                }
                onChange={(e) => toggleSelectAll(e.target.checked)}
              />
              Selecionar todos
            </label>

            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 text-gray-400">
                  🔍
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por brinco..."
                  className="w-44 rounded border border-gray-300 py-1.5 pl-7 pr-2 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className={`rounded border px-3 py-1.5 text-sm font-medium ${
                  hasActiveFilters
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Filtros{hasActiveFilters ? ` (${activeFilterCount})` : ''}
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mb-3 space-y-4 rounded border border-gray-200 bg-white p-3">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-600">Categoria</p>
                  <div className="flex flex-col gap-1">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <label key={opt} className="flex items-center gap-1.5 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={filterCategories.has(opt)}
                          onChange={() =>
                            toggleInSet(filterCategories, opt, setFilterCategories)
                          }
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-600">Sexo</p>
                  <div className="flex flex-col gap-1">
                    {SEX_OPTIONS.map((opt) => (
                      <label key={opt} className="flex items-center gap-1.5 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={filterSexes.has(opt)}
                          onChange={() => toggleInSet(filterSexes, opt, setFilterSexes)}
                        />
                        {opt === 'FEMALE' ? 'Fêmea' : 'Macho'}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-600">Pasto</p>
                  <div className="flex max-h-32 flex-col gap-1 overflow-y-auto">
                    {pastures.length === 0 ? (
                      <p className="text-sm text-gray-400">Nenhum pasto cadastrado.</p>
                    ) : (
                      pastures.map((p) => (
                        <label key={p.id} className="flex items-center gap-1.5 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={filterPastureIds.has(p.id)}
                            onChange={() =>
                              toggleInSet(filterPastureIds, p.id, setFilterPastureIds)
                            }
                          />
                          {p.name}
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-600">Vacinação</p>
                  <div className="flex flex-col gap-1">
                    {VACCINATION_STATUS_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-1.5 text-sm text-gray-700"
                      >
                        <input
                          type="checkbox"
                          checked={filterVaccinationStatuses.has(opt.value)}
                          onChange={() =>
                            toggleInSet(
                              filterVaccinationStatuses,
                              opt.value,
                              setFilterVaccinationStatuses,
                            )
                          }
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-600">Reprodução</p>
                  <div className="flex flex-col gap-1">
                    {REPRODUCTIVE_EVENT_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-1.5 text-sm text-gray-700"
                      >
                        <input
                          type="checkbox"
                          checked={filterReproductionTypes.has(opt.value)}
                          onChange={() =>
                            toggleInSet(
                              filterReproductionTypes,
                              opt.value,
                              setFilterReproductionTypes,
                            )
                          }
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-40"
              >
                Limpar filtros
              </button>
            </div>
          )}

          {selected.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-900">
                {selected.size} brinco(s) selecionado(s) · peso total{' '}
                {selectedTotalWeightKg.toLocaleString('pt-BR', {
                  maximumFractionDigits: 1,
                })}{' '}
                kg
              </p>
              <button
                type="button"
                onClick={() => {
                  setMovePastureId('');
                  setMoveModalOpen(true);
                }}
                className="rounded bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800"
              >
                Mover de pasto
              </button>
            </div>
          )}

          {filteredAnimals.length === 0 ? (
            <p className="text-gray-500">Nenhum animal encontrado para esse filtro.</p>
          ) : (
          <ul className="space-y-2">
            {filteredAnimals.map((animal) => (
              <li
                key={animal.id}
                className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3 hover:border-green-600 hover:shadow-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.has(animal.id)}
                  onChange={(e) => toggleSelected(animal.id, e.target.checked)}
                  className="mr-3"
                />
                <Link href={`/fazendas/${farmId}/animais/${animal.id}`} className="flex-1">
                  <p className="font-medium text-gray-900">{animal.earTag}</p>
                  <p className="text-sm text-gray-500">
                    {animal.category} · {animal.breed ?? 'Raça não informada'}
                  </p>
                </Link>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-500">
                    {animal.currentWeightKg ? `${animal.currentWeightKg} kg` : '—'}
                  </p>
                  <button
                    type="button"
                    onClick={() => startEdit(animal)}
                    className="text-sm font-medium text-green-700 hover:underline"
                  >
                    Visualização rápida
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(animal)}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
          )}
        </>
      )}

      {moveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMoveModalOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Mover de pasto</h2>
              <button
                type="button"
                onClick={() => setMoveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Mover {selected.size} brinco(s) selecionado(s) para outro pasto.
            </p>
            <label className="text-xs font-medium text-gray-600">Pasto de destino</label>
            <select
              value={movePastureId}
              onChange={(e) => setMovePastureId(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
            >
              <option value="">— Sem pasto —</option>
              {pastures.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveModalOpen(false)}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={moving}
                onClick={handleMovePasture}
                className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
              >
                {moving ? 'Movendo...' : 'Mover'}
              </button>
            </div>
          </div>
        </div>
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
                Visualização rápida — {editEarTag}
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
              <div>
                <label className="text-xs font-medium text-gray-600">Brinco</label>
                <input
                  type="text"
                  value={editEarTag}
                  onChange={(e) => setEditEarTag(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Categoria</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as AnimalCategory)}
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
                  value={editBreed}
                  onChange={(e) => setEditBreed(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Pasto</label>
                <select
                  value={editPastureId}
                  onChange={(e) => setEditPastureId(e.target.value)}
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
              <div>
                <label className="text-xs font-medium text-gray-600">Nome</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">RFID</label>
                <input
                  type="text"
                  value={editRfid}
                  onChange={(e) => setEditRfid(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Sexo</label>
                <select
                  value={editSex}
                  onChange={(e) => setEditSex(e.target.value as AnimalSex)}
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
                <label className="text-xs font-medium text-gray-600">
                  Data de nascimento
                </label>
                <input
                  type="date"
                  value={editBirthDate}
                  onChange={(e) => setEditBirthDate(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Peso atual (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={editCurrentWeightKg}
                  onChange={(e) => setEditCurrentWeightKg(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <Link
                href={`/fazendas/${farmId}/animais/${editingId}`}
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
