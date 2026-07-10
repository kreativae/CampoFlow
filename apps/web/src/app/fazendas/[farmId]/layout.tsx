'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import type { Farm, ModuleKey } from '@/lib/types';

interface NavItem {
  suffix: string; // caminho depois de /fazendas/:id
  label: string;
  module?: ModuleKey; // módulo controlável; ausente = sempre visível (ex.: Painel)
}

const NAV: NavItem[] = [
  { suffix: '', label: 'Painel' },
  { suffix: '/animais', label: 'Rebanho', module: 'rebanho' },
  { suffix: '/pastagens', label: 'Pastagens', module: 'pastagens' },
  { suffix: '/reproducao', label: 'Reprodução', module: 'reproducao' },
  { suffix: '/insumos', label: 'Insumos', module: 'insumos' },
  { suffix: '/maquinas', label: 'Máquinas', module: 'maquinas' },
  { suffix: '/equipe', label: 'Equipe', module: 'equipe' },
  { suffix: '/agenda', label: 'Agenda', module: 'agenda' },
  { suffix: '/mapa', label: 'Solo', module: 'mapa' },
  { suffix: '/safras', label: 'Safras', module: 'safras' },
  { suffix: '/documentos', label: 'Documentos', module: 'documentos' },
  { suffix: '/contatos', label: 'Contatos', module: 'contatos' },
  { suffix: '/membros', label: 'Membros', module: 'membros' },
  { suffix: '/negocios', label: 'Negócios', module: 'negocios' },
  { suffix: '/financeiro', label: 'Financeiro', module: 'financeiro' },
  { suffix: '/relatorios', label: 'Relatórios', module: 'relatorios' },
  { suffix: '/inteligencia', label: 'IA', module: 'inteligencia' },
  { suffix: '/notificacoes', label: 'Notificações', module: 'notificacoes' },
];

export default function FarmLayout({ children }: { children: React.ReactNode }) {
  const { farmId } = useParams<{ farmId: string }>();
  const pathname = usePathname();
  const { user, accessToken, logout } = useAuth();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [open, setOpen] = useState(false);
  // Allowlist de módulos do usuário nesta propriedade. null = ainda carregando ou
  // acesso total (mostra tudo).
  const [allowed, setAllowed] = useState<ModuleKey[] | null>(null);

  const base = `/fazendas/${farmId}`;

  const loadFarm = useCallback(async () => {
    try {
      const [data, access] = await Promise.all([
        apiFetch<Farm>(base, { token: accessToken }),
        apiFetch<{ role: string; moduleAccess: ModuleKey[] }>(`${base}/meu-acesso`, {
          token: accessToken,
        }).catch(() => null),
      ]);
      setFarm(data);
      // Lista vazia (ou falha) = acesso total: não filtramos a navegação.
      setAllowed(access && access.moduleAccess.length > 0 ? access.moduleAccess : null);
    } catch {
      setFarm(null);
    }
  }, [base, accessToken]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFarm();
  }, [user, loadFarm]);

  const visibleNav = allowed
    ? NAV.filter((item) => !item.module || allowed.includes(item.module))
    : NAV;

  // Fecha o menu mobile ao trocar de rota.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  function isActive(suffix: string) {
    const href = base + suffix;
    if (suffix === '') return pathname === base;
    return pathname === href || pathname.startsWith(href + '/');
  }

  // Sem usuário: as próprias páginas cuidam do redirect; não renderiza a casca.
  if (!user) return <>{children}</>;

  const navLinks = (
    <nav className="flex flex-col gap-0.5">
      {visibleNav.map((item) => (
        <Link
          key={item.suffix}
          href={base + item.suffix}
          className={`rounded px-3 py-2 text-sm font-medium ${
            isActive(item.suffix)
              ? 'bg-green-100 text-green-800'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex flex-1">
      {/* Sidebar — desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
        <div className="border-b border-gray-100 px-4 py-4">
          <p className="text-lg font-semibold text-green-800">CampoFlow</p>
          <p className="truncate text-sm text-gray-500">{farm?.name ?? 'Propriedade'}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3">{navLinks}</div>
        <div className="border-t border-gray-100 px-2 py-3">
          <Link
            href="/fazendas"
            className="block rounded px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            ← Propriedades
          </Link>
          <button
            onClick={logout}
            className="mt-0.5 block w-full rounded px-3 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — mobile */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className="rounded p-1 text-gray-700 hover:bg-gray-100"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <p className="truncate font-semibold text-green-800">{farm?.name ?? 'CampoFlow'}</p>
          <Link href="/fazendas" className="text-sm font-medium text-green-700">
            Trocar
          </Link>
        </header>

        {children}
      </div>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-green-800">CampoFlow</p>
                <p className="truncate text-sm text-gray-500">{farm?.name ?? 'Propriedade'}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-3">{navLinks}</div>
            <div className="border-t border-gray-100 px-2 py-3">
              <Link
                href="/fazendas"
                className="block rounded px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                ← Propriedades
              </Link>
              <button
                onClick={logout}
                className="mt-0.5 block w-full rounded px-3 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
