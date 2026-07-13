'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/auth/redefinir-senha', {
        method: 'POST',
        body: { token, newPassword },
      });
      setDone(true);
      setTimeout(() => router.replace('/entrar'), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao redefinir senha');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-gray-200/80 bg-white shadow-sm p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">CampoFlow</h1>
          <p className="text-sm text-gray-500">Criar nova senha</p>
        </div>

        {!token ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            Link inválido. Solicite um novo link em{' '}
            <Link href="/esqueci-senha" className="font-medium underline">
              Esqueci minha senha
            </Link>
            .
          </p>
        ) : done ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
            Senha redefinida com sucesso. Redirecionando para o login...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <div className="space-y-1">
              <label htmlFor="newPassword" className="text-sm font-medium text-gray-700">
                Nova senha
              </label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={8}
                pattern="(?=.*[A-Za-z])(?=.*\d).+"
                title="Pelo menos 8 caracteres, incluindo letras e números"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              />
              <p className="text-xs text-gray-400">
                Pelo menos 8 caracteres, incluindo letras e números.
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                Confirmar nova senha
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Redefinir senha'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500">
          <Link href="/entrar" className="font-medium text-emerald-700 hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center">
          <p className="text-gray-500">Carregando...</p>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
