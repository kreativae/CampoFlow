'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
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
      const data = await apiFetch<ReproductionStats>(`/fazendas/${farmId}/reproducao/estatisticas`, {
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
    <main className="animate-fade-up mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
      <PageHeader
        icon={Heart}
        title="Reprodução"
        subtitle="Eventos e estatísticas reprodutivas"
        backHref={`/fazendas/${farmId}`}
      />

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
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
    <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
