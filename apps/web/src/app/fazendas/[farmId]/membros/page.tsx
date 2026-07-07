'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useConfirm } from '@/lib/confirm-context';
import type { FarmInvite, Member, Role } from '@/lib/types';

// OWNER não aparece nas opções: é atribuído na criação da fazenda e transferido
// à parte; aqui só se concede papéis operacionais.
const ROLE_OPTIONS: Role[] = ['MANAGER', 'VETERINARIAN', 'EMPLOYEE', 'CONSULTANT'];

const ROLE_LABEL: Record<Role, string> = {
  OWNER: 'Proprietário',
  MANAGER: 'Gerente',
  VETERINARIAN: 'Veterinário',
  EMPLOYEE: 'Funcionário',
  CONSULTANT: 'Consultor',
};

const ROLE_HINT: Record<Role, string> = {
  OWNER: 'Acesso total, dono da propriedade.',
  MANAGER: 'Gerencia rebanho, financeiro e equipe.',
  VETERINARIAN: 'Sanidade, reprodução e pesagens.',
  EMPLOYEE: 'Registros operacionais do dia a dia.',
  CONSULTANT: 'Somente leitura (visualização).',
};

export default function MembersPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<FarmInvite[]>([]);
  const [fetching, setFetching] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const [saving, setSaving] = useState(false);

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
        setError(err instanceof ApiError ? err.message : 'Erro ao carregar os membros');
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loading, user, loadData, router]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch<{ invited?: boolean } | Member>(
        `/fazendas/${farmId}/membros`,
        { method: 'POST', token: accessToken, body: { email, role } },
      );
      setMessage(
        res && 'invited' in res && res.invited
          ? `Convite enviado para ${email}. Ele aparece em "Convites pendentes" até ser aceito.`
          : `${email} foi adicionado como ${ROLE_LABEL[role]}.`,
      );
      setEmail('');
      setRole('EMPLOYEE');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao adicionar membro');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveMember(member: Member) {
    const ok = await confirm({
      title: 'Remover membro',
      message: `Remover ${member.name} (${member.email}) desta propriedade? Ele perde o acesso imediatamente.`,
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/fazendas/${farmId}/membros/${member.userId}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao remover membro');
    }
  }

  async function handleRevokeInvite(invite: FarmInvite) {
    const ok = await confirm({
      title: 'Revogar convite',
      message: `Revogar o convite pendente de ${invite.email}?`,
      confirmLabel: 'Revogar',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/fazendas/${farmId}/convites/${invite.id}`, {
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

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href={`/fazendas/${farmId}`} className="text-sm text-green-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-green-800">Membros da propriedade</h1>
        <p className="text-sm text-gray-500">
          Convide pessoas e defina o papel de cada uma. O acesso a cada módulo é controlado pelo
          papel.
        </p>
      </header>

      {forbidden ? (
        <p className="rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
          Apenas o proprietário ou gerente da propriedade pode gerenciar membros.
        </p>
      ) : (
        <>
          {error && (
            <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
          )}

          {/* Convidar / adicionar membro */}
          <form
            onSubmit={handleAdd}
            className="mb-8 rounded border border-gray-200 bg-white p-4"
          >
            <h2 className="mb-3 font-semibold text-gray-800">Convidar membro</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px_auto]">
              <div>
                <label className="text-xs font-medium text-gray-600">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pessoa@exemplo.com"
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Papel</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 sm:w-auto"
                >
                  {saving ? 'Enviando...' : 'Convidar'}
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400">{ROLE_HINT[role]}</p>
            <p className="mt-1 text-xs text-gray-400">
              Se a pessoa já tem conta no CampoFlow, o acesso é concedido na hora. Caso contrário,
              ela recebe um convite por e-mail para criar a conta e aceitar.
            </p>
          </form>

          {/* Membros ativos */}
          <section className="mb-8">
            <h2 className="mb-3 font-semibold text-gray-800">
              Membros ativos ({members.length})
            </h2>
            <ul className="space-y-2">
              {members.map((m) => (
                <li
                  key={m.userId}
                  className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {m.name}
                      {m.userId === user.id && (
                        <span className="ml-2 text-xs text-gray-400">(você)</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        m.role === 'OWNER'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {ROLE_LABEL[m.role]}
                    </span>
                    {m.userId !== user.id && m.role !== 'OWNER' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m)}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Convites pendentes */}
          <section>
            <h2 className="mb-3 font-semibold text-gray-800">
              Convites pendentes ({invites.length})
            </h2>
            {invites.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum convite pendente.</p>
            ) : (
              <ul className="space-y-2">
                {invites.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between rounded border border-amber-200 bg-amber-50 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{inv.email}</p>
                      <p className="text-xs text-gray-500">
                        {ROLE_LABEL[inv.role]} · expira em{' '}
                        {new Date(inv.expiresAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokeInvite(inv)}
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      Revogar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
