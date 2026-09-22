import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertIcon, CheckIcon, InfoIcon } from './icons';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; type: ToastType; msg: string; }

const ToastCtx = createContext<((type: ToastType, msg: string) => void) | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const push = useContext(ToastCtx);
  if (!push) throw new Error('useToast must be used inside <ToastProvider>');
  return push;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((type: ToastType, msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const icon = { success: <CheckIcon />, error: <AlertIcon />, info: <InfoIcon /> };

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <div className="ic">{icon[t.type]}</div>
            <div className="msg">{t.msg}</div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
