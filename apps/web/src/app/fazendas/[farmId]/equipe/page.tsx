'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { useConfirm } from '@/lib/confirm-context';
import type { Employee, EmployeeType, TimeEntry } from '@/lib/types';

const TYPE_OPTIONS: { value: EmployeeType; label: string }[] = [
  { value: 'EFETIVO', label: 'Efetivo' },
  { value: 'CHAPA', label: 'Chapa' },
  { value: 'TEMPORARIO', label: 'Temporário' },
  { value: 'OUTRO', label: 'Outro' },
];

const TYPE_LABEL: Record<EmployeeType, string> = Object.fromEntries(
  TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<EmployeeType, string>;

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface EmployeeForm {
  name: string;
  type: EmployeeType;
  role: string;
  document: string;
  phone: string;
  hourlyRate: string;
  active: boolean;
  notes: string;
}

const EMPTY_EMPLOYEE: EmployeeForm = {
  name: '',
  type: 'EFETIVO',
  role: '',
  document: '',
  phone: '',
  hourlyRate: '',
  active: true,
  notes: '',
};

function buildEmployeeBody(form: EmployeeForm) {
  return {
    name: form.name,
    type: form.type,
    role: form.role || undefined,
    document: form.document || undefined,
    phone: form.phone || undefined,
    hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : 0,
    active: form.active,
    notes: form.notes || undefined,
  };
}

function employeeToForm(e: Employee): EmployeeForm {
  return {
    name: e.name,
    type: e.type,
    role: e.role ?? '',
    document: e.document ?? '',
    phone: e.phone ?? '',
    hourlyRate: e.hourlyRate ? String(e.hourlyRate) : '',
    active: e.active,
    notes: e.notes ?? '',
  };
}

export default function TeamPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const { toastSuccess } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTypes, setFilterTypes] = useState<Set<EmployeeType>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [onlyPending, setOnlyPending] = useState(false);

  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_EMPLOYEE);
  const [detail, setDetail] = useState<Employee | null>(null);

  // Time entry form
  const [entryDescription, setEntryDescription] = useState('');
  const [entryHours, setEntryHours] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [entryPaid, setEntryPaid] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editEntryDescription, setEditEntryDescription] = useState('');
  const [editEntryHours, setEditEntryHours] = useState('');
  const [editEntryDate, setEditEntryDate] = useState('');
  const [editEntryPaid, setEditEntryPaid] = useState(false);
  const [showAllEntries, setShowAllEntries] = useState(false);

  // Calculadora valor-hora → valor total
  const [calcRate, setCalcRate] = useState('');
  const [calcHours, setCalcHours] = useState('');

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<Employee[]>(`/fazendas/${farmId}/funcionarios`, {
        token: accessToken,
      });
      setEmployees(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar a equipe');
    } finally {
      setFetching(false);
    }
  }, [farmId, accessToken]);

  const loadDetail = useCallback(
    async (employeeId: string) => {
      try {
        const data = await apiFetch<Employee>(
          `/fazendas/${farmId}/funcionarios/${employeeId}`,
          { token: accessToken },
        );
        setDetail(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar o funcionário');
      }
    },
    [farmId, accessToken],
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loading, user, loadData, router]);

  function toggleType(value: EmployeeType) {
    setFilterTypes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  const filteredEmployees = employees.filter((e) => {
    if (searchTerm) {
      const term = searchTerm.trim().toLowerCase();
      const haystack = [e.name, e.role, e.document, e.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (filterTypes.size > 0 && !filterTypes.has(e.type)) return false;
    if (statusFilter === 'active' && !e.active) return false;
    if (statusFilter === 'inactive' && e.active) return false;
    if (onlyPending && e.totalCost <= 0) return false;
    return true;
  });

  function selectNew() {
    setSelectedId('new');
    setForm(EMPTY_EMPLOYEE);
    setDetail(null);
    setError(null);
  }

  async function selectEmployee(employee: Employee) {
    setSelectedId(employee.id);
    setForm(employeeToForm(employee));
    setEditingEntryId(null);
    setShowAllEntries(false);
    setError(null);
    await loadDetail(employee.id);
  }

  async function handleSaveEmployee(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (selectedId === 'new') {
        const created = await apiFetch<Employee>(`/fazendas/${farmId}/funcionarios`, {
          method: 'POST',
          token: accessToken,
          body: buildEmployeeBody(form),
        });
        await loadData();
        setSelectedId(created.id);
        await loadDetail(created.id);
      } else if (selectedId) {
        await apiFetch(`/fazendas/${farmId}/funcionarios/${selectedId}`, {
          method: 'PATCH',
          token: accessToken,
          body: buildEmployeeBody(form),
        });
        await loadData();
        await loadDetail(selectedId);
      }
      toastSuccess('Funcionário salvo.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar o funcionário');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEmployee() {
    if (!selectedId || selectedId === 'new') return;
    const ok = await confirm({
      title: 'Excluir funcionário',
      message: `Excluir ${form.name} e todos os seus registros de horas? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/funcionarios/${selectedId}`, {
        method: 'DELETE',
        token: accessToken,
      });
      setSelectedId(null);
      setDetail(null);
      await loadData();
      toastSuccess('Funcionário excluído.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir o funcionário');
    }
  }

  async function handleAddEntry(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || selectedId === 'new') return;
    setSavingEntry(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/funcionarios/${selectedId}/horas`, {
        method: 'POST',
        token: accessToken,
        body: {
          description: entryDescription,
          hours: Number(entryHours),
          paid: entryPaid,
          workDate: entryDate || undefined,
        },
      });
      setEntryDescription('');
      setEntryHours('');
      setEntryDate('');
      setEntryPaid(false);
      await loadData();
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar horas');
    } finally {
      setSavingEntry(false);
    }
  }

  function startEditEntry(entry: TimeEntry) {
    setEditingEntryId(entry.id);
    setEditEntryDescription(entry.description);
    setEditEntryHours(String(entry.hours));
    setEditEntryDate(entry.workDate.slice(0, 10));
    setEditEntryPaid(entry.paid);
  }

  async function handleTogglePaid(entry: TimeEntry) {
    if (!selectedId || selectedId === 'new') return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/funcionarios/${selectedId}/horas/${entry.id}`, {
        method: 'PATCH',
        token: accessToken,
        body: { paid: !entry.paid },
      });
      await loadData();
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar registro');
    }
  }

  async function handleSaveEntry(entryId: string) {
    if (!selectedId || selectedId === 'new') return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/funcionarios/${selectedId}/horas/${entryId}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          description: editEntryDescription,
          hours: Number(editEntryHours),
          paid: editEntryPaid,
          workDate: editEntryDate || undefined,
        },
      });
      setEditingEntryId(null);
      await loadData();
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar registro');
    }
  }

  async function handleDeleteEntry(entry: TimeEntry) {
    if (!selectedId || selectedId === 'new') return;
    const ok = await confirm({
      title: 'Excluir registro de horas',
      message: 'Excluir este registro do banco de horas?',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/funcionarios/${selectedId}/horas/${entry.id}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir registro');
    }
  }

  const totalCostAll = employees.reduce((sum, e) => sum + e.totalCost, 0);
  const paidCostAll = employees.reduce((sum, e) => sum + e.paidCost, 0);
  const activeCount = employees.filter((e) => e.active).length;

  const calcRateNum = Number(calcRate);
  const calcHoursNum = Number(calcHours);
  const calcResultTotal =
    calcRate && calcHours ? formatCurrency(calcRateNum * calcHoursNum) : '—';

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="animate-fade-up mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
      <PageHeader
        icon={Users}
        title="Equipe"
        subtitle="Funcionários e banco de horas"
        backHref={`/fazendas/${farmId}`}
      />

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {/* Resumo geral */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCard label="Funcionários" value={`${employees.length}`} sub={`${activeCount} ativo(s)`} />
        <SummaryCard
          label="Custo total de horas"
          value={formatCurrency(totalCostAll)}
          sub={`${formatCurrency(paidCostAll)} já pago(s)`}
        />
        <SummaryCard
          label="Tipos"
          value={`${new Set(employees.map((e) => e.type)).size}`}
          sub="categorias em uso"
        />
      </div>

      {/* Calculadora valor-hora / valor */}
      <section className="mb-6 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Calculadora de valor / hora</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-gray-600">Valor/hora (R$)</label>
            <input
              type="number"
              step="0.01"
              value={calcRate}
              onChange={(e) => setCalcRate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Horas</label>
            <input
              type="number"
              step="0.1"
              value={calcHours}
              onChange={(e) => setCalcHours(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-700">
          Valor total (valor/hora × horas):{' '}
          <strong className="text-emerald-700">{calcResultTotal}</strong>
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[300px_1fr]">
        {/* Left: employees list */}
        <div>
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome..."
              className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
            <button
              type="button"
              onClick={selectNew}
              className="shrink-0 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800"
            >
              + Novo
            </button>
          </div>

          <div className="mb-3 space-y-3 rounded-xl border border-gray-200/80 bg-white shadow-sm p-3">
            <div>
              <p className="mb-1 text-xs font-medium text-gray-600">Tipo</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-1.5 text-sm text-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={filterTypes.has(opt.value)}
                      onChange={() => toggleType(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-gray-600">Situação</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {(
                  [
                    { value: 'all', label: 'Todos' },
                    { value: 'active', label: 'Ativos' },
                    { value: 'inactive', label: 'Inativos' },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-1.5 text-sm text-gray-700"
                  >
                    <input
                      type="radio"
                      name="statusFilter"
                      checked={statusFilter === opt.value}
                      onChange={() => setStatusFilter(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={onlyPending}
                onChange={(e) => setOnlyPending(e.target.checked)}
              />
              Só com custo a pagar
            </label>
          </div>

          {fetching ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
              <p className="text-lg font-medium text-gray-700">Nenhum funcionário cadastrado</p>
              <p className="mt-1 text-sm text-gray-500">Cadastre funcionários para controlar banco de horas, custos e atribuições.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {filteredEmployees.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => selectEmployee(e)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm hover:border-emerald-600 ${
                      selectedId === e.id
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900">{e.name}</p>
                      {!e.active && (
                        <span className="rounded-lg bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {TYPE_LABEL[e.type]}
                      {e.role ? ` · ${e.role}` : ''} · {formatCurrency(e.totalCost)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: detail / edit / create + banco de horas */}
        <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
          {selectedId === null ? (
            <p className="text-sm text-gray-500">
              Selecione um funcionário à esquerda ou clique em &quot;+ Novo&quot; para
              cadastrar.
            </p>
          ) : (
            <div className="space-y-6">
              <form onSubmit={handleSaveEmployee} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-800">
                    {selectedId === 'new' ? 'Novo funcionário' : 'Dados do funcionário'}
                  </h2>
                  {selectedId !== 'new' && (
                    <button
                      type="button"
                      onClick={handleDeleteEmployee}
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600">Nome</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Tipo</label>
                    <select
                      value={form.type}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, type: e.target.value as EmployeeType }))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    >
                      {TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Função</label>
                    <input
                      type="text"
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                      placeholder="Ex.: Tratorista"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Valor/hora (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.hourlyRate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, hourlyRate: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Documento (CPF)</label>
                    <input
                      type="text"
                      value={form.document}
                      onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Telefone</label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    />
                  </div>
                  <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    />
                    Ativo
                  </label>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600">Observações</label>
                    <input
                      type="text"
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(null);
                      setDetail(null);
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>

              {/* Banco de horas — só para funcionário já cadastrado */}
              {selectedId !== 'new' && detail && (
                <div className="border-t border-gray-200 pt-4">
                  <h2 className="mb-3 font-semibold text-gray-800">Banco de horas</h2>
                  <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <SummaryCard
                      label="Horas trabalhadas"
                      value={`${detail.totalHours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`}
                    />
                    <SummaryCard
                      label="Saldo do banco"
                      value={`${detail.balanceHours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`}
                    />
                    <SummaryCard
                      label="Custo gerado"
                      value={formatCurrency(detail.grossCost)}
                      sub={`${formatCurrency(detail.paidCost)} já pago(s)`}
                    />
                    <SummaryCard label="Custo a pagar" value={formatCurrency(detail.totalCost)} />
                  </div>

                  <form
                    onSubmit={handleAddEntry}
                    className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Descrição"
                      value={entryDescription}
                      onChange={(e) => setEntryDescription(e.target.value)}
                      className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    />
                    <input
                      type="number"
                      step="0.1"
                      required
                      placeholder="Horas (+/-)"
                      value={entryHours}
                      onChange={(e) => setEntryHours(e.target.value)}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    />
                    <input
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    />
                    <label className="col-span-2 flex items-center gap-1.5 text-sm text-gray-700 sm:col-span-3">
                      <input
                        type="checkbox"
                        checked={entryPaid}
                        onChange={(e) => setEntryPaid(e.target.checked)}
                      />
                      Já paga (abate do custo a pagar)
                    </label>
                    <button
                      type="submit"
                      disabled={savingEntry}
                      className="col-span-2 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50 sm:col-span-1"
                    >
                      {savingEntry ? 'Salvando...' : 'Registrar horas'}
                    </button>
                  </form>
                  <p className="mb-3 text-xs text-gray-400">
                    Use horas positivas para trabalho e negativas para folga/débito no banco de
                    horas. Horas marcadas como pagas não entram no custo a pagar.
                  </p>

                  {!detail.timeEntries || detail.timeEntries.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhum registro de horas ainda.</p>
                  ) : (
                    <ul className="space-y-2 text-sm text-gray-700">
                      {(showAllEntries
                        ? detail.timeEntries
                        : detail.timeEntries.slice(0, 3)
                      ).map((entry) =>
                        editingEntryId === entry.id ? (
                          <li
                            key={entry.id}
                            className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-600 p-2"
                          >
                            <input
                              type="text"
                              value={editEntryDescription}
                              onChange={(e) => setEditEntryDescription(e.target.value)}
                              className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                            />
                            <input
                              type="number"
                              step="0.1"
                              value={editEntryHours}
                              onChange={(e) => setEditEntryHours(e.target.value)}
                              className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                            />
                            <input
                              type="date"
                              value={editEntryDate}
                              onChange={(e) => setEditEntryDate(e.target.value)}
                              className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                            />
                            <label className="flex items-center gap-1 text-xs text-gray-700">
                              <input
                                type="checkbox"
                                checked={editEntryPaid}
                                onChange={(e) => setEditEntryPaid(e.target.checked)}
                              />
                              Paga
                            </label>
                            <button
                              type="button"
                              onClick={() => handleSaveEntry(entry.id)}
                              className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-semibold text-white transition-colors duration-150 hover:bg-emerald-800"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingEntryId(null)}
                              className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                            >
                              Cancelar
                            </button>
                          </li>
                        ) : (
                          <li
                            key={entry.id}
                            className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2 last:border-0"
                          >
                            <span className="min-w-0">
                              <span className="block">
                                {new Date(entry.workDate).toLocaleDateString('pt-BR')} —{' '}
                                <strong className={entry.hours < 0 ? 'text-red-600' : ''}>
                                  {entry.hours > 0 ? '+' : ''}
                                  {entry.hours}h
                                </strong>{' '}
                                {entry.description}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatCurrency(entry.hours * detail.hourlyRate)}
                                {entry.paid && (
                                  <span className="ml-2 rounded-lg bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                                    Paga
                                  </span>
                                )}
                              </span>
                            </span>
                            <span className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => handleTogglePaid(entry)}
                                className="text-xs font-medium text-gray-600 hover:underline"
                              >
                                {entry.paid ? 'Marcar não paga' : 'Marcar paga'}
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditEntry(entry)}
                                className="text-xs font-medium text-emerald-700 hover:underline"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteEntry(entry)}
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
                  {detail.timeEntries && detail.timeEntries.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setShowAllEntries((v) => !v)}
                      className="mt-3 text-sm font-medium text-emerald-700 hover:underline"
                    >
                      {showAllEntries
                        ? 'Mostrar menos'
                        : `Mostrar mais resultados (${detail.timeEntries.length - 3})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
