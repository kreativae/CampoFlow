'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/lib/auth-context';
import { apiDownload, ApiError } from '@/lib/api';

type ReportType = 'rebanho' | 'financeiro' | 'sanidade' | 'reproducao' | 'custos';
type ReportFormat = 'csv' | 'xlsx' | 'pdf';

const TYPE_OPTIONS: { value: ReportType; label: string }[] = [
  { value: 'rebanho', label: 'Rebanho' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'sanidade', label: 'Sanidade' },
  { value: 'reproducao', label: 'Reprodução' },
  { value: 'custos', label: 'Custos' },
];

const FORMAT_OPTIONS: { value: ReportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel (XLSX)' },
  { value: 'pdf', label: 'PDF' },
];

export default function ReportsPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [type, setType] = useState<ReportType>('rebanho');
  const [format, setFormat] = useState<ReportFormat>('csv');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
    }
  }, [loading, user, router]);

  async function handleDownload(reportType: ReportType, reportFormat: ReportFormat) {
    const key = `${reportType}-${reportFormat}`;
    setDownloading(key);
    setError(null);
    try {
      await apiDownload(
        `/fazendas/${farmId}/relatorios/${reportType}?format=${reportFormat}`,
        `${reportType}.${reportFormat}`,
        accessToken,
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Erro ao gerar relatório. Verifique se seu perfil tem permissão (Proprietário/Gerente).',
      );
    } finally {
      setDownloading(null);
    }
  }

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="animate-fade-up mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
      <PageHeader
        icon={BarChart3}
        title="Relatórios"
        subtitle="Exportação de dados gerenciais"
        backHref={`/fazendas/${farmId}`}
      />

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4">
        <div>
          <label className="text-xs font-medium text-gray-600">Relatório</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ReportType)}
            className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Formato</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ReportFormat)}
            className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          >
            {FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => handleDownload(type, format)}
          disabled={downloading === `${type}-${format}`}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
        >
          {downloading === `${type}-${format}` ? 'Gerando...' : 'Baixar relatório'}
        </button>
      </div>

      <ul className="space-y-2">
        {TYPE_OPTIONS.map((opt) => (
          <li
            key={opt.value}
            className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white shadow-sm px-4 py-3"
          >
            <span className="font-medium text-gray-900">{opt.label}</span>
            <div className="flex gap-3">
              {FORMAT_OPTIONS.map((fmt) => (
                <button
                  key={fmt.value}
                  onClick={() => handleDownload(opt.value, fmt.value)}
                  disabled={downloading === `${opt.value}-${fmt.value}`}
                  className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
                >
                  {downloading === `${opt.value}-${fmt.value}` ? '...' : fmt.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
