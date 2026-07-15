'use client';

import { Beef, SlidersHorizontal, X, Search, ShoppingCart, Skull } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';

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
  AnimalPerformance,
  AnimalSex,
  Deal,
  DealType,
  Pasture,
  ReproductiveEventType,
} from '@/lib/types';
import {
  ANIMAL_PERFORMANCE_LABEL,
  ANIMAL_PERFORMANCE_COLOR,
  calcAnimalAge,
} from '@/lib/types';

const SEX_OPTIONS: AnimalSex[] = ['FEMALE', 'MALE'];
const PERFORMANCE_OPTIONS: AnimalPerformance[] = ['CABECEIRA', 'MEIO', 'FUNDO'];

type AgePeriod = '0-4m' | '5-12m' | '13-24m' | '25-36m' | '36+';
const AGE_PERIOD_OPTIONS: { value: AgePeriod; label: string }[] = [
  { value: '0-4m', label: '0-4 meses' },
  { value: '5-12m', label: '5-12 meses' },
  { value: '13-24m', label: '13-24 meses' },
  { value: '25-36m', label: '25-36 meses' },
  { value: '36+', label: '36+ meses' },
];

const AGE_PERIOD_MAP: Record<string, AgePeriod> = {
  '0-4 meses': '0-4m',
  '5-12 meses': '5-12m',
  '13-24 meses': '13-24m',
  '25-36 meses': '25-36m',
  '36+ meses': '36+',
};
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

