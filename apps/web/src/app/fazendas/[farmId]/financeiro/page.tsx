'use client';

import { Pencil, Wallet, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import type {
  CashFlowBucket,
  CropCycle,
  Transaction,
  TransactionCategory,
  TransactionType,
} from '@/lib/types';

const TYPE_OPTIONS: TransactionType[] = ['RECEITA', 'DESPESA'];
const CATEGORY_OPTIONS: TransactionCategory[] = [
  'NUTRICAO',
  'MEDICAMENTOS',
  'FUNCIONARIOS',
  'COMBUSTIVEL',
  'MAQUINARIO',
  'ENERGIA',
  'VENDA_ANIMAL',
  'OUTROS',
];
const GRANULARITY_OPTIONS: { value: 'daily' | 'weekly' | 'monthly'; label: string }[] = [
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
];

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function FinancePage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const { toastSuccess } = useToast();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowBucket[]>([]);
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [txFilter, setTxFilter] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('all');
  const [fetching, setFetching] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [type, setType] = useState<TransactionType>('DESPESA');
  const [category, setCategory] = useState<TransactionCategory>('OUTROS');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [cropCycleId, setCropCycleId] = useState('');
  const [cropCycles, setCropCycles] = useState<CropCycle[]>([]);

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editType, setEditType] = useState<TransactionType>('DESPESA');
  const [editCategory, setEditCategory] = useState<TransactionCategory>('OUTROS');
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const filteredTransactions = useMemo(() => {
    if (txFilter === 'all') return transactions;
    const now = new Date();
    const start = new Date(now);
    if (txFilter === 'day') {
      start.setHours(0, 0, 0, 0);
    } else if (txFilter === 'week') {
      const day = now.getDay();
      start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      start.setHours(0, 0, 0, 0);
    } else if (txFilter === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
    }
    return transactions.filter((t) => new Date(t.dueDate) >= start);
  }, [transactions, txFilter]);

  const loadTransactions = useCallback(async () => {
    try {
      const data = await apiFetch<Transaction[]>(`/fazendas/${farmId}/lancamentos`, {
        token: accessToken,
      });
      setTransactions(data);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        return false;
      }
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar lançamentos');
      return false;
    }
  }, [farmId, accessToken]);

  const loadCashFlow = useCallback(async () => {
    try {
      const data = await apiFetch<CashFlowBucket[]>(
        `/fazendas/${farmId}/financeiro/fluxo-caixa?granularity=${granularity}`,
        { token: accessToken },
      );
      setCashFlow(data);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 403)) {
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar fluxo de caixa');
      }
    }
  }, [farmId, accessToken, granularity]);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    const ok = await loadTransactions();
    if (ok) {
      await loadCashFlow();
      try {
        const safras = await apiFetch<CropCycle[]>(`/fazendas/${farmId}/safras`, {
          token: accessToken,
        });
        setCropCycles(safras);
      } catch {
        setCropCycles([]);
      }
    }
    setFetching(false);
  }, [loadTransactions, loadCashFlow, farmId, accessToken]);

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

  useEffect(() => {
    if (loading || !user || forbidden) return;
    // Re-fetching when the user changes the granularity selector is the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCashFlow();
    // Only the granularity change should re-trigger this fetch; loadCashFlow itself
    // already depends on accessToken/farmId and is recreated when those change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await apiFetch<Transaction>(`/fazendas/${farmId}/lancamentos`, {
        method: 'POST',
        token: accessToken,
        body: {
          type,
          category,
          description: description || undefined,
          amount: Number(amount),
          dueDate,
          paidAt: alreadyPaid ? today : undefined,
          cropCycleId: cropCycleId || undefined,
        },
      });
      setDescription('');
      setAmount('');
      setDueDate('');
      setAlreadyPaid(false);
      setCropCycleId('');
      await loadData();
      toastSuccess('Lançamento criado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar lançamento');
    } finally {
      setCreating(false);
    }
  }

  async function handleMarkPaid(transactionId: string) {
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/lancamentos/${transactionId}/pagar`, {
        method: 'PATCH',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao marcar como pago');
    }
  }

  function startEdit(t: Transaction) {
    setEditingTx(t);
    setEditType(t.type);
    setEditCategory(t.category);
    setEditDescription(t.description ?? '');
    setEditAmount(String(t.amount));
    setEditDueDate(t.dueDate.slice(0, 10));
  }

  async function handleSaveEdit() {
    if (!editingTx) return;
    setSavingEdit(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/lancamentos/${editingTx.id}`, {
        method: 'PATCH',
        token: accessToken,
        body: {
          type: editType,
          category: editCategory,
          description: editDescription || undefined,
          amount: Number(editAmount),
          dueDate: editDueDate,
        },
      });
      setEditingTx(null);
      await loadData();
      toastSuccess('Lançamento atualizado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar lançamento');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(transactionId: string) {
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/lancamentos/${transactionId}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir lançamento');
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
      <PageHeader
        icon={Wallet}
        title="Financeiro"
        subtitle="Lançamentos e fluxo de caixa"
        backHref={`/fazendas/${farmId}`}
      />

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {forbidden ? (
        <p className="rounded-xl border border-gray-200/80 bg-white shadow-sm px-4 py-3 text-sm text-gray-500">
          Seu perfil não tem permissão para visualizar os dados financeiros desta propriedade.
        </p>
      ) : (
        <>
          <form
            onSubmit={handleCreate}
            className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4 sm:grid-cols-4"
          >
            <div>
              <label className="text-xs font-medium text-gray-600">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TransactionType)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'RECEITA' ? 'Receita' : 'Despesa'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TransactionCategory)}
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
              <label className="text-xs font-medium text-gray-600">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Vencimento</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              />
            </div>

            <div className="col-span-2 sm:col-span-3">
              <label className="text-xs font-medium text-gray-600">Descrição (opcional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              />
            </div>

            {cropCycles.length > 0 && (
              <div className="col-span-2 sm:col-span-3">
                <label className="text-xs font-medium text-gray-600">
                  Vincular a uma safra (opcional)
                </label>
                <select
                  value={cropCycleId}
                  onChange={(e) => setCropCycleId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                >
                  <option value="">Sem vínculo</option>
                  {cropCycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.cropName}
                      {c.variety ? ` — ${c.variety}` : ''} ·{' '}
                      {new Date(c.plantedAt).toLocaleDateString('pt-BR')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2 self-end pb-1.5">
              <input
                id="alreadyPaid"
                type="checkbox"
                checked={alreadyPaid}
                onChange={(e) => setAlreadyPaid(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="alreadyPaid" className="text-sm text-gray-700">
                Já pago/recebido
              </label>
            </div>

            <div className="col-span-full">
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
              >
                {creating ? 'Salvando...' : 'Lançar'}
              </button>
            </div>
          </form>

          <section className="mb-8 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Fluxo de caixa</h2>
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as 'daily' | 'weekly' | 'monthly')}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              >
                {GRANULARITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {cashFlow.length === 0 ? (
              <p className="text-sm text-gray-500">Sem dados para o período.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-gray-500">
                    <th className="py-1">Período</th>
                    <th className="py-1">Receita</th>
                    <th className="py-1">Despesa</th>
                    <th className="py-1">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlow.map((bucket) => (
                    <tr key={bucket.period} className="border-t border-gray-100">
                      <td className="py-1.5">{bucket.period}</td>
                      <td className="py-1.5 text-emerald-700">{formatCurrency(bucket.receita)}</td>
                      <td className="py-1.5 text-red-600">{formatCurrency(bucket.despesa)}</td>
                      <td className="py-1.5 font-medium">{formatCurrency(bucket.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Lançamentos</h2>
              <div className="flex gap-1">
                {([['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês'], ['year', 'Ano'], ['all', 'Todos']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTxFilter(val)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                      txFilter === val
                        ? 'bg-emerald-700 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
                <p className="text-lg font-medium text-gray-700">
                  {transactions.length === 0 ? 'Nenhum lançamento' : 'Nenhum lançamento no período'}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {transactions.length === 0
                    ? 'Registre receitas e despesas para acompanhar o fluxo de caixa da propriedade.'
                    : 'Altere o filtro para ver outros lançamentos.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {filteredTransactions.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white shadow-sm px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {t.type === 'RECEITA' ? '+ ' : '- '}
                        {formatCurrency(t.amount)} · {t.category}
                      </p>
                      <p className="text-sm text-gray-500">
                        Vencimento: {new Date(t.dueDate).toLocaleDateString('pt-BR')}
                        {t.description ? ` · ${t.description}` : ''}
                        {t.paidAt ? ' · pago' : ' · pendente'}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => startEdit(t)}
                        className="text-xs font-medium text-emerald-700 hover:underline"
                      >
                        Editar
                      </button>
                      {!t.paidAt && (
                        <button
                          onClick={() => handleMarkPaid(t.id)}
                          className="text-xs font-medium text-emerald-700 hover:underline"
                        >
                          Marcar como pago
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Excluir
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {editingTx && (
            <Modal onClose={() => setEditingTx(null)}>
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
                    <Pencil size={19} strokeWidth={1.9} />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Editar lançamento</h2>
                    <p className="text-xs text-gray-500">{formatCurrency(editingTx.amount)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 px-6 py-5">
                <div>
                  <label className="text-xs font-medium text-gray-600">Tipo</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as TransactionType)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt === 'RECEITA' ? 'Receita' : 'Despesa'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Categoria</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as TransactionCategory)}
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
                  <label className="text-xs font-medium text-gray-600">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Vencimento</label>
                  <input
                    type="date"
                    required
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600">Descrição (opcional)</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={handleSaveEdit}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
                >
                  {savingEdit ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </Modal>
          )}
        </>
      )}
    </main>
  );
}
