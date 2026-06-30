'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** If set, the user must type this exact text into a field before confirming. */
  requireText?: string;
  requireTextLabel?: string;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [typedText, setTypedText] = useState('');
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setTypedText('');
      setPending({ ...options, resolve });
    });
  }, []);

  function handleClose(result: boolean) {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setPending(null);
    setTypedText('');
  }

  const textMatches = !pending?.requireText || typedText === pending.requireText;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2
              className={`text-lg font-semibold ${pending.danger ? 'text-red-700' : 'text-gray-900'}`}
            >
              {pending.title}
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm text-gray-600">{pending.message}</p>

            {pending.requireText && (
              <div className="mt-4">
                <label className="text-xs font-medium text-gray-600">
                  {pending.requireTextLabel ??
                    `Digite "${pending.requireText}" para confirmar`}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
                />
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {pending.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                type="button"
                disabled={!textMatches}
                onClick={() => handleClose(true)}
                className={`rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  pending.danger
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-700 hover:bg-green-800'
                }`}
              >
                {pending.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx.confirm;
}
