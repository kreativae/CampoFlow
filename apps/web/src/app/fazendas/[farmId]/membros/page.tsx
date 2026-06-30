'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { FarmInvite, Member, Role } from '@/lib/types';

const ROLE_OPTIONS: Role[] = ['MANAGER', 'VETERINARIAN', 'EMPLOYEE', 'CONSULTANT'];

const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Proprietário',
  MANAGER: 'Gerente',
  VETERINARIAN: 'Veterinário',
  EMPLOYEE: 'Funcionário',
  CONSULTANT: 'Consultor',
};

export default function MembersPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<FarmInvite[]>([]);
  const [fetching, setFetching] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [lastInviteSent, setLastInviteSent] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [membersData, invitesData] = await Promise.all([
        apiFetch<Member[]>(`/fazendas/${farmId}/membros`, { token: accessToken }),
        apiFetch<FarmInvite[]>(`/fazendas/${farmId}/convites`, { token: accessToken }),
      ]);
      setMembers(membersData);
      setInvites(invitesData);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar membros');
      }
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

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setInviting(true);
    setError(null);
    setLastInviteSent(null);
    try {
      const result = await apiFetch<{ invited?: boolean; email?: string }>(
        `/fazendas/${farmId}/membros`,
        {
          method: 'POST',
          token: accessToken,
          body: { email, role },
        },
      );
      if (result?.invited) {
        setLastInviteSent(email);
      }
      setEmail('');
      setRole('EMPLOYEE');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao adicionar membro');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(userId: string) {
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/membros/${userId}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao remover membro');
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/convites/${inviteId}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao revogar convite');
    }
  }

  if (loading || !user || fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  const currentUserIsOwner = members.some((m) => m.email === user.email && m.role === 'OWNER');

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8">
        <Link href={`/fazendas/${farmId}`} className="text-sm text-green-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">Membros</h1>
      </header>

      {error && (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {lastInviteSent && (
        <p className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          Convite enviado para {lastInviteSent}. A pessoa precisa criar uma conta (ou entrar, se
          já tiver) com esse mesmo e-mail para aceitar.
        </p>
      )}

      {forbidden ? (
        <p className="rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
          Seu perfil não tem permissão para gerenciar a equipe desta propriedade.
        </p>
      ) : (
        <>
          <form
            onSubmit={handleInvite}
            className="mb-8 flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-white p-4"
          >
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600">
                E-mail (se a pessoa ainda não tiver conta, receberá um convite por e-mail)
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Papel</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="mt-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {ROLE_LABELS[opt]}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={inviting}
              className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {inviting ? 'Adicionando...' : 'Adicionar membro'}
            </button>
          </form>

          <ul className="space-y-2">
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900">{m.name}</p>
                  <p className="text-sm text-gray-500">
                    {m.email} · {ROLE_LABELS[m.role]}
                  </p>
                </div>
                {currentUserIsOwner && m.email !== user.email && (
                  <button
                    onClick={() => handleRemove(m.userId)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Remover
                  </button>
                )}
              </li>
            ))}
          </ul>

          {invites.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 font-semibold text-gray-800">Convites pendentes</h2>
              <ul className="space-y-2">
                {invites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex items-center justify-between rounded border border-amber-200 bg-amber-50 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{invite.email}</p>
                      <p className="text-sm text-gray-500">
                        {ROLE_LABELS[invite.role]} · expira em{' '}
                        {new Date(invite.expiresAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevokeInvite(invite.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Revogar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </main>
  );
}
