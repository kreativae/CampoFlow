'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MercadoPagoRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/gateway');
  }, [router]);
  return null;
}
