import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { reportNetworkSuccess } from '../shared/lib/connectivity';
import { setViewportWidth, viewports } from './viewport';

// jsdom has no modal <dialog> API. Minimal stand-in: toggles `open`, closes on Esc and fires `close`
// like a browser.
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  const withEscape = new WeakSet<HTMLDialogElement>();
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
    // Like a browser: focus the first focusable element inside the dialog.
    this.querySelector<HTMLElement>(
      '[autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )?.focus();
    if (!withEscape.has(this)) {
      withEscape.add(this);
      this.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.open) this.close();
      });
    }
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

beforeEach(() => {
  setViewportWidth(viewports.desktop);
});

afterEach(() => {
  cleanup();
  // Connectivity is module state: reset it so tests stay independent.
  reportNetworkSuccess();
});
