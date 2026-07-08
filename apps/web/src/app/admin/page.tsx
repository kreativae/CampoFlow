'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useConfirm } from '@/lib/confirm-context';
import { apiFetch, ApiError } from '@/lib/api';
import type {
  AccountDetail,
  AccountListResponse,
  AccountSummary,
  AdminOverview,
  PlanTier,
  SubscriptionStatus,
} from '@/lib/types';
import { SUBSCRIPTION_STATUS_LABEL, paymentStatusLabel } from '@/lib/types';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const PLAN_OPTIONS: PlanTier[] = ['TRIAL', 'BASICO', 'PROFISSIONAL', 'ENTERPRISE'];
const STATUS_OPTIONS: SubscriptionStatus[] = [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'SUSPENDED',
];

function statusBadgeClass(status: SubscriptionStatus | null) {
  if (status === 'ACTIVE' || status === 'TRIALING') return 'bg-green-50 text-green-700';
  if (status === 'PAST_DUE') return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: 'green' | 'amber' | 'red';
}) {
  const valueColor =
    accent === 'green'
      ? 'text-green-700'
      : accent === 'amber'
        ? 'text-amber-700'
        : accent === 'red'
          ? 'text-red-700'
          : 'text-gray-900';
  return (
    <div className="rounded border border-gray-200 bg-white px-3 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${valueColor}`}>{value}</p>
    </div>
  );
}

