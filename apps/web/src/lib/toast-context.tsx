'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  /** Atalho para toast de sucesso. */
  toastSuccess: (message: string) => void;
  toastError: (message: string) => void;
  toastInfo: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const KIND_STYLE: Record<ToastKind, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-gray-200 bg-white text-gray-800',
};

const KIND_ICON: Record<ToastKind, string> = {
  success: '✓',
  error: '✕',
  info: 'i',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const toastSuccess = useCallback((m: string) => push('success', m), [push]);
  const toastError = useCallback((m: string) => push('error', m), [push]);
  const toastInfo = useCallback((m: string) => push('info', m), [push]);

  return (
    <ToastContext.Provider value={{ toastSuccess, toastError, toastInfo }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-sm ${KIND_STYLE[t.kind]}`}
          >
            <span className="mt-0.5 font-bold">{KIND_ICON[t.kind]}</span>
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => remove(t.id)}
              aria-label="Fechar"
              className="shrink-0 text-current opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
