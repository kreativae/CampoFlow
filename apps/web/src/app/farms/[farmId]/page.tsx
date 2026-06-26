'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { DashboardOverview, Farm } from '@/lib/types';

export default function FarmDashboardPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading, logout } = useAuth();
  const router = useRouter();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [dashboard, setDashboard] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const farmData = await apiFetch<Farm>(`/farms/${farmId}`, { token: accessToken });
      setFarm(farmData);
      try {
        const dashboardData = await apiFetch<DashboardOverview>(`/farms/${farmId}/dashboard`, {
          token: accessToken,
        });
        setDashboard(dashboardData);
      } catch (dashboardErr) {
        if (dashboardErr instanceof ApiError && dashboardErr.status === 403) {
          setDashboard(null);
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
      router.replace('/login');
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
          <Link href="/farms" className="text-sm text-green-700 hover:underline">
            ← Propriedades
          </Link>
          <h1 className="text-2xl font-semibold text-green-800">{farm?.name ?? 'Propriedade'}</h1>
        </div>
        <button onClick={logout} className="text-sm font-medium text-gray-600 hover:text-gray-900">
          Sair
        </button>
      </header>

      <nav className="mb-8 flex gap-4 border-b border-gray-200 pb-2 text-sm">
        <Link href={`/farms/${farmId}/animals`} className="font-medium text-green-700 hover:underline">
          Rebanho
        </Link>
        <Link href={`/farms/${farmId}/pastures`} className="font-medium text-green-700 hover:underline">
          Pastagens
        </Link>
        <Link href={`/farms/${farmId}/reproduction`} className="font-medium text-green-700 hover:underline">
          Reprodução
        </Link>
        <Link href={`/farms/${farmId}/weather`} className="font-medium text-green-700 hover:underline">
          Clima
        </Link>
        <Link href={`/farms/${farmId}/supplies`} className="font-medium text-green-700 hover:underline">
          Insumos
        </Link>
        <Link href={`/farms/${farmId}/machines`} className="font-medium text-green-700 hover:underline">
          Máquinas
        </Link>
        <Link href={`/farms/${farmId}/team`} className="font-medium text-green-700 hover:underline">
          Equipe
        </Link>
        <Link href={`/farms/${farmId}/finance`} className="font-medium text-green-700 hover:underline">
          Financeiro
        </Link>
        <Link href={`/farms/${farmId}/members`} className="font-medium text-green-700 hover:underline">
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
