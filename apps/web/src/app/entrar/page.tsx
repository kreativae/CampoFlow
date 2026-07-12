'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Leaf } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import GoogleLoginButton from '@/components/GoogleLoginButton';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password, mfaRequired ? mfaCode : undefined);
      if (result.mfaRequired) {
        setMfaRequired(true);
        return;
      }
      router.replace('/fazendas');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao entrar');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm transition-colors duration-150 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 disabled:bg-gray-100';

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="animate-fade-up w-full max-w-sm space-y-4 rounded-2xl border border-gray-200/80 bg-white p-8 shadow-sm"
      >
        <div className="space-y-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600">
            <Leaf size={22} strokeWidth={2} className="text-white" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">CampoFlow</h1>
            <p className="text-sm text-gray-500">Entre na sua conta</p>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
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
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-gray-700">
            Senha
          </label>
          <input
            id="password"
            type="password"
            required
            disabled={mfaRequired}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          {!mfaRequired && (
            <p className="text-right">
              <Link
                href="/esqueci-senha"
                className="text-xs font-medium text-emerald-700 hover:underline"
              >
                Esqueci minha senha
              </Link>
            </p>
          )}
        </div>

        {mfaRequired && (
          <div className="space-y-1">
            <label htmlFor="mfaCode" className="text-sm font-medium text-gray-700">
              Código de autenticação (app autenticador)
            </label>
            <input
              id="mfaCode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              className={inputClass}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-emerald-800 active:scale-[0.99] disabled:opacity-50"
        >
          {submitting ? 'Entrando...' : mfaRequired ? 'Confirmar código' : 'Entrar'}
        </button>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          ou
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <GoogleLoginButton />

        <p className="text-center text-sm text-gray-500">
          Não tem conta?{' '}
          <Link href="/cadastrar" className="font-medium text-emerald-700 hover:underline">
            Cadastre-se
          </Link>
        </p>
      </form>
    </main>
  );
}
