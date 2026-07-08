'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const NAV_ITEMS = [
  { href: '/admin', label: 'Contas e assinaturas' },
  { href: '/admin/tickets', label: 'Tickets' },
  { href: '/admin/mercadopago', label: 'Mercado Pago' },
  { href: '/admin/notificacoes', label: 'Notificações' },
  { href: '/admin/auditoria', label: 'Auditoria' },
  { href: '/admin/saude', label: 'Saúde' },
];

// Distinct dark header so it's visually obvious this is the platform-staff area,
// not the customer-facing app. The isPlatformAdmin check lives here (not in each
// page) so every current/future /admin/* page is gated for free.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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

  if (loading || !user || !user.isPlatformAdmin) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-gray-900 text-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold uppercase tracking-wide text-gray-300">
              CampoFlow Admin
            </span>
            <nav className="flex gap-4">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium hover:text-white ${
                    pathname === item.href ? 'text-white' : 'text-gray-400'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <button onClick={logout} className="text-gray-400 hover:text-white">
              Sair
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
