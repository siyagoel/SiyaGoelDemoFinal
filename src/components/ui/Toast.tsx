"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconCheck } from "@/components/ui/icons";

export type ToastTone = "success" | "danger";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

type Notify = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<Notify>(() => {});

/** No-op outside a provider, so components stay usable in isolation and tests. */
export function useToast(): Notify {
  return useContext(ToastContext);
}

const TONES: Record<ToastTone, string> = {
  success: "border-[rgba(52,211,153,0.3)] bg-[var(--success-soft)] text-success",
  danger: "border-[rgba(248,113,113,0.3)] bg-[var(--danger-soft)] text-danger",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const notify = useCallback<Notify>((message, tone = "success") => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4500);
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-80 flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs shadow-overlay backdrop-blur animate-rise ${TONES[toast.tone]}`}
          >
            <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Announces the result of a server action. Each submission produces a new
 * state object, so repeated actions on the same page each get their own toast.
 */
export function useActionToast(
  state: { ok: boolean; error?: string | null },
  describe: () => string,
): void {
  const notify = useToast();
  const previous = useRef(state);
  const describeRef = useRef(describe);
  describeRef.current = describe;

  useEffect(() => {
    if (state === previous.current) return;
    previous.current = state;
    if (state.ok) notify(describeRef.current());
  }, [state, notify]);
}
