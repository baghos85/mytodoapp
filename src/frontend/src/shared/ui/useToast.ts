import { useContext } from 'react';
import { ToastContext, type ToastApi } from './toastContext';

/** Shows toasts (SPEC 6.4, 6.5). Needs a `ToastProvider` above (see `app/providers.tsx`). */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>.');
  return api;
}
