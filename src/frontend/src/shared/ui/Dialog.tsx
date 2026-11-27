import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './Dialog.module.css';

export interface DialogProps {
  open: boolean;
  /** Called when the dialog closes (Esc, the close button, or `open` set to false by the parent). */
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** `modal` = centred on desktop, full-screen sheet on mobile (SPEC 6.2); `drawer` = slides in from the left. */
  variant?: 'modal' | 'drawer';
}

/**
 * Native `<dialog>` opened with `showModal()`: the browser traps focus, makes the page inert and closes on
 * Esc (SPEC 7.3). Focus returns to the element that opened it.
 */
export function Dialog({ open, onClose, title, children, variant = 'modal' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    opener.current?.focus();
    opener.current = null;
    onClose();
  };

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${styles[variant] ?? ''}`}
      aria-labelledby={titleId}
      onClose={handleClose}
    >
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <button
          type="button"
          className={styles.close}
          aria-label="Close"
          onClick={() => ref.current?.close()}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className={styles.body}>{children}</div>
    </dialog>
  );
}
