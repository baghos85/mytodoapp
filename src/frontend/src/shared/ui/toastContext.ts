import { createContext } from 'react';

export interface ToastOptions {
  message: string;
  /** Optional action button, e.g. "Undo" or "Reload". The toast closes after the action runs. */
  action?: { label: string; onAction: () => void };
  /** Auto-dismiss after this many ms (default 5000); `null` keeps the toast until dismissed. */
  durationMs?: number | null;
  tone?: 'info' | 'error';
}

export interface ToastApi {
  /** Shows a toast and returns its id. */
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);