export default function AdminAccountsPage() {
  const { accessToken } = useAuth();
  const confirm = useConfirm();

  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [fetching, setFetching] = useState(true);

  // Busca / filtro / paginação
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | ''>('');
  const [planFilter, setPlanFilter] = useState<PlanTier | ''>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const [refreshingQuotations, setRefreshingQuotations] = useState(false);
  const [quotationsMsg, setQuotationsMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<AccountDetail | null>(null);
  const [loadingExpanded, setLoadingExpanded] = useState(false);

  const loadAccounts = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (planFilter) params.set('planTier', planFilter);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const [data, ov] = await Promise.all([
        apiFetch<AccountListResponse>(`/admin/contas?${params.toString()}`, {
          token: accessToken,
        }),
        apiFetch<AdminOverview>('/admin/overview', { token: accessToken }).catch(
          () => null,
        ),
      ]);
      setAccounts(data.items);
      setTotal(data.total);
      setOverview(ov);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar contas');
    } finally {
      setFetching(false);
    }
  }, [accessToken, search, statusFilter, planFilter, page]);

  useEffect(() => {
    // Fetching data on mount via an async callback is the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccounts();
  }, [loadAccounts]);

  async function handleRefreshQuotations() {
    setRefreshingQuotations(true);
    setQuotationsMsg(null);
    setError(null);
    try {
      const res = await apiFetch<{ created: number; skipped: number }>(
        '/admin/cotacoes/atualizar',
        { method: 'POST', token: accessToken },
      );
      setQuotationsMsg(
        `Cotações atualizadas: ${res.created} nova(s), ${res.skipped} sem alteração.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar cotações');
    } finally {
      setRefreshingQuotations(false);
    }
  }

  async function handleUpdate(
    accountId: string,
    field: 'planTier' | 'status',
    value: string,
  ) {
    setSavingId(accountId);
    setError(null);
    try {
      await apiFetch(`/admin/contas/${accountId}/assinatura`, {
        method: 'PATCH',
        token: accessToken,
        body: { [field]: value },
      });
      await loadAccounts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar assinatura');
    } finally {
      setSavingId(null);
    }
  }

  function toggleSelected(accountId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(accountId);
      else next.delete(accountId);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelected(checked ? new Set(accounts.map((a) => a.id)) : new Set());
  }

  async function toggleExpanded(accountId: string) {
    if (expandedId === accountId) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(accountId);
    setExpandedDetail(null);
    setLoadingExpanded(true);
    try {
      const data = await apiFetch<AccountDetail>(`/admin/contas/${accountId}`, {
        token: accessToken,
      });
      setExpandedDetail(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar detalhes');
    } finally {
      setLoadingExpanded(false);
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    // Listing every selected account name in the dialog body got slow/janky once
    // dozens of accounts were selected — show only the count instead.
    const confirmed = await confirm({
      title: `Excluir ${selected.size} conta(s)`,
      message:
        `ATENÇÃO: excluir ${selected.size} conta(s) é IRREVERSÍVEL.\n\n` +
        'Propriedades, usuários, tickets e assinaturas dessas contas serão apagados ' +
        'permanentemente, e as assinaturas no Mercado Pago serão canceladas.',
      confirmLabel: 'Excluir definitivamente',
      danger: true,
      requireText: 'EXCLUIR',
      requireTextLabel: 'Para confirmar, digite EXCLUIR',
    });
    if (!confirmed) return;

    setDeletingBulk(true);
    setError(null);
    try {
      await apiFetch('/admin/contas', {
        method: 'DELETE',
        token: accessToken,
        body: { accountIds: Array.from(selected) },
      });
      setSelected(new Set());
      await loadAccounts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir contas');
    } finally {
      setDeletingBulk(false);
    }
  }

  if (fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  const allSelected = accounts.length > 0 && selected.size === accounts.length;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Contas e assinaturas</h1>
          <p className="text-sm text-gray-500">
            Visão restrita à equipe da plataforma. Alterar plano/status aqui não passa pelo
            Mercado Pago — use só para suporte (conta de cortesia, corrigir assinatura travada,
            reativação manual).
          </p>
        </div>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={deletingBulk}
            className="shrink-0 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deletingBulk ? 'Excluindo...' : `Excluir selecionadas (${selected.size})`}
          </button>
        )}
      </header>

      {overview && (
        <section className="mb-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="Contas" value={overview.totalAccounts} />
            <MetricCard label="MRR" value={BRL.format(overview.mrr)} accent="green" />
            <MetricCard
              label="Ativas"
              value={overview.statusCounts.ACTIVE ?? 0}
              accent="green"
            />
            <MetricCard label="Em trial" value={overview.statusCounts.TRIALING ?? 0} />
            <MetricCard
              label="Inadimplentes"
              value={overview.statusCounts.PAST_DUE ?? 0}
              accent={
                (overview.statusCounts.PAST_DUE ?? 0) > 0 ? 'amber' : undefined
              }
            />
            <MetricCard
              label="Canceladas"
              value={overview.statusCounts.CANCELED ?? 0}
              accent={(overview.statusCounts.CANCELED ?? 0) > 0 ? 'red' : undefined}
            />
            <MetricCard label="Fazendas" value={overview.totalFarms} />
            <MetricCard label="Novas contas (7d)" value={overview.newAccounts7d} />
            <MetricCard label="Novas contas (30d)" value={overview.newAccounts30d} />
            <MetricCard
              label="Tickets abertos"
              value={overview.openTickets}
              accent={overview.openTickets > 0 ? 'amber' : undefined}
            />
            <MetricCard
              label="Básico / Prof."
              value={`${overview.planCounts.BASICO ?? 0} / ${overview.planCounts.PROFISSIONAL ?? 0}`}
            />
            <MetricCard label="Enterprise" value={overview.planCounts.ENTERPRISE ?? 0} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleRefreshQuotations}
              disabled={refreshingQuotations}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            >
              {refreshingQuotations ? 'Atualizando...' : 'Atualizar cotações agora'}
            </button>
            {quotationsMsg && (
              <span className="text-xs text-green-700">{quotationsMsg}</span>
            )}
          </div>
        </section>
      )}

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {/* Busca e filtros */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="flex flex-1 gap-2"
        >
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome, e-mail de cobrança ou de usuário"
            className="w-full max-w-md rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Buscar
          </button>
        </form>
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value as SubscriptionStatus | '');
          }}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
        >
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {SUBSCRIPTION_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={planFilter}
          onChange={(e) => {
            setPage(1);
            setPlanFilter(e.target.value as PlanTier | '');
          }}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
        >
          <option value="">Todos os planos</option>
          {PLAN_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {accounts.length === 0 ? (
        <p className="text-gray-500">
          {search || statusFilter || planFilter
            ? 'Nenhuma conta encontrada com esses filtros.'
            : 'Nenhuma conta cadastrada ainda.'}
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
              <th className="w-8 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                />
              </th>
              <th className="py-2">Conta</th>
              <th className="py-2">Responsável</th>
              <th className="py-2">Fazendas</th>
              <th className="py-2">Plano</th>
              <th className="py-2">Status</th>
              <th className="py-2">Criada em</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <Fragment key={account.id}>
                <tr className="border-b border-gray-100">
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(account.id)}
                      onChange={(e) => toggleSelected(account.id, e.target.checked)}
                    />
                  </td>
                  <td className="py-2">
                    <Link
                      href={`/admin/contas/${account.id}`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {account.name}
                    </Link>
                    <p className="text-xs text-gray-400">{account.billingEmail}</p>
                  </td>
                  <td className="py-2 text-gray-600">{account.owner?.email ?? '—'}</td>
                  <td className="py-2">{account.farmsUsed}</td>
                  <td className="py-2">
                    <select
                      value={account.planTier ?? ''}
                      disabled={savingId === account.id}
                      onChange={(e) => handleUpdate(account.id, 'planTier', e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-green-600 focus:outline-none"
                    >
                      {PLAN_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2">
                    <select
                      value={account.status ?? ''}
                      disabled={savingId === account.id}
                      onChange={(e) => handleUpdate(account.id, 'status', e.target.value)}
                      className={`rounded border border-gray-300 px-2 py-1 text-sm focus:border-green-600 focus:outline-none ${statusBadgeClass(account.status)}`}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {SUBSCRIPTION_STATUS_LABEL[opt]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 text-gray-500">
                    {new Date(account.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(account.id)}
                      className="text-xs font-medium text-green-700 hover:underline"
                    >
                      {expandedId === account.id ? 'Ocultar' : 'Visualizar'}
                    </button>
                  </td>
                </tr>
                {expandedId === account.id && (
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td colSpan={8} className="px-2 py-3">
                      {loadingExpanded ? (
                        <p className="text-xs text-gray-500">Carregando...</p>
                      ) : expandedDetail ? (
                        <div className="grid grid-cols-2 gap-4 text-xs text-gray-700 sm:grid-cols-4">
                          <div>
                            <p className="font-medium text-gray-500">Fim do teste</p>
                            <p>
                              {expandedDetail.subscription?.trialEndsAt
                                ? new Date(
                                    expandedDetail.subscription.trialEndsAt,
                                  ).toLocaleDateString('pt-BR')
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-500">
                              Fim do período atual
                            </p>
                            <p>
                              {expandedDetail.subscription?.currentPeriodEnd
                                ? new Date(
                                    expandedDetail.subscription.currentPeriodEnd,
                                  ).toLocaleDateString('pt-BR')
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-500">Membros</p>
                            <p>{expandedDetail.users.length}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-500">Último pagamento</p>
                            <p>
                              {expandedDetail.paymentHistory[0]
                                ? `${paymentStatusLabel(expandedDetail.paymentHistory[0].status)} · ${new Date(
                                    expandedDetail.paymentHistory[0].dateCreated,
                                  ).toLocaleDateString('pt-BR')}`
                                : '—'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-red-700">Erro ao carregar detalhes.</p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}

      {total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * pageSize >= total}
              className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
