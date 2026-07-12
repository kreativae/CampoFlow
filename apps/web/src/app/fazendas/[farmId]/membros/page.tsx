'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { useConfirm } from '@/lib/confirm-context';
import {
  MODULE_OPTIONS,
  type FarmInvite,
  type Member,
  type ModuleKey,
  type Role,
} from '@/lib/types';

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
  const [restrict, setRestrict] = useState(false);
  const [moduleAccess, setModuleAccess] = useState<ModuleKey[]>([]);
  const [saving, setSaving] = useState(false);

  // Estado da edição de acesso de um membro já ativo.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editModules, setEditModules] = useState<ModuleKey[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  function toggle(list: ModuleKey[], key: ModuleKey): ModuleKey[] {
    return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
  }

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
        {
          method: 'POST',
          token: accessToken,
          body: {
            email,
            role,
            // Lista vazia = acesso total; só enviamos restrições quando marcado.
            moduleAccess: restrict ? moduleAccess : [],
          },
        },
      );
      setMessage(
        res && 'invited' in res && res.invited
          ? `Convite enviado para ${email}. Ele aparece em "Convites pendentes" até ser aceito.`
          : `${email} foi adicionado como ${ROLE_LABEL[role]}.`,
      );
      setEmail('');
      setRole('EMPLOYEE');
      setRestrict(false);
      setModuleAccess([]);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao adicionar membro');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(member: Member) {
    setEditingId(member.userId);
    setEditModules(member.moduleAccess);
    setMessage(null);
    setError(null);
  }

  async function handleSaveAccess(member: Member) {
    setEditSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/fazendas/${farmId}/membros/${member.userId}`, {
        method: 'PATCH',
        token: accessToken,
        body: { moduleAccess: editModules },
      });
      setMessage(
        editModules.length === 0
          ? `${member.name} agora tem acesso a todos os módulos.`
          : `Acesso de ${member.name} atualizado.`,
      );
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar acesso');
    } finally {
      setEditSaving(false);
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
    <main className="animate-fade-up mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
      <PageHeader
        icon={UserPlus}
        title="Membros"
        subtitle="Acessos, papéis e convites"
        backHref={`/fazendas/${farmId}`}
      />

      {forbidden ? (
        <p className="rounded-xl border border-gray-200/80 bg-white shadow-sm px-4 py-3 text-sm text-gray-500">
          Apenas o proprietário ou gerente da propriedade pode gerenciar membros.
        </p>
      ) : (
        <>
          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
          )}

          {/* Convidar / adicionar membro */}
          <form
            onSubmit={handleAdd}
            className="mb-8 rounded-xl border border-gray-200/80 bg-white shadow-sm p-4"
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
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Papel</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
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
                  className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50 sm:w-auto"
                >
                  {saving ? 'Enviando...' : 'Convidar'}
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400">{ROLE_HINT[role]}</p>

            {/* Limite de acesso por módulo (opcional) */}
            <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={restrict}
                  onChange={(e) => setRestrict(e.target.checked)}
                  className="h-4 w-4 rounded-lg border-gray-300 text-emerald-700 focus:ring-emerald-600"
                />
                Limitar as páginas que este membro pode acessar
              </label>
              {restrict && (
                <>
                  <p className="mt-2 text-xs text-gray-500">
                    Marque apenas os módulos que o membro poderá abrir. Sem nenhum marcado, ele
                    terá acesso total (conforme o papel).
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                    {MODULE_OPTIONS.map((opt) => (
                      <label
                        key={opt.key}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <input
                          type="checkbox"
                          checked={moduleAccess.includes(opt.key)}
                          onChange={() =>
                            setModuleAccess((prev) => toggle(prev, opt.key))
                          }
                          className="h-4 w-4 rounded-lg border-gray-300 text-emerald-700 focus:ring-emerald-600"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <p className="mt-3 text-xs text-gray-400">
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
                  className="rounded-xl border border-gray-200/80 bg-white shadow-sm px-4 py-3"
                >
                  <div className="flex items-center justify-between">
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
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {ROLE_LABEL[m.role]}
                      </span>
                      {m.userId !== user.id && m.role !== 'OWNER' && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              editingId === m.userId ? setEditingId(null) : startEdit(m)
                            }
                            className="text-sm font-medium text-emerald-700 hover:underline"
                          >
                            {editingId === m.userId ? 'Cancelar' : 'Acesso'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m)}
                            className="text-sm font-medium text-red-600 hover:underline"
                          >
                            Remover
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Resumo do acesso (fora do modo edição) */}
                  {m.role !== 'OWNER' && editingId !== m.userId && (
                    <p className="mt-2 text-xs text-gray-400">
                      {m.moduleAccess.length === 0
                        ? 'Acesso a todos os módulos (conforme o papel).'
                        : `Acesso limitado a: ${m.moduleAccess
                            .map(
                              (k) =>
                                MODULE_OPTIONS.find((o) => o.key === k)?.label ?? k,
                            )
                            .join(', ')}.`}
                    </p>
                  )}

                  {/* Edição de acesso por módulo */}
                  {editingId === m.userId && (
                    <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">
                        Marque os módulos liberados. Sem nenhum marcado, o membro terá acesso
                        total (conforme o papel).
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                        {MODULE_OPTIONS.map((opt) => (
                          <label
                            key={opt.key}
                            className="flex items-center gap-2 text-sm text-gray-700"
                          >
                            <input
                              type="checkbox"
                              checked={editModules.includes(opt.key)}
                              onChange={() =>
                                setEditModules((prev) => toggle(prev, opt.key))
                              }
                              className="h-4 w-4 rounded-lg border-gray-300 text-emerald-700 focus:ring-emerald-600"
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={editSaving}
                          onClick={() => handleSaveAccess(m)}
                          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-800 disabled:opacity-50"
                        >
                          {editSaving ? 'Salvando...' : 'Salvar acesso'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditModules([])}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
                        >
                          Liberar tudo
                        </button>
                      </div>
                    </div>
                  )}
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
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
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
