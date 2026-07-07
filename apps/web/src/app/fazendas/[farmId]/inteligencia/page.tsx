'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { BiOverview } from '@/lib/types';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

export default function BiPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<BiOverview | null>(null);
  const [fetching, setFetching] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const overview = await apiFetch<BiOverview>(`/fazendas/${farmId}/inteligencia`, { token: accessToken });
      setData(overview);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar indicadores');
      }
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
      <header className="mb-8">
        <Link href={`/fazendas/${farmId}`} className="text-sm text-green-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">IA &amp; Inteligência de Dados</h1>
        <p className="text-sm text-gray-500">
          KPIs calculados a partir de dados reais. Previsões e sugestões usam heurísticas
          estatísticas/baseadas em regras — não há infraestrutura de IA/ML treinada disponível
          neste ambiente.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {forbidden ? (
        <p className="rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
          Seu perfil não tem permissão para visualizar a IA desta propriedade.
        </p>
      ) : data ? (
        <>
          <section className="mb-8">
            <h2 className="mb-3 font-semibold text-gray-800">Indicadores</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard label="Arrobas produzidas" value={`${data.kpis.arrobasProduzidas} @`} />
              <KpiCard label="Custo por arroba" value={formatCurrency(data.kpis.custoPorArroba)} />
              <KpiCard label="Lucro por animal" value={formatCurrency(data.kpis.lucroPorAnimal)} />
              <KpiCard label="ROI" value={formatPercent(data.kpis.roi)} />
              <KpiCard label="Rentabilidade" value={formatPercent(data.kpis.rentabilidade)} />
              <KpiCard label="Receita total" value={formatCurrency(data.kpis.totalReceita)} />
              <KpiCard label="Despesa total" value={formatCurrency(data.kpis.totalDespesa)} />
              <KpiCard label="Lucro" value={formatCurrency(data.kpis.lucro)} />
            </div>
          </section>

          <section className="mb-8 rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-gray-800">
              Previsão de ganho de peso (próximos {data.forecastWeightGain.windowDays} dias)
            </h2>
            <p className="text-sm text-gray-700">
              Ganho médio diário do rebanho: <strong>{data.forecastWeightGain.averageDailyGainKg} kg/dia</strong>{' '}
              ({data.forecastWeightGain.herdSize} animais)
            </p>
            <p className="text-sm text-gray-700">
              Projeção base: <strong>{data.forecastWeightGain.projectedArrobas} @</strong>
            </p>
            {data.forecastWeightGain.weatherRiskActive && (
              <p className="text-sm text-amber-700">
                ⚠ Alerta climático ativo — projeção ajustada para{' '}
                <strong>{data.forecastWeightGain.weatherAdjustedProjectedArrobas} @</strong>
              </p>
            )}
          </section>

          <section className="mb-8 rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-gray-800">Previsão de vendas (próximo mês)</h2>
            <p className="text-sm text-gray-700">
              Receita projetada:{' '}
              <strong>{formatCurrency(data.forecastSales.projectedNextMonthReceita)}</strong>{' '}
              (média dos últimos {data.forecastSales.recentMonths.length} meses)
            </p>
          </section>

          <section className="mb-8 rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-gray-800">Dados de outros módulos</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard
                label="Valor estimado do rebanho"
                value={
                  data.additionalData.valorEstimadoRebanho != null
                    ? formatCurrency(data.additionalData.valorEstimadoRebanho)
                    : '—'
                }
              />
              <KpiCard
                label="Custos com máquinas"
                value={`${formatCurrency(data.additionalData.custosMaquinas)} (${data.additionalData.maquinasCount} máq.)`}
              />
              <KpiCard
                label="Análises de solo"
                value={`${data.additionalData.analisesSoloCount} (${data.additionalData.areasComCalagemPendente} c/ calagem pendente)`}
              />
              <KpiCard label="Documentos cadastrados" value={`${data.additionalData.documentosCount}`} />
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Custos reais de manutenção + combustível das máquinas da fazenda, e contagem de
              análises de solo e documentos cadastrados.
            </p>
          </section>
        </>
      ) : null}
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}
