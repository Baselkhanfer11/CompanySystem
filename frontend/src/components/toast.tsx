import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertIcon, CheckIcon, InfoIcon } from './icons';

type ToastType = 'success' | 'error' | 'info';
interface ToastAction { label: string; onClick: () => void } // e.g. "View" what was just saved
interface ToastItem { id: number; type: ToastType; msg: string; action?: ToastAction }

const ToastCtx = createContext<((type: ToastType, msg: string, action?: ToastAction) => void) | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const push = useContext(ToastCtx);
  if (!push) throw new Error('useToast must be used inside <ToastProvider>');
  return push;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((type: ToastType, msg: string, action?: ToastAction) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, msg, action }]);
    setTimeout(() => dismiss(id), action ? 6000 : 3500); // a little longer when there's a button to press
  }, [dismiss]);

  const icon = { success: <CheckIcon />, error: <AlertIcon />, info: <InfoIcon /> };

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <div className="ic">{icon[t.type]}</div>
            <div className="msg">{t.msg}</div>
            {t.action && (
              <button type="button" className="toast-action" onClick={() => { t.action!.onClick(); dismiss(t.id); }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
