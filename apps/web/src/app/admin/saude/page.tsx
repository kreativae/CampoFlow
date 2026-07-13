'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { PlatformHealth } from '@/lib/types';

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}
      aria-label={ok ? 'Operacional' : 'Indisponível'}
    />
  );
}

function ServiceCard({
  title,
  ok,
  children,
}: {
  title: string;
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="mb-2 flex items-center gap-2">
        <StatusDot ok={ok} />
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        <span
          className={`ml-auto rounded-lg px-2 py-0.5 text-xs font-medium ${
            ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {ok ? 'OK' : 'Atenção'}
        </span>
      </div>
      <div className="text-xs text-gray-600">{children}</div>
    </div>
  );
}

function formatAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Agora mesmo';
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export default function AdminSaudePage() {
  const { accessToken } = useAuth();
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PlatformHealth>('/admin/saude', {
        token: accessToken,
      });
      setHealth(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar status');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  if (error || !health) {
    return (
      <main className="animate-fade-up mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      </main>
    );
  }

  const { services, data } = health;
  const allOk =
    services.database.connected &&
    services.email.configured &&
    services.queue.connected &&
    services.mercadoPago.configured;

  return (
    <main className="animate-fade-up mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Saúde da plataforma
          </h1>
          <p className="text-sm text-gray-500">
            Status dos serviços e integrações — tudo no ar num lugar só.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              allOk ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {allOk ? 'Tudo operacional' : 'Atenção necessária'}
          </span>
          <button
            onClick={() => void load()}
            className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            Atualizar
          </button>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Serviços
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <ServiceCard title="Banco de dados" ok={services.database.connected}>
            <p>
              {services.database.connected
                ? `Conectado · Latência ${services.database.latencyMs}ms`
                : 'Sem conexão com o PostgreSQL'}
            </p>
          </ServiceCard>

          <ServiceCard title="E-mail (Resend)" ok={services.email.configured}>
            <p>
              {services.email.configured
                ? 'RESEND_API_KEY configurada'
                : 'RESEND_API_KEY não definida — e-mails serão simulados'}
            </p>
          </ServiceCard>

          <ServiceCard title="Fila (BullMQ / Redis)" ok={services.queue.connected}>
            {services.queue.connected ? (
              <p>
                Conectada · {services.queue.waiting} na espera · {services.queue.active}{' '}
                ativas · {services.queue.failed} com falha
              </p>
            ) : (
              <p>Sem conexão com o Redis</p>
            )}
          </ServiceCard>

          <ServiceCard title="Stripe" ok={services.mercadoPago.configured}>
            <p>
              {services.mercadoPago.configured
                ? 'Secret Key configurada'
                : 'Sem chave — checkout desabilitado'}
            </p>
          </ServiceCard>

          <ServiceCard title="Storage" ok={true}>
            <p>
              Provedor:{' '}
              {services.storage.provider === 'r2'
                ? 'Cloudflare R2'
                : 'Disco local (dev)'}
            </p>
          </ServiceCard>

          <ServiceCard title="Sentry" ok={services.sentry?.configured ?? false}>
            <p>
              {services.sentry?.configured
                ? 'SENTRY_DSN configurado'
                : 'SENTRY_DSN não definido — erros não serão rastreados'}
            </p>
          </ServiceCard>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Dados automatizados
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-1 text-sm font-semibold text-gray-800">
              Cotações
            </h3>
            <p className="text-xs text-gray-600">
              Última busca:{' '}
              <strong>{formatAgo(data.lastQuotationFetch)}</strong>
            </p>
            {data.lastQuotationFetch && (
              <p className="mt-1 text-xs text-gray-400">
                {new Date(data.lastQuotationFetch).toLocaleString('pt-BR')}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-1 text-sm font-semibold text-gray-800">
              Notificações
            </h3>
            <p className="text-xs text-gray-600">
              Última geração:{' '}
              <strong>{formatAgo(data.lastNotificationGeneration)}</strong>
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Cron: {data.notificationSchedule.enabled ? data.notificationSchedule.frequency : 'desabilitado'}
            </p>
          </div>
        </div>
      </section>

      <p className="mt-6 text-right text-xs text-gray-400">
        Verificado em {new Date(health.timestamp).toLocaleString('pt-BR')}
      </p>
    </main>
  );
}
