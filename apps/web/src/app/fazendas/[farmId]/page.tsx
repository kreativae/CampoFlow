'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  Calendar,
  FileText,
  Gauge,
  Heart,
  Map,
  Package,
  Scale,
  Sparkles,
  Sprout,
  Tractor,
  TrendingUp,
  TriangleAlert,
  Users,
  Wallet,
  Beef,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { DashboardFullOverview, DashboardOverview, Farm } from '@/lib/types';

export default function FarmDashboardPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
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

  const alerts = dashboard?.pendingAlerts ?? [];
  const overdueCount = alerts.filter((a) => a.overdue).length;

  return (
    <main className="animate-fade-up mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {farm?.name ?? 'Propriedade'}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Visão geral da propriedade</p>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {!dashboard ? (
        <p className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
          Seu perfil não tem permissão para visualizar o dashboard desta propriedade.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Total de animais"
              value={dashboard.totalAnimals.toLocaleString('pt-BR')}
              icon={Beef}
            />
            <MetricCard
              label="Peso médio"
              value={dashboard.averageWeightKg.toLocaleString('pt-BR', {
                maximumFractionDigits: 1,
              })}
              unit="kg"
              icon={Scale}
            />
            <MetricCard
              label="Ganho médio diário"
              value={dashboard.averageDailyGainKg.toLocaleString('pt-BR', {
                maximumFractionDigits: 2,
              })}
              unit="kg/dia"
              icon={TrendingUp}
            />
            <MetricCard
              label="Taxa de lotação"
              value={(dashboard.stockingRate.occupancyRate * 100).toFixed(0)}
              unit="%"
              icon={Gauge}
              footer={`${dashboard.stockingRate.occupiedHeadCount} de ${dashboard.stockingRate.totalCapacity} cabeças`}
            />
            <MetricCard
              label="Saldo do mês"
              value={dashboard.currentMonthFinance.saldo.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
              icon={Wallet}
              tone={dashboard.currentMonthFinance.saldo >= 0 ? 'positive' : 'negative'}
              footer={`${dashboard.currentMonthFinance.receita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} receita · ${dashboard.currentMonthFinance.despesa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} despesa`}
            />
            <MetricCard
              label="Alertas pendentes"
              value={alerts.length}
              icon={TriangleAlert}
              tone={alerts.length > 0 ? 'warning' : undefined}
              footer={
                overdueCount > 0 ? `${overdueCount} vacinação(ões) vencida(s)` : 'Tudo em dia'
              }
            />
          </div>

          {alerts.length > 0 && (
            <div className="mt-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center">
              <TriangleAlert size={18} strokeWidth={2} className="shrink-0 text-amber-600" />
              <p className="min-w-0 flex-1 text-sm text-amber-900">
                <span className="font-semibold">Vacinações pendentes: </span>
                {alerts
                  .map(
                    (a) => `${a.animalEarTag} ${a.vaccineName} ${a.overdue ? '(vencida)' : '(a vencer)'}`,
                  )
                  .join(' · ')}
              </p>
              <Link
                href={`/fazendas/${farmId}/animais`}
                className="shrink-0 text-sm font-semibold text-amber-800 transition-colors hover:text-amber-950"
              >
                Resolver →
              </Link>
            </div>
          )}
        </>
      )}

      {resumo && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-gray-900">Resumo geral</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryCard
              title="Reprodução"
              href={`/fazendas/${farmId}/reproducao`}
              icon={Heart}
              text={`Prenhez ${(resumo.reproduction.pregnancyRate * 100).toFixed(0)}% · Concepção ${(resumo.reproduction.conceptionRate * 100).toFixed(0)}%`}
            />
            <SummaryCard
              title="Insumos"
              href={`/fazendas/${farmId}/insumos`}
              icon={Package}
              text={`${resumo.supplies.total} itens · ${resumo.supplies.alertsCount} em estoque baixo`}
              badge={resumo.supplies.alertsCount > 0 ? `${resumo.supplies.alertsCount} alertas` : undefined}
            />
            <SummaryCard
              title="Máquinas"
              href={`/fazendas/${farmId}/maquinas`}
              icon={Tractor}
              text={`${resumo.machines.total} cadastrada(s)`}
            />
            <SummaryCard
              title="Equipe"
              href={`/fazendas/${farmId}/equipe`}
              icon={Users}
              text={`${resumo.employees.employeeCount} funcionário(s) · ${resumo.employees.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
            />
            <SummaryCard
              title="Agenda"
              href={`/fazendas/${farmId}/agenda`}
              icon={Calendar}
              text={`${resumo.agenda.upcomingCount} evento(s) próximos ou atrasados`}
              badge={resumo.agenda.upcomingCount > 0 ? String(resumo.agenda.upcomingCount) : undefined}
            />
            <SummaryCard
              title="Mapa e Solo"
              href={`/fazendas/${farmId}/mapa`}
              icon={Map}
              text={`${resumo.map.featuresCount} elementos · ${resumo.map.soilAnalysesCount} análises`}
            />
            <SummaryCard
              title="Safras"
              href={`/fazendas/${farmId}/safras`}
              icon={Sprout}
              text={`${resumo.crops.total} safras · ${resumo.crops.activeCount} em andamento`}
            />
            <SummaryCard
              title="Documentos"
              href={`/fazendas/${farmId}/documentos`}
              icon={FileText}
              text={`${resumo.documents.total} arquivo(s)`}
            />
            <SummaryCard
              title="Notificações"
              href={`/fazendas/${farmId}/notificacoes`}
              icon={Bell}
              text={`${resumo.notifications.unreadCount} não lida(s)`}
              badge={
                resumo.notifications.unreadCount > 0
                  ? String(resumo.notifications.unreadCount)
                  : undefined
              }
            />
            <SummaryCard
              title="Relatórios"
              href={`/fazendas/${farmId}/relatorios`}
              icon={BarChart3}
              text="Exportação de dados gerenciais"
            />
            <SummaryCard
              title="Inteligência"
              href={`/fazendas/${farmId}/inteligencia`}
              icon={Sparkles}
              text="Análises e recomendações IA"
            />
          </div>
        </section>
      )}
    </main>
  );
}

function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  tone,
  footer,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  tone?: 'positive' | 'negative' | 'warning';
  footer?: string;
}) {
  const valueColor =
    tone === 'positive'
      ? 'text-emerald-700'
      : tone === 'negative'
        ? 'text-red-600'
        : tone === 'warning'
          ? 'text-amber-600'
          : 'text-gray-900';
  const chipColor =
    tone === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-700';

  return (
    <div className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${chipColor}`}>
          <Icon size={16} strokeWidth={2} />
        </span>
      </div>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${valueColor}`}>
        {value}
        {unit && <span className="ml-1 text-base font-normal text-gray-400">{unit}</span>}
      </p>
      {footer && <p className="mt-2 truncate text-xs text-gray-500">{footer}</p>}
    </div>
  );
}

function SummaryCard({
  title,
  href,
  icon: Icon,
  text,
  badge,
}: {
  title: string;
  href: string;
  icon: LucideIcon;
  text: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3.5 rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 transition-colors duration-200 group-hover:bg-emerald-100">
        <Icon size={18} strokeWidth={1.9} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">{title}</span>
          {badge && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-sm text-gray-500">{text}</span>
      </span>
    </Link>
  );
}
