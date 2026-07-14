'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useConfirm } from '@/lib/confirm-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { AuditLog, AuditLogListResponse } from '@/lib/types';

const METHOD_OPTIONS = ['POST', 'PATCH', 'PUT', 'DELETE'];

function methodBadgeClass(method: string) {
  if (method === 'DELETE') return 'bg-red-50 text-red-700';
  if (method === 'POST') return 'bg-emerald-50 text-emerald-700';
  return 'bg-blue-50 text-blue-700';
}

export default function AdminAuditPage() {
  const { accessToken } = useAuth();
  const confirm = useConfirm();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const load = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (method) params.set('method', method);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      const res = await apiFetch<AuditLogListResponse>(
        `/admin/auditoria?${params.toString()}`,
        { token: accessToken },
      );
      setLogs(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar auditoria');
    } finally {
      setFetching(false);
    }
  }, [accessToken, search, method, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleClear() {
    const ok = await confirm({
      title: 'Limpar auditoria',
      message:
        'Apagar TODO o histórico de auditoria? Esta ação é irreversível. (Botão temporário para limpeza dos dados de teste.)',
      confirmLabel: 'Apagar tudo',
      danger: true,
    });
    if (!ok) return;
    setClearing(true);
    setError(null);
    try {
      await apiFetch('/admin/auditoria', {
        method: 'DELETE',
        token: accessToken,
      });
      setPage(1);
      setSearch('');
      setSearchInput('');
      setMethod('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao limpar auditoria');
    } finally {
      setClearing(false);
    }
  }

  return (
    <main className="animate-fade-up mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Auditoria</h1>
          <p className="text-sm text-gray-500">
            Registro de todas as ações que alteram dados (criação, edição, exclusão) —
            quem fez, o quê e quando.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClear}
          disabled={clearing}
          title="Botão temporário para limpar os dados de teste"
          className="shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
        >
          {clearing ? 'Limpando...' : 'Limpar auditoria'}
        </button>
      </header>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="flex flex-1 gap-2"
        >
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por e-mail do usuário ou caminho (path)"
            className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Buscar
          </button>
        </form>
        <select
          value={method}
          onChange={(e) => {
            setPage(1);
            setMethod(e.target.value);
          }}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
        >
          <option value="">Todos os métodos</option>
          {METHOD_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {fetching ? (
        <p className="text-gray-500">Carregando...</p>
      ) : logs.length === 0 ? (
        <p className="text-gray-500">Nenhum registro encontrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2">Quando</th>
                <th className="py-2">Usuário</th>
                <th className="py-2">Método</th>
                <th className="py-2">Caminho</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100">
                  <td className="py-2 whitespace-nowrap text-gray-500">
                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="py-2 text-gray-700">{log.userEmail ?? '—'}</td>
                  <td className="py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${methodBadgeClass(log.method)}`}
                    >
                      {log.method}
                    </span>
                  </td>
                  <td className="py-2 font-mono text-xs text-gray-600">{log.path}</td>
                  <td className="py-2">
                    <span
                      className={
                        log.statusCode >= 400 ? 'text-red-600' : 'text-gray-600'
                      }
                    >
                      {log.statusCode}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * pageSize >= total}
              className="rounded-lg border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
