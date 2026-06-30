'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { DashboardFullOverview, DashboardOverview, Farm } from '@/lib/types';

export default function FarmDashboardPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading, logout } = useAuth();
  const router = useRouter();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [dashboard, setDashboard] = useState<DashboardOverview | null>(null);
  const [resumo, setResumo] = useState<DashboardFullOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const farmData = await apiFetch<Farm>(`/fazendas/${farmId}`, { token: accessToken });
      setFarm(farmData);
      try {
        const [dashboardData, resumoData] = await Promise.all([
          apiFetch<DashboardOverview>(`/fazendas/${farmId}/painel`, { token: accessToken }),
          apiFetch<DashboardFullOverview>(`/fazendas/${farmId}/painel/resumo`, {
            token: accessToken,
          }),
        ]);
        setDashboard(dashboardData);
        setResumo(resumoData);
      } catch (dashboardErr) {
        if (dashboardErr instanceof ApiError && dashboardErr.status === 403) {
          setDashboard(null);
          setResumo(null);
        } else {
          throw dashboardErr;
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar dados da propriedade');
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

  if (loading || !user || fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/fazendas" className="text-sm text-green-700 hover:underline">
            ← Propriedades
          </Link>
          <h1 className="text-2xl font-semibold text-green-800">{farm?.name ?? 'Propriedade'}</h1>
        </div>
        <button onClick={logout} className="text-sm font-medium text-gray-600 hover:text-gray-900">
          Sair
        </button>
      </header>

      <nav className="mb-8 flex gap-4 border-b border-gray-200 pb-2 text-sm">
        <Link href={`/fazendas/${farmId}/animais`} className="font-medium text-green-700 hover:underline">
          Rebanho
        </Link>
        <Link href={`/fazendas/${farmId}/pastagens`} className="font-medium text-green-700 hover:underline">
          Pastagens
        </Link>
        <Link href={`/fazendas/${farmId}/reproducao`} className="font-medium text-green-700 hover:underline">
          Reprodução
        </Link>
        <Link href={`/fazendas/${farmId}/insumos`} className="font-medium text-green-700 hover:underline">
          Insumos
        </Link>
        <Link href={`/fazendas/${farmId}/maquinas`} className="font-medium text-green-700 hover:underline">
          Máquinas
        </Link>
        <Link href={`/fazendas/${farmId}/equipe`} className="font-medium text-green-700 hover:underline">
          Equipe
        </Link>
        <Link href={`/fazendas/${farmId}/agenda`} className="font-medium text-green-700 hover:underline">
          Agenda
        </Link>
        <Link href={`/fazendas/${farmId}/mapa`} className="font-medium text-green-700 hover:underline">
          Solo
        </Link>
        <Link href={`/fazendas/${farmId}/safras`} className="font-medium text-green-700 hover:underline">
          Safras
        </Link>
        <Link href={`/fazendas/${farmId}/documentos`} className="font-medium text-green-700 hover:underline">
          Documentos
        </Link>
        <Link href={`/fazendas/${farmId}/relatorios`} className="font-medium text-green-700 hover:underline">
          Relatórios
        </Link>
        <Link href={`/fazendas/${farmId}/inteligencia`} className="font-medium text-green-700 hover:underline">
          IA
        </Link>
        <Link
          href={`/fazendas/${farmId}/notificacoes`}
          className="font-medium text-green-700 hover:underline"
        >
          Notificações
        </Link>
        <Link href={`/fazendas/${farmId}/financeiro`} className="font-medium text-green-700 hover:underline">
          Financeiro
        </Link>
        <Link href={`/fazendas/${farmId}/membros`} className="font-medium text-green-700 hover:underline">
          Membros
        </Link>
      </nav>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {!dashboard ? (
        <p className="rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
          Seu perfil não tem permissão para visualizar o dashboard desta propriedade.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card label="Total de animais" value={dashboard.totalAnimals} />
          <Card label="Peso médio (kg)" value={dashboard.averageWeightKg} />
          <Card label="Ganho diário médio (kg)" value={dashboard.averageDailyGainKg} />
          <Card
            label="Taxa de lotação"
            value={`${(dashboard.stockingRate.occupancyRate * 100).toFixed(0)}%`}
          />
          <Card label="Saldo do mês (R$)" value={dashboard.currentMonthFinance.saldo} />
          <Card label="Alertas pendentes" value={dashboard.pendingAlerts.length} />

          {dashboard.pendingAlerts.length > 0 && (
            <div className="col-span-full rounded border border-amber-200 bg-amber-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-amber-800">
                Vacinações pendentes
              </h2>
              <ul className="space-y-1 text-sm text-amber-900">
                {dashboard.pendingAlerts.map((alert) => (
                  <li key={alert.id}>
                    {alert.animalEarTag} — {alert.vaccineName}{' '}
                    {alert.overdue ? '(vencida)' : '(a vencer)'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {resumo && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Resumo geral</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryCard
              title="Reprodução"
              href={`/fazendas/${farmId}/reproducao`}
              lines={[
                `Taxa de prenhez: ${(resumo.reproduction.pregnancyRate * 100).toFixed(0)}%`,
                `Taxa de concepção: ${(resumo.reproduction.conceptionRate * 100).toFixed(0)}%`,
              ]}
            />
            <SummaryCard
              title="Clima"
              href={`/fazendas/${farmId}/mapa`}
              lines={[
                `Alertas ativos: ${resumo.weather.activeAlertsCount}`,
                resumo.weather.latestAlert
                  ? `Último: ${resumo.weather.latestAlert.alertType}`
                  : 'Sem alertas recentes',
              ]}
              highlight={resumo.weather.activeAlertsCount > 0}
            />
            <SummaryCard
              title="Insumos"
              href={`/fazendas/${farmId}/insumos`}
              lines={[
                `${resumo.supplies.total} cadastrado(s)`,
                `${resumo.supplies.alertsCount} em alerta`,
              ]}
              highlight={resumo.supplies.alertsCount > 0}
            />
            <SummaryCard
              title="Máquinas"
              href={`/fazendas/${farmId}/maquinas`}
              lines={[`${resumo.machines.total} cadastrada(s)`]}
            />
            <SummaryCard
              title="Equipe"
              href={`/fazendas/${farmId}/equipe`}
              lines={[
                `${resumo.tasks.total} tarefa(s)`,
                `${resumo.tasks.openCount} em aberto`,
              ]}
            />
            <SummaryCard
              title="Agenda"
              href={`/fazendas/${farmId}/agenda`}
              lines={[`${resumo.agenda.upcomingCount} próximo(s)/atrasado(s)`]}
              highlight={resumo.agenda.upcomingCount > 0}
            />
            <SummaryCard
              title="Solo"
              href={`/fazendas/${farmId}/mapa`}
              lines={[
                `${resumo.map.featuresCount} elemento(s)`,
                `${resumo.map.soilAnalysesCount} análise(s) de solo`,
              ]}
            />
            <SummaryCard
              title="Safras"
              href={`/fazendas/${farmId}/safras`}
              lines={[
                `${resumo.crops.total} safra(s)`,
                `${resumo.crops.activeCount} em andamento`,
              ]}
            />
            <SummaryCard
              title="Documentos"
              href={`/fazendas/${farmId}/documentos`}
              lines={[`${resumo.documents.total} arquivo(s)`]}
            />
            <SummaryCard
              title="Notificações"
              href={`/fazendas/${farmId}/notificacoes`}
              lines={[`${resumo.notifications.unreadCount} não lida(s)`]}
              highlight={resumo.notifications.unreadCount > 0}
            />
            <SummaryCard
              title="Membros"
              href={`/fazendas/${farmId}/membros`}
              lines={[`${resumo.members.total} membro(s)`]}
            />
            <SummaryCard
              title="Relatórios"
              href={`/fazendas/${farmId}/relatorios`}
              lines={['Exportação de dados gerenciais']}
            />
            <SummaryCard
              title="IA / Inteligência"
              href={`/fazendas/${farmId}/inteligencia`}
              lines={['KPIs, previsões e sugestões']}
            />
            <SummaryCard
              title="Cotações"
              href="/cotacoes"
              lines={
                resumo.quotations.length > 0
                  ? resumo.quotations.map(
                      (q) => `${q.commodity}: ${q.price} ${q.unit}`,
                    )
                  : ['Nenhuma cotação registrada']
              }
            />
          </div>
        </section>
      )}
    </main>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function SummaryCard({
  title,
  href,
  lines,
  highlight,
}: {
  title: string;
  href: string;
  lines: string[];
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded border p-4 transition hover:shadow-sm ${
        highlight ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
      }`}
    >
      <p className="font-semibold text-green-800">{title}</p>
      <ul className="mt-1 space-y-0.5 text-sm text-gray-600">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </Link>
  );
}
