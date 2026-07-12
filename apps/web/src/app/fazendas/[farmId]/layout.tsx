'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  BarChart3,
  Beef,
  Bell,
  BookUser,
  Calendar,
  FileText,
  Handshake,
  Heart,
  LayoutGrid,
  Leaf,
  LogOut,
  Map,
  Menu,
  Package,
  Sparkles,
  Sprout,
  Tractor,
  UserPlus,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import type { Farm, ModuleKey } from '@/lib/types';

interface NavItem {
  suffix: string; // caminho depois de /fazendas/:id
  label: string;
  icon: LucideIcon;
  module?: ModuleKey; // módulo controlável; ausente = sempre visível (ex.: Painel)
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { suffix: '', label: 'Painel', icon: LayoutGrid },
      { suffix: '/animais', label: 'Rebanho', icon: Beef, module: 'rebanho' },
      { suffix: '/pastagens', label: 'Pastagens', icon: Leaf, module: 'pastagens' },
      { suffix: '/reproducao', label: 'Reprodução', icon: Heart, module: 'reproducao' },
      { suffix: '/financeiro', label: 'Financeiro', icon: Wallet, module: 'financeiro' },
    ],
  },
  {
    title: 'Operação',
    items: [
      { suffix: '/insumos', label: 'Insumos', icon: Package, module: 'insumos' },
      { suffix: '/maquinas', label: 'Máquinas', icon: Tractor, module: 'maquinas' },
      { suffix: '/equipe', label: 'Equipe', icon: Users, module: 'equipe' },
      { suffix: '/agenda', label: 'Agenda', icon: Calendar, module: 'agenda' },
      { suffix: '/safras', label: 'Safras', icon: Sprout, module: 'safras' },
      { suffix: '/negocios', label: 'Negócios', icon: Handshake, module: 'negocios' },
    ],
  },
  {
    title: 'Dados',
    items: [
      { suffix: '/mapa', label: 'Mapa e Solo', icon: Map, module: 'mapa' },
      { suffix: '/documentos', label: 'Documentos', icon: FileText, module: 'documentos' },
      { suffix: '/relatorios', label: 'Relatórios', icon: BarChart3, module: 'relatorios' },
      { suffix: '/inteligencia', label: 'Inteligência', icon: Sparkles, module: 'inteligencia' },
      { suffix: '/notificacoes', label: 'Notificações', icon: Bell, module: 'notificacoes' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { suffix: '/contatos', label: 'Contatos', icon: BookUser, module: 'contatos' },
      { suffix: '/membros', label: 'Membros', icon: UserPlus, module: 'membros' },
    ],
  },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

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

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: allowed
      ? group.items.filter((item) => !item.module || allowed.includes(item.module))
      : group.items,
  })).filter((group) => group.items.length > 0);

  // Fecha o menu mobile ao trocar de rota.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  // Fecha o drawer com Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function isActive(suffix: string) {
    const href = base + suffix;
    if (suffix === '') return pathname === base;
    return pathname === href || pathname.startsWith(href + '/');
  }

  // Sem usuário: as próprias páginas cuidam do redirect; não renderiza a casca.
  if (!user) return <>{children}</>;

  const navLinks = (
    <nav className="flex flex-col gap-5">
      {visibleGroups.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
            {group.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(item.suffix);
              const Icon = item.icon;
              return (
                <Link
                  key={item.suffix}
                  href={base + item.suffix}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? 'bg-sidebar-active text-white'
                      : 'text-white/65 hover:bg-sidebar-hover hover:text-white'
                  }`}
                >
                  <Icon
                    size={17}
                    strokeWidth={active ? 2.2 : 1.8}
                    className={`shrink-0 transition-colors duration-150 ${
                      active ? 'text-emerald-300' : 'text-white/45 group-hover:text-white/80'
                    }`}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const footerLinks = (
    <div className="border-t border-white/10 px-3 py-3">
      <Link
        href="/conta/perfil"
        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-sidebar-hover"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-800/80 text-xs font-semibold text-emerald-100">
          {initials(user.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-white">{user.name}</span>
          <span className="block truncate text-xs text-white/45">Minha conta</span>
        </span>
      </Link>
      <div className="mt-1 flex items-center gap-0.5">
        <Link
          href="/fazendas"
          className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-white/55 transition-colors duration-150 hover:bg-sidebar-hover hover:text-white"
        >
          <ArrowLeftRight size={14} strokeWidth={1.8} />
          Trocar propriedade
        </Link>
        <button
          onClick={logout}
          aria-label="Sair"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-white/55 transition-colors duration-150 hover:bg-sidebar-hover hover:text-white"
        >
          <LogOut size={14} strokeWidth={1.8} />
          Sair
        </button>
      </div>
    </div>
  );

  const brand = (
    <div className="flex items-center gap-3 px-4 py-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/90">
        <Leaf size={18} strokeWidth={2} className="text-white" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold tracking-tight text-white">
          CampoFlow
        </span>
        <span className="block truncate text-xs text-white/45">{farm?.name ?? 'Propriedade'}</span>
      </span>
    </div>
  );

  return (
    <div className="flex flex-1">
      {/* Sidebar — desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar md:flex">
        {brand}
        <div className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-4">{navLinks}</div>
        {footerLinks}
      </aside>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — mobile */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className="rounded-lg p-1.5 text-gray-700 transition-colors hover:bg-gray-100"
          >
            <Menu size={22} strokeWidth={1.8} />
          </button>
          <p className="truncate font-semibold tracking-tight text-emerald-900">
            {farm?.name ?? 'CampoFlow'}
          </p>
          <Link href="/fazendas" className="text-sm font-medium text-emerald-700">
            Trocar
          </Link>
        </header>

        {children}
      </div>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="animate-fade-in absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="animate-slide-in-left absolute left-0 top-0 flex h-full w-72 flex-col bg-sidebar shadow-2xl">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-sidebar-hover hover:text-white"
              >
                <X size={20} strokeWidth={1.8} />
              </button>
            </div>
            <div className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-4">{navLinks}</div>
            {footerLinks}
          </div>
        </div>
      )}
    </div>
  );
}