function FilterPanel({
  categories, setCategories,
  sexes, setSexes,
  pastureIds, setPastureIds,
  vaccinationStatuses, setVaccinationStatuses,
  reproductionTypes, setReproductionTypes,
  performances, setPerformances,
  agePeriods, setAgePeriods,
  pastures,
  hasActiveFilters,
  onClear,
  toggleInSet,
}: {
  categories: Set<AnimalCategory>; setCategories: (s: Set<AnimalCategory>) => void;
  sexes: Set<AnimalSex>; setSexes: (s: Set<AnimalSex>) => void;
  pastureIds: Set<string>; setPastureIds: (s: Set<string>) => void;
  vaccinationStatuses: Set<VaccinationStatus>; setVaccinationStatuses: (s: Set<VaccinationStatus>) => void;
  reproductionTypes: Set<ReproductiveEventType>; setReproductionTypes: (s: Set<ReproductiveEventType>) => void;
  performances: Set<AnimalPerformance>; setPerformances: (s: Set<AnimalPerformance>) => void;
  agePeriods: Set<AgePeriod>; setAgePeriods: (s: Set<AgePeriod>) => void;
  pastures: Pasture[];
  hasActiveFilters: boolean;
  onClear: () => void;
  toggleInSet: <T>(set: Set<T>, value: T, setter: (next: Set<T>) => void) => void;
}) {
  const sectionClass = 'group border-b border-gray-100 last:border-b-0';
  const summaryClass = 'flex cursor-pointer list-none items-center justify-between py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 select-none [&::-webkit-details-marker]:hidden';
  const chevronClass = 'h-3.5 w-3.5 text-gray-400 transition-transform group-open:rotate-90';
  const listClass = 'flex flex-col gap-0.5 pb-2';
  const labelClass = 'flex items-center gap-1.5 rounded px-1 py-0.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer';
  const chevron = <svg className={chevronClass} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4l4 4-4 4" /></svg>;

  return (
    <div className="space-y-0">
      <details className={sectionClass}>
        <summary className={summaryClass}>Categoria {categories.size > 0 && <span className="ml-1 rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">{categories.size}</span>}{chevron}</summary>
        <div className={listClass}>
          {CATEGORY_OPTIONS.map((opt) => (
            <label key={opt} className={labelClass}>
              <input type="checkbox" checked={categories.has(opt)} onChange={() => toggleInSet(categories, opt, setCategories)} className="rounded border-gray-300" />
              {opt}
            </label>
          ))}
        </div>
      </details>

      <details className={sectionClass}>
        <summary className={summaryClass}>Sexo {sexes.size > 0 && <span className="ml-1 rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">{sexes.size}</span>}{chevron}</summary>
        <div className={listClass}>
          {SEX_OPTIONS.map((opt) => (
            <label key={opt} className={labelClass}>
              <input type="checkbox" checked={sexes.has(opt)} onChange={() => toggleInSet(sexes, opt, setSexes)} className="rounded border-gray-300" />
              {opt === 'FEMALE' ? 'Fêmea' : 'Macho'}
            </label>
          ))}
        </div>
      </details>

      <details className={sectionClass}>
        <summary className={summaryClass}>Pasto {pastureIds.size > 0 && <span className="ml-1 rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">{pastureIds.size}</span>}{chevron}</summary>
        <div className={`${listClass} max-h-28 overflow-y-auto`}>
          {pastures.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhum pasto.</p>
          ) : (
            pastures.map((p) => (
              <label key={p.id} className={labelClass}>
                <input type="checkbox" checked={pastureIds.has(p.id)} onChange={() => toggleInSet(pastureIds, p.id, setPastureIds)} className="rounded border-gray-300" />
                {p.name}
              </label>
            ))
          )}
        </div>
      </details>

      <details className={sectionClass}>
        <summary className={summaryClass}>Vacinação {vaccinationStatuses.size > 0 && <span className="ml-1 rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">{vaccinationStatuses.size}</span>}{chevron}</summary>
        <div className={listClass}>
          {VACCINATION_STATUS_OPTIONS.map((opt) => (
            <label key={opt.value} className={labelClass}>
              <input type="checkbox" checked={vaccinationStatuses.has(opt.value)} onChange={() => toggleInSet(vaccinationStatuses, opt.value, setVaccinationStatuses)} className="rounded border-gray-300" />
              {opt.label}
            </label>
          ))}
        </div>
      </details>

      <details className={sectionClass}>
        <summary className={summaryClass}>Reprodução {reproductionTypes.size > 0 && <span className="ml-1 rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">{reproductionTypes.size}</span>}{chevron}</summary>
        <div className={listClass}>
          {REPRODUCTIVE_EVENT_OPTIONS.map((opt) => (
            <label key={opt.value} className={labelClass}>
              <input type="checkbox" checked={reproductionTypes.has(opt.value)} onChange={() => toggleInSet(reproductionTypes, opt.value, setReproductionTypes)} className="rounded border-gray-300" />
              {opt.label}
            </label>
          ))}
        </div>
      </details>

      <details className={sectionClass}>
        <summary className={summaryClass}>Desempenho {performances.size > 0 && <span className="ml-1 rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">{performances.size}</span>}{chevron}</summary>
        <div className={listClass}>
          {PERFORMANCE_OPTIONS.map((opt) => (
            <label key={opt} className={labelClass}>
              <input type="checkbox" checked={performances.has(opt)} onChange={() => toggleInSet(performances, opt, setPerformances)} className="rounded border-gray-300" />
              {ANIMAL_PERFORMANCE_LABEL[opt]}
            </label>
          ))}
        </div>
      </details>

      <details className={sectionClass}>
        <summary className={summaryClass}>Período {agePeriods.size > 0 && <span className="ml-1 rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">{agePeriods.size}</span>}{chevron}</summary>
        <div className={listClass}>
          {AGE_PERIOD_OPTIONS.map((opt) => (
            <label key={opt.value} className={labelClass}>
              <input type="checkbox" checked={agePeriods.has(opt.value)} onChange={() => toggleInSet(agePeriods, opt.value, setAgePeriods)} className="rounded border-gray-300" />
              {opt.label}
            </label>
          ))}
        </div>
      </details>

      {hasActiveFilters && (
        <button type="button" onClick={onClear} className="pt-2 text-xs font-medium text-emerald-700 hover:underline">
          Limpar filtros
        </button>
      )}
    </div>
  );
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
  const [entryDate, setEntryDate] = useState('');

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
  const [editPerformance, setEditPerformance] = useState('');
  const [editEntryDate, setEditEntryDate] = useState('');
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [movePastureId, setMovePastureId] = useState('');
  const [moving, setMoving] = useState(false);

  const [dealFormType, setDealFormType] = useState<DealType | null>(null);
  const [dealCounterparty, setDealCounterparty] = useState('');
  const [dealPricePerUnit, setDealPricePerUnit] = useState('');
  const [dealPriceUnit, setDealPriceUnit] = useState<'ANIMAL' | 'ARROBA'>('ARROBA');
  const [dealFreightCost, setDealFreightCost] = useState('');
  const [dealCommission, setDealCommission] = useState('');
  const [dealDate, setDealDate] = useState(new Date().toISOString().slice(0, 10));
  const [dealNotes, setDealNotes] = useState('');
  const [dealCarcassYield, setDealCarcassYield] = useState('52');
  const [dealLiveWeightPrice, setDealLiveWeightPrice] = useState('');
  const [dealSaving, setDealSaving] = useState(false);

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
  const [filterPerformances, setFilterPerformances] = useState<Set<AnimalPerformance>>(new Set());
  const [filterAgePeriods, setFilterAgePeriods] = useState<Set<AgePeriod>>(new Set());

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
          entryDate: entryDate || undefined,
        },
      });
      setEarTag('');
      setBreed('');
      setPastureId('');
      setEntryDate('');
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
    setEditPerformance(animal.performance ?? '');
    setEditEntryDate(animal.entryDate ? animal.entryDate.slice(0, 10) : '');
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
          performance: editPerformance || undefined,
          entryDate: editEntryDate || undefined,
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
    if (filterPerformances.size > 0 && !(a.performance && filterPerformances.has(a.performance))) {
      return false;
    }
    if (filterAgePeriods.size > 0) {
      const age = calcAnimalAge(a);
      if (!age) return false;
      const period = AGE_PERIOD_MAP[age.category];
      if (!period || !filterAgePeriods.has(period)) return false;
    }
    return true;
  });

  const hasActiveFilters = Boolean(
    filterCategories.size ||
      filterSexes.size ||
      filterPastureIds.size ||
      filterVaccinationStatuses.size ||
      filterReproductionTypes.size ||
      filterPerformances.size ||
      filterAgePeriods.size,
  );

  const activeFilterCount =
    filterCategories.size +
    filterSexes.size +
    filterPastureIds.size +
    filterVaccinationStatuses.size +
    filterReproductionTypes.size +
    filterPerformances.size +
    filterAgePeriods.size;

  function clearFilters() {
    setFilterCategories(new Set());
    setFilterSexes(new Set());
    setFilterPastureIds(new Set());
    setFilterVaccinationStatuses(new Set());
    setFilterReproductionTypes(new Set());
    setFilterPerformances(new Set());
    setFilterAgePeriods(new Set());
  }

  function toggleSelectAll(checked: boolean) {
    setSelected(checked ? new Set(filteredAnimals.map((a) => a.id)) : new Set());
  }

  const selectedAnimals = animals.filter((a) => selected.has(a.id));
  const selectedTotalWeightKg = selectedAnimals.reduce(
    (sum, a) => sum + (a.currentWeightKg ?? 0),
    0,
  );

  function openDealForm(type: DealType) {
    setDealFormType(type);
    setDealCounterparty('');
    setDealPricePerUnit('');
    setDealPriceUnit('ARROBA');
    setDealFreightCost('');
    setDealCommission('');
    setDealDate(new Date().toISOString().slice(0, 10));
    setDealNotes('');
    setDealCarcassYield('52');
    setDealLiveWeightPrice('');
  }

  async function handleDealSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dealFormType || selectedAnimals.length === 0) return;
    setDealSaving(true);
    setError(null);
    try {
      const items = selectedAnimals.map((a) => ({
        animalId: a.id,
        earTag: a.earTag,
        weightKg: a.currentWeightKg ?? undefined,
      }));
      const body: Record<string, unknown> = {
        type: dealFormType,
        counterparty: dealCounterparty || undefined,
        pricePerUnit: Number(dealPricePerUnit) || 0,
        priceUnit: dealPriceUnit,
        freightCost: Number(dealFreightCost) || 0,
        commissionPercent: Number(dealCommission) || 0,
        notes: dealNotes || undefined,
        dealDate,
        items,
      };
      if (dealFormType === 'ABATE') {
        body.carcassYieldPercent = Number(dealCarcassYield) || undefined;
        body.liveWeightPricePerKg = Number(dealLiveWeightPrice) || undefined;
      }
      await apiFetch<Deal>(`/fazendas/${farmId}/negocios`, {
        method: 'POST',
        token: accessToken,
        body,
      });
      toastSuccess(`${dealFormType === 'VENDA' ? 'Venda' : 'Abate'} criado com ${selectedAnimals.length} animal(is).`);
      setDealFormType(null);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar negócio');
    } finally {
      setDealSaving(false);
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
    <main className="animate-fade-up mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8">
      <PageHeader
        icon={Beef}
        title="Rebanho"
        subtitle="Gerencie o rebanho da propriedade"
        backHref={`/fazendas/${farmId}`}
      />

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <form
        onSubmit={handleCreate}
        className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4 sm:grid-cols-3"
      >
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs font-medium text-gray-600">Brinco</label>
          <input
            type="text"
            required
            value={earTag}
            onChange={(e) => setEarTag(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Sexo</label>
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value as AnimalSex)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
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
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
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
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Pasto</label>
          <select
            value={pastureId}
            onChange={(e) => setPastureId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
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
          <label className="text-xs font-medium text-gray-600">Data de entrada</label>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
        </div>

        <div className="col-span-full">
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
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
        <div className="flex gap-6">
          {/* ── Sidebar de filtros (sticky no desktop, drawer no mobile) ── */}
          {/* Botão mobile para abrir filtros */}
          <div className="lg:hidden mb-3">
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${
                hasActiveFilters
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <SlidersHorizontal size={14} />
              Filtros{hasActiveFilters ? ` (${activeFilterCount})` : ''}
            </button>
          </div>

          {/* Drawer overlay mobile */}
          {showFilters && (
            <div
              className="fixed inset-0 z-50 bg-black/40 lg:hidden"
              onClick={(e) => { if (e.target === e.currentTarget) setShowFilters(false); }}
            >
              <aside className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-white p-4 shadow-xl animate-slide-in-left">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Filtros</h3>
                  <button type="button" onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={18} />
                  </button>
                </div>
                <FilterPanel
                  categories={filterCategories} setCategories={setFilterCategories}
                  sexes={filterSexes} setSexes={setFilterSexes}
                  pastureIds={filterPastureIds} setPastureIds={setFilterPastureIds}
                  vaccinationStatuses={filterVaccinationStatuses} setVaccinationStatuses={setFilterVaccinationStatuses}
                  reproductionTypes={filterReproductionTypes} setReproductionTypes={setFilterReproductionTypes}
                  performances={filterPerformances} setPerformances={setFilterPerformances}
                  agePeriods={filterAgePeriods} setAgePeriods={setFilterAgePeriods}
                  pastures={pastures}
                  hasActiveFilters={hasActiveFilters}
                  onClear={clearFilters}
                  toggleInSet={toggleInSet}
                />
              </aside>
            </div>
          )}

          {/* Sidebar desktop sticky */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-8 space-y-1 rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Filtros</h3>
              <FilterPanel
                categories={filterCategories} setCategories={setFilterCategories}
                sexes={filterSexes} setSexes={setFilterSexes}
                pastureIds={filterPastureIds} setPastureIds={setFilterPastureIds}
                vaccinationStatuses={filterVaccinationStatuses} setVaccinationStatuses={setFilterVaccinationStatuses}
                reproductionTypes={filterReproductionTypes} setReproductionTypes={setFilterReproductionTypes}
                performances={filterPerformances} setPerformances={setFilterPerformances}
                agePeriods={filterAgePeriods} setAgePeriods={setFilterAgePeriods}
                pastures={pastures}
                hasActiveFilters={hasActiveFilters}
                onClear={clearFilters}
                toggleInSet={toggleInSet}
              />
            </div>
          </aside>

          {/* ── Lista principal ── */}
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={filteredAnimals.length > 0 && selected.size === filteredAnimals.length}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Selecionar todos
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por brinco..."
                  className="w-48 rounded-lg border border-gray-300 py-1.5 pl-8 pr-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                />
              </div>
            </div>

            {selected.size > 0 && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2">
                <p className="text-sm font-medium text-gray-900">
                  {selected.size} brinco(s) selecionado(s) · peso total{' '}
                  {selectedTotalWeightKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}{' '}
                  kg
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => { setMovePastureId(''); setMoveModalOpen(true); }}
                    className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800"
                  >
                    Mover de pasto
                  </button>
                  <button
                    type="button"
                    onClick={() => openDealForm('VENDA')}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-700"
                  >
                    <ShoppingCart size={14} /> Nova Venda
                  </button>
                  <button
                    type="button"
                    onClick={() => openDealForm('ABATE')}
                    className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-orange-700"
                  >
                    <Skull size={14} /> Novo Abate
                  </button>
                </div>
              </div>
            )}

            {dealFormType && (
              <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-md">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">
                    {dealFormType === 'VENDA' ? '🛒 Nova Venda' : '🔪 Novo Abate'} — {selectedAnimals.length} animal(is), {selectedTotalWeightKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
                  </h3>
                  <button type="button" onClick={() => setDealFormType(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>
                <form onSubmit={handleDealSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{dealFormType === 'VENDA' ? 'Comprador' : 'Frigorífico'}</label>
                      <input type="text" value={dealCounterparty} onChange={(e) => setDealCounterparty(e.target.value)} placeholder={dealFormType === 'VENDA' ? 'Nome do comprador' : 'Nome do frigorífico'} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Preço por</label>
                      <div className="flex gap-2">
                        <select value={dealPriceUnit} onChange={(e) => setDealPriceUnit(e.target.value as 'ANIMAL' | 'ARROBA')} className="rounded-lg border border-gray-300 px-2 py-2 text-sm">
                          <option value="ARROBA">Arroba</option>
                          <option value="ANIMAL">Animal</option>
                        </select>
                        <input type="number" step="0.01" value={dealPricePerUnit} onChange={(e) => setDealPricePerUnit(e.target.value)} placeholder="R$ 0,00" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
                      <input type="date" value={dealDate} onChange={(e) => setDealDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Frete (R$)</label>
                      <input type="number" step="0.01" value={dealFreightCost} onChange={(e) => setDealFreightCost(e.target.value)} placeholder="0,00" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Comissão (%)</label>
                      <input type="number" step="0.1" value={dealCommission} onChange={(e) => setDealCommission(e.target.value)} placeholder="0" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    {dealFormType === 'ABATE' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Rendimento carcaça (%)</label>
                          <input type="number" step="0.1" value={dealCarcassYield} onChange={(e) => setDealCarcassYield(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Preço peso vivo (R$/kg)</label>
                          <input type="number" step="0.01" value={dealLiveWeightPrice} onChange={(e) => setDealLiveWeightPrice(e.target.value)} placeholder="0,00" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
                    <input type="text" value={dealNotes} onChange={(e) => setDealNotes(e.target.value)} placeholder="Observações (opcional)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-500">
                      Animais: <b>{selectedAnimals.length}</b> · Peso: <b>{selectedTotalWeightKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</b> · Arrobas: <b>{(selectedTotalWeightKg / 15).toFixed(1)}</b>
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setDealFormType(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                      <button type="submit" disabled={dealSaving} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${dealFormType === 'VENDA' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'} disabled:opacity-50`}>
                        {dealSaving ? 'Salvando...' : dealFormType === 'VENDA' ? 'Criar Venda' : 'Criar Abate'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {filteredAnimals.length === 0 ? (
              <p className="text-gray-500">Nenhum animal encontrado para esse filtro.</p>
            ) : (
              <ul className="space-y-2">
                {filteredAnimals.map((animal) => (
                  <li
                    key={animal.id}
                    className="flex flex-col gap-2 rounded-xl border border-gray-200/80 bg-white shadow-sm px-4 py-3 transition-all duration-200 hover:border-emerald-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center">
                      <input
                        type="checkbox"
                        checked={selected.has(animal.id)}
                        onChange={(e) => toggleSelected(animal.id, e.target.checked)}
                        className="mr-3 shrink-0 rounded border-gray-300"
                      />
                      <Link href={`/fazendas/${farmId}/animais/${animal.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Beef size={18} strokeWidth={1.9} /></span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-gray-900">{animal.earTag}</span>
                          <span className="block truncate text-sm text-gray-500">
                            {animal.category} · {animal.breed ?? 'Raça não informada'}
                          </span>
                        </span>
                      </Link>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <p className="text-sm text-gray-500">
                        {animal.currentWeightKg ? `${animal.currentWeightKg} kg` : '—'}
                      </p>
                      {(() => { const age = calcAnimalAge(animal); return age ? <span className="text-xs text-blue-600">{age.label}</span> : null; })()}
                      {animal.performance && <span className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${ANIMAL_PERFORMANCE_COLOR[animal.performance]}`}>{ANIMAL_PERFORMANCE_LABEL[animal.performance]}</span>}
                      <button
                        type="button"
                        onClick={() => startEdit(animal)}
                        className="text-sm font-medium text-emerald-700 hover:underline"
                      >
                        Editar
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
          </div>
        </div>
      )}

      {moveModalOpen && (
        <Modal onClose={() => setMoveModalOpen(false)} maxWidth="max-w-md">
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Mover de pasto</h2>
              <button
                type="button"
                onClick={() => setMoveModalOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Mover {selected.size} brinco(s) selecionado(s) para outro pasto.
            </p>
            <label className="text-xs font-medium text-gray-600">Pasto de destino</label>
            <select
              value={movePastureId}
              onChange={(e) => setMovePastureId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
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
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={moving}
                onClick={handleMovePasture}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
              >
                {moving ? 'Movendo...' : 'Mover'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editingId && (
        <Modal onClose={() => setEditingId(null)} maxWidth="max-w-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
                  <Beef size={19} strokeWidth={1.9} />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Brinco {editEarTag}</h2>
                  <p className="text-xs text-gray-500">Visualização rápida</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 overflow-y-auto px-6 py-5 sm:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Brinco</label>
                <input
                  type="text"
                  value={editEarTag}
                  onChange={(e) => setEditEarTag(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Categoria</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as AnimalCategory)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
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
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Pasto</label>
                <select
                  value={editPastureId}
                  onChange={(e) => setEditPastureId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
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
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">RFID</label>
                <input
                  type="text"
                  value={editRfid}
                  onChange={(e) => setEditRfid(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Sexo</label>
                <select
                  value={editSex}
                  onChange={(e) => setEditSex(e.target.value as AnimalSex)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
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
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
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
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Desempenho</label>
                <select
                  value={editPerformance}
                  onChange={(e) => setEditPerformance(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                >
                  <option value="">— Sem classificação —</option>
                  {PERFORMANCE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {ANIMAL_PERFORMANCE_LABEL[opt]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Data de entrada</label>
                <input
                  type="date"
                  value={editEntryDate}
                  onChange={(e) => setEditEntryDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-between border-t border-gray-100 bg-gray-50/60 px-6 py-4">
              <Link
                href={`/fazendas/${farmId}/animais/${editingId}`}
                className="text-sm font-medium text-emerald-700 hover:underline"
              >
                Ver detalhes completos →
              </Link>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveEdit(editingId)}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
        </Modal>
      )}
    </main>
  );
}
