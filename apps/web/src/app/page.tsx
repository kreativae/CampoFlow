'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/fazendas' : '/entrar');
  }, [loading, user, router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <p className="text-gray-500">Carregando...</p>
    </main>
  );
}
