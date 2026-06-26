'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
      router.replace('/login');
    }
  }, [loading, user, router]);

  async function handleDownload(reportType: ReportType, reportFormat: ReportFormat) {
    const key = `${reportType}-${reportFormat}`;
    setDownloading(key);
    setError(null);
    try {
      await apiDownload(
        `/farms/${farmId}/reports/${reportType}?format=${reportFormat}`,
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8">
        <Link href={`/farms/${farmId}`} className="text-sm text-green-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">Relatórios</h1>
        <p className="text-sm text-gray-500">
          Exportação de dados gerenciais em CSV, Excel ou PDF. Restrito a Proprietário/Gerente.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="mb-8 flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-white p-4">
        <div>
          <label className="text-xs font-medium text-gray-600">Relatório</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ReportType)}
            className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
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
            className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
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
          className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {downloading === `${type}-${format}` ? 'Gerando...' : 'Baixar relatório'}
        </button>
      </div>

      <ul className="space-y-2">
        {TYPE_OPTIONS.map((opt) => (
          <li
            key={opt.value}
            className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3"
          >
            <span className="font-medium text-gray-900">{opt.label}</span>
            <div className="flex gap-3">
              {FORMAT_OPTIONS.map((fmt) => (
                <button
                  key={fmt.value}
                  onClick={() => handleDownload(opt.value, fmt.value)}
                  disabled={downloading === `${opt.value}-${fmt.value}`}
                  className="text-xs font-medium text-green-700 hover:underline disabled:opacity-50"
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
