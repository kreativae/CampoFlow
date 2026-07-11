'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useConfirm } from '@/lib/confirm-context';
import {
  SUBSCRIPTION_STATUS_LABEL,
  type AccountSubscription,
  type PlanTier,
  type SubscriptionStatus,
} from '@/lib/types';

const STATUS_COLOR: Record<SubscriptionStatus, string> = {
  TRIALING: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-green-100 text-green-800',
  PAST_DUE: 'bg-amber-100 text-amber-800',
  CANCELED: 'bg-gray-100 text-gray-700',
  SUSPENDED: 'bg-red-100 text-red-800',
};

interface PlanCard {
  tier: PlanTier;
  label: string;
  priceLabel: string;
  farms: string;
  highlights: string[];
  checkout: boolean; // self-service (BASICO/PROFISSIONAL)
}

const PLAN_CARDS: PlanCard[] = [
  {
    tier: 'BASICO',
    label: 'Básico',
    priceLabel: 'R$ 99,90/mês',
    farms: 'Até 2 propriedades',
    highlights: ['Todos os módulos', 'Multiusuário', 'Suporte por chamado'],
    checkout: true,
  },
  {
    tier: 'PROFISSIONAL',
    label: 'Profissional',
    priceLabel: 'R$ 299,90/mês',
    farms: 'Até 10 propriedades',
    highlights: ['Tudo do Básico', 'BI/Inteligência', 'Prioridade no suporte'],
    checkout: true,
  },
  {
    tier: 'ENTERPRISE',
    label: 'Enterprise',
    priceLabel: 'Sob consulta',
    farms: 'Propriedades ilimitadas',
    highlights: ['Tudo do Profissional', 'Integrações dedicadas', 'Gerente de conta'],
    checkout: false,
  },
];

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '—';
}

function SubscriptionContent() {
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirm = useConfirm();

  const [sub, setSub] = useState<AccountSubscription | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyTier, setBusyTier] = useState<PlanTier | null>(null);

  useEffect(() => {
    const status = searchParams.get('status') ?? searchParams.get('collection_status');
    if (status === 'approved') {
      setMessage('Pagamento aprovado! Sua assinatura será ativada em instantes.');
    } else if (status === 'pending' || status === 'in_process') {
      setMessage('Pagamento em processamento. Assim que for confirmado, sua assinatura será ativada automaticamente.');
    } else if (status === 'rejected') {
      setError('O pagamento foi recusado. Tente novamente ou escolha outro meio de pagamento.');
    }
  }, [searchParams]);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<AccountSubscription>('/conta/assinatura', {
        token: accessToken,
      });
      setSub(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar a assinatura');
    } finally {
      setFetching(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loading, user, loadData, router]);

  async function handleCheckout(tier: PlanTier) {
    if (tier !== 'BASICO' && tier !== 'PROFISSIONAL') return;
    setBusyTier(tier);
    setError(null);
    setMessage(null);
    try {
      const { checkoutUrl } = await apiFetch<{ checkoutUrl: string }>(
        '/conta/assinatura/checkout',
        { method: 'POST', token: accessToken, body: { planTier: tier } },
      );
      // Redireciona para o checkout do Stripe.
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Erro ao iniciar o pagamento',
      );
      setBusyTier(null);
    }
  }

  async function handleCancel() {
    const ok = await confirm({
      title: 'Cancelar assinatura',
      message:
        'Cancelar a assinatura? Você mantém acesso de leitura/exportação por 30 dias e pode reativar a qualquer momento.',
      confirmLabel: 'Cancelar assinatura',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/conta/assinatura/cancelar', {
        method: 'POST',
        token: accessToken,
      });
      setMessage('Assinatura cancelada.');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cancelar a assinatura');
    }
  }

  if (loading || !user || fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  const canCancel =
    sub && (sub.status === 'ACTIVE' || sub.status === 'TRIALING');
  const isTrial = sub?.planTier === 'TRIAL';

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/fazendas" className="text-sm text-green-700 hover:underline">
          ← Propriedades
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">Minha assinatura</h1>
        <p className="text-sm text-gray-500">
          Gerencie seu plano, pagamento e limites da conta.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}

      {sub && (
        <>
          {/* Situação atual */}
          <section className="mb-8 rounded border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Plano atual</h2>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[sub.status]}`}
              >
                {SUBSCRIPTION_STATUS_LABEL[sub.status]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Info label="Plano" value={sub.plan.label} />
              <Info
                label="Propriedades"
                value={`${sub.farmsUsed}${sub.farmsLimit != null ? ` / ${sub.farmsLimit}` : ' (ilimitado)'}`}
              />
              {isTrial ? (
                <Info label="Teste termina em" value={formatDate(sub.trialEndsAt)} />
              ) : (
                <Info label="Próxima cobrança" value={formatDate(sub.currentPeriodEnd)} />
              )}
              <Info
                label="Mensalidade"
                value={
                  sub.plan.priceBRL != null
                    ? sub.plan.priceBRL.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })
                    : 'Sob consulta'
                }
              />
            </div>

            {sub.status === 'PAST_DUE' && (
              <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Há um pagamento pendente. Renove abaixo para manter o acesso completo.
              </p>
            )}
            {(sub.status === 'CANCELED' || sub.status === 'SUSPENDED') && (
              <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                Sua assinatura não está ativa — o cadastro de novos dados está bloqueado.
                Escolha um plano abaixo para reativar.
              </p>
            )}

            {canCancel && !isTrial && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-sm font-medium text-red-600 hover:underline"
                >
                  Cancelar assinatura
                </button>
              </div>
            )}
          </section>

          {/* Planos */}
          <section>
            <h2 className="mb-3 font-semibold text-gray-800">
              {isTrial ? 'Escolha um plano' : 'Planos disponíveis'}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {PLAN_CARDS.map((p) => {
                const isCurrent = sub.planTier === p.tier;
                return (
                  <div
                    key={p.tier}
                    className={`flex flex-col rounded border p-4 ${
                      isCurrent ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <p className="font-semibold text-green-800">{p.label}</p>
                    <p className="mt-1 text-xl font-bold text-gray-900">{p.priceLabel}</p>
                    <p className="text-xs text-gray-500">{p.farms}</p>
                    <ul className="mt-3 flex-1 space-y-1 text-sm text-gray-600">
                      {p.highlights.map((h) => (
                        <li key={h}>• {h}</li>
                      ))}
                    </ul>
                    <div className="mt-4">
                      {isCurrent && sub.status !== 'CANCELED' && sub.status !== 'SUSPENDED' ? (
                        <span className="block rounded border border-green-600 px-3 py-2 text-center text-sm font-medium text-green-700">
                          Plano atual
                        </span>
                      ) : p.checkout ? (
                        <button
                          type="button"
                          onClick={() => handleCheckout(p.tier)}
                          disabled={busyTier !== null}
                          className="w-full rounded bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
                        >
                          {busyTier === p.tier
                            ? 'Redirecionando...'
                            : isTrial || sub.status === 'CANCELED' || sub.status === 'SUSPENDED'
                              ? 'Assinar'
                              : 'Mudar para este plano'}
                        </button>
                      ) : (
                        <Link
                          href="/suporte"
                          className="block rounded border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Falar com vendas
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Pagamento processado com segurança pelo Stripe. A assinatura só fica ativa
              após a confirmação do pagamento.
            </p>
          </section>
        </>
      )}
    </main>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center">
          <p className="text-gray-500">Carregando...</p>
        </main>
      }
    >
      <SubscriptionContent />
    </Suspense>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 p-2">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 font-semibold text-gray-900">{value}</p>
    </div>
  );
}
