'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { user, accessToken, loading } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleAccept() {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/convites/aceitar', {
        method: 'POST',
        token: accessToken,
        body: { token },
      });
      setDone(true);
      setTimeout(() => router.replace('/fazendas'), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao aceitar convite');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Carregando...</p>;
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-gray-200/80 bg-white shadow-sm p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">CampoFlow</h1>
          <p className="text-sm text-gray-500">Convite para colaborar</p>
        </div>

        {!token ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            Link de convite inválido.
          </p>
        ) : done ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
            Convite aceito! Redirecionando...
          </p>
        ) : !user ? (
          <>
            <p className="text-sm text-gray-500">
              Entre ou crie uma conta com o e-mail para o qual o convite foi enviado e depois
              volte a este link para aceitar.
            </p>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Link
                href="/entrar"
                className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-center text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800"
              >
                Entrar
              </Link>
              <Link
                href="/cadastrar"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cadastrar-se
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              Você está conectado como <strong>{user.email}</strong>. Clique abaixo para aceitar
              o convite com esta conta.
            </p>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <button
              onClick={handleAccept}
              disabled={submitting}
              className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
            >
              {submitting ? 'Aceitando...' : 'Aceitar convite'}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center">
          <p className="text-gray-500">Carregando...</p>
        </main>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
