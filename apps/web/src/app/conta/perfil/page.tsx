'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { User } from '@/lib/types';

export default function ProfilePage() {
  const { user, accessToken, loading, refreshUser } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    setName(user.name);
    setEmail(user.email);
  }, [loading, user, router]);

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<User>('/auth/me', {
        method: 'PATCH',
        token: accessToken,
        body: { name, email },
      });
      setMessage('Perfil atualizado com sucesso.');
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar perfil');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem.');
      return;
    }
    setSavingPassword(true);
    setPasswordError(null);
    setPasswordMessage(null);
    try {
      await apiFetch('/auth/me/alterar-senha', {
        method: 'POST',
        token: accessToken,
        body: { currentPassword, newPassword },
      });
      setPasswordMessage('Senha alterada com sucesso.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(
        err instanceof ApiError ? err.message : 'Erro ao alterar senha',
      );
    } finally {
      setSavingPassword(false);
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
    <main className="animate-fade-up mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <Link href="/fazendas" className="mb-6 inline-block text-sm text-emerald-700 hover:underline">
        ← Voltar
      </Link>

      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Meu perfil</h1>

      {/* Dados pessoais */}
      <section className="mb-8 rounded-lg border border-gray-200 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Dados pessoais
        </h2>

        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {message && (
          <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </section>

      {/* Alterar senha */}
      <section className="rounded-lg border border-gray-200 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Alterar senha
        </h2>

        {passwordError && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {passwordError}
          </p>
        )}
        {passwordMessage && (
          <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {passwordMessage}
          </p>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500">Senha atual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Nova senha</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
            <p className="mt-1 text-xs text-gray-400">Mínimo 8 caracteres, com letras e números</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Confirmar nova senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs transition-all duration-150 hover:border-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
          >
            {savingPassword ? 'Alterando...' : 'Alterar senha'}
          </button>
        </form>
      </section>
    </main>
  );
}
