'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { WeatherAlertType, WeatherRecord } from '@/lib/types';

const ALERT_OPTIONS: { value: WeatherAlertType; label: string }[] = [
  { value: 'GEADA', label: 'Geada' },
  { value: 'TEMPESTADE', label: 'Tempestade' },
  { value: 'GRANIZO', label: 'Granizo' },
  { value: 'SECA', label: 'Seca' },
  { value: 'VENTO_FORTE', label: 'Vento forte' },
];

function alertLabel(alertType: WeatherAlertType) {
  return ALERT_OPTIONS.find((opt) => opt.value === alertType)?.label ?? alertType;
}

export default function WeatherPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [latest, setLatest] = useState<WeatherRecord | null>(null);
  const [alerts, setAlerts] = useState<WeatherRecord[]>([]);
  const [history, setHistory] = useState<WeatherRecord[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [temperatureC, setTemperatureC] = useState('');
  const [humidityPercent, setHumidityPercent] = useState('');
  const [windSpeedKmh, setWindSpeedKmh] = useState('');
  const [rainfallMm, setRainfallMm] = useState('');
  const [alertType, setAlertType] = useState<WeatherAlertType | ''>('');
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const base = `/fazendas/${farmId}/clima`;
      const [latestData, alertsData, historyData] = await Promise.all([
        apiFetch<WeatherRecord | null>(`${base}/recente`, { token: accessToken }),
        apiFetch<WeatherRecord[]>(`${base}/alertas`, { token: accessToken }),
        apiFetch<WeatherRecord[]>(base, { token: accessToken }),
      ]);
      setLatest(latestData);
      setAlerts(alertsData);
      setHistory(historyData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar dados climáticos');
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

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/clima`, {
        method: 'POST',
        token: accessToken,
        body: {
          temperatureC: temperatureC ? Number(temperatureC) : undefined,
          humidityPercent: humidityPercent ? Number(humidityPercent) : undefined,
          windSpeedKmh: windSpeedKmh ? Number(windSpeedKmh) : undefined,
          rainfallMm: rainfallMm ? Number(rainfallMm) : undefined,
          alertType: alertType || undefined,
          notes: notes || undefined,
        },
      });
      setTemperatureC('');
      setHumidityPercent('');
      setWindSpeedKmh('');
      setRainfallMm('');
      setAlertType('');
      setNotes('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar condição climática');
    } finally {
      setCreating(false);
    }
  }

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
        <h1 className="text-2xl font-semibold text-green-800">Clima</h1>
        <p className="text-sm text-gray-500">
          Condições registradas manualmente. Integração automática com provedores externos
          (OpenWeather, Tomorrow.io, Climatempo) é uma evolução futura.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {alerts.length > 0 && (
        <div className="mb-8 rounded border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-800">Alertas ativos (7 dias)</h2>
          <ul className="space-y-1 text-sm text-amber-900">
            {alerts.map((a) => (
              <li key={a.id}>
                {alertLabel(a.alertType!)} — {new Date(a.recordedAt).toLocaleDateString('pt-BR')}
                {a.notes ? `: ${a.notes}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Temperatura" value={latest?.temperatureC != null ? `${latest.temperatureC}°C` : '—'} />
        <SummaryCard label="Umidade" value={latest?.humidityPercent != null ? `${latest.humidityPercent}%` : '—'} />
        <SummaryCard label="Vento" value={latest?.windSpeedKmh != null ? `${latest.windSpeedKmh} km/h` : '—'} />
        <SummaryCard label="Chuva" value={latest?.rainfallMm != null ? `${latest.rainfallMm} mm` : '—'} />
      </section>

      <form
        onSubmit={handleCreate}
        className="mb-8 grid grid-cols-2 gap-3 rounded border border-gray-200 bg-white p-4 sm:grid-cols-4"
      >
        <div>
          <label className="text-xs font-medium text-gray-600">Temperatura (°C)</label>
          <input
            type="number"
            step="0.1"
            value={temperatureC}
            onChange={(e) => setTemperatureC(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Umidade (%)</label>
          <input
            type="number"
            step="0.1"
            value={humidityPercent}
            onChange={(e) => setHumidityPercent(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Vento (km/h)</label>
          <input
            type="number"
            step="0.1"
            value={windSpeedKmh}
            onChange={(e) => setWindSpeedKmh(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Chuva (mm)</label>
          <input
            type="number"
            step="0.1"
            value={rainfallMm}
            onChange={(e) => setRainfallMm(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-600">Alerta (opcional)</label>
          <select
            value={alertType}
            onChange={(e) => setAlertType(e.target.value as WeatherAlertType | '')}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          >
            <option value="">Nenhum</option>
            {ALERT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-600">Observações</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
          />
        </div>
        <div className="col-span-full">
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {creating ? 'Salvando...' : 'Registrar condição'}
          </button>
        </div>
      </form>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-800">Histórico</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum registro ainda.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {history.map((h) => (
              <li key={h.id}>
                {new Date(h.recordedAt).toLocaleDateString('pt-BR')} —{' '}
                {h.temperatureC != null ? `${h.temperatureC}°C` : ''}
                {h.rainfallMm != null ? ` · ${h.rainfallMm}mm` : ''}
                {h.alertType ? ` · ⚠ ${alertLabel(h.alertType)}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}
