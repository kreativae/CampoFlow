'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  CreditCard,
  HeartPulse,
  Leaf,
  LogOut,
  Menu,
  ScrollText,
  Ticket,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/admin', label: 'Contas', icon: Users },
  { href: '/admin/tickets', label: 'Tickets', icon: Ticket },
  { href: '/admin/gateway', label: 'Gateway', icon: CreditCard },
  { href: '/admin/notificacoes', label: 'Notificações', icon: Bell },
  { href: '/admin/auditoria', label: 'Auditoria', icon: ScrollText },
  { href: '/admin/saude', label: 'Saúde', icon: HeartPulse },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    if (!user.isPlatformAdmin) {
      router.replace('/fazendas');
    }
  }, [loading, user, router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (loading || !user || !user.isPlatformAdmin) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-sidebar text-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <span className="flex shrink-0 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600/90">
              <Leaf size={15} strokeWidth={2} className="text-white" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-white">
              CampoFlow <span className="font-normal text-white/50">Admin</span>
            </span>
          </span>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? 'bg-sidebar-active text-white'
                      : 'text-white/60 hover:bg-sidebar-hover hover:text-white'
                  }`}
                >
                  <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={logout}
              className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-white/60 transition-colors duration-150 hover:bg-sidebar-hover hover:text-white sm:flex"
            >
              <LogOut size={15} strokeWidth={1.8} />
              Sair
            </button>
            {/* Hamburger mobile */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
              className="rounded-lg p-1.5 text-white/60 transition-colors hover:text-white sm:hidden"
            >
              {menuOpen ? <X size={20} strokeWidth={1.8} /> : <Menu size={20} strokeWidth={1.8} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <nav className="animate-fade-in border-t border-white/10 px-4 pb-3 pt-1 sm:hidden">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors duration-150 ${
                    active ? 'bg-sidebar-active text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Icon size={16} strokeWidth={1.8} />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={logout}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-white/60 transition-colors hover:text-white"
            >
              <LogOut size={16} strokeWidth={1.8} />
              Sair
            </button>
          </nav>
        )}
      </header>
      {children}
    </div>
  );
}
