'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { ReproductionStats } from '@/lib/types';

function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

export default function ReproductionStatsPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<ReproductionStats | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<ReproductionStats>(`/farms/${farmId}/reproduction/stats`, {
        token: accessToken,
      });
      setStats(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar estatísticas');
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
      <header className="mb-8">
        <Link href={`/farms/${farmId}`} className="text-sm text-green-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">Reprodução</h1>
        <p className="text-sm text-gray-500">
          Indicadores agregados da propriedade. Eventos individuais são registrados na página de
          cada animal, no <Link href={`/farms/${farmId}/animals`} className="text-green-700 hover:underline">rebanho</Link>.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {stats && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SummaryCard label="Eventos de monta/IATF" value={String(stats.breedingEvents)} />
          <SummaryCard label="Diagnósticos de prenhez" value={String(stats.pregnancyDiagnoses)} />
          <SummaryCard label="Confirmadas prenhas" value={String(stats.confirmedPregnant)} />
          <SummaryCard label="Taxa de concepção" value={formatPercent(stats.conceptionRate)} />
          <SummaryCard label="Taxa de prenhez" value={formatPercent(stats.pregnancyRate)} />
          <SummaryCard label="Nascimentos" value={String(stats.births)} />
          <SummaryCard label="Abortos" value={String(stats.abortions)} />
        </section>
      )}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
