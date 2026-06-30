'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/auth/esqueci-senha', {
        method: 'POST',
        body: { email },
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao solicitar redefinição de senha');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-green-800">CampoFlow</h1>
          <p className="text-sm text-gray-500">Esqueci minha senha</p>
        </div>

        {sent ? (
          <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
            Se o e-mail informado estiver cadastrado, você receberá instruções para redefinir
            a senha em breve.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-500">
              Informe o e-mail da sua conta e enviaremos um link para você criar uma nova senha.
            </p>

            {error && (
              <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {submitting ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500">
          <Link href="/entrar" className="font-medium text-green-700 hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </main>
  );
}
