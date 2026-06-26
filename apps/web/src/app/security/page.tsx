'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { MfaSetupResponse } from '@/lib/types';

type Step = 'idle' | 'setup' | 'enabled';

export default function SecurityPage() {
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>(user?.mfaEnabled ? 'enabled' : 'idle');
  const [setupData, setSetupData] = useState<MfaSetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(user.mfaEnabled ? 'enabled' : 'idle');
  }, [loading, user, router]);

  async function handleStartSetup() {
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const data = await apiFetch<MfaSetupResponse>('/auth/mfa/setup', {
        method: 'POST',
        token: accessToken,
      });
      setSetupData(data);
      setStep('setup');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao iniciar configuração do MFA');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmEnable(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/auth/mfa/enable', {
        method: 'POST',
        token: accessToken,
        body: { code },
      });
      setStep('enabled');
      setMessage('Autenticação em duas etapas habilitada com sucesso.');
      setCode('');
      setSetupData(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Código inválido');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisable() {
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      await apiFetch('/auth/mfa/disable', { method: 'POST', token: accessToken });
      setStep('idle');
      setMessage('Autenticação em duas etapas desabilitada.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao desabilitar o MFA');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link href="/farms" className="text-sm text-green-700 hover:underline">
        &larr; Voltar
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Segurança da conta</h1>
      <p className="mt-1 text-sm text-gray-500">
        Conectado como {user.name} ({user.email})
      </p>

      <section className="mt-8 rounded border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Autenticação em duas etapas (MFA)</h2>
        <p className="mt-1 text-sm text-gray-600">
          Use um aplicativo autenticador (Google Authenticator, Authy, etc.) para exigir um
          código adicional no login.
        </p>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-3 text-sm text-green-700">{message}</p>}

        {step === 'idle' && (
          <button
            onClick={handleStartSetup}
            disabled={submitting}
            className="mt-4 rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {submitting ? 'Gerando...' : 'Habilitar MFA'}
          </button>
        )}

        {step === 'setup' && setupData && (
          <form onSubmit={handleConfirmEnable} className="mt-4 space-y-4">
            <p className="text-sm text-gray-700">
              Escaneie o QR code abaixo com seu aplicativo autenticador, ou digite o código
              manualmente: <code className="rounded bg-gray-100 px-1 py-0.5">{setupData.secret}</code>
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setupData.qrCodeDataUrl} alt="QR code para configurar o MFA" className="h-48 w-48" />
            <div className="space-y-1">
              <label htmlFor="code" className="text-sm font-medium text-gray-700">
                Digite o código gerado pelo app para confirmar
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {submitting ? 'Confirmando...' : 'Confirmar e habilitar'}
            </button>
          </form>
        )}

        {step === 'enabled' && (
          <button
            onClick={handleDisable}
            disabled={submitting}
            className="mt-4 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? 'Desabilitando...' : 'Desabilitar MFA'}
          </button>
        )}
      </section>
    </div>
  );
}
