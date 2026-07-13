'use client';

import { useEffect, useState } from 'react';
import { apiFetch, API_URL } from '@/lib/api';

export default function GoogleLoginButton() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    apiFetch<{ enabled: boolean }>('/auth/google/status')
      .then((res) => setEnabled(res.enabled))
      .catch(() => setEnabled(false));
  }, []);

  if (!enabled) return null;

  return (
    <a
      href={`${API_URL}/auth/google`}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      Entrar com Google
    </a>
  );
}
