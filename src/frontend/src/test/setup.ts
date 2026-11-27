import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { reportNetworkSuccess } from '../shared/lib/connectivity';
import { setViewportWidth, viewports } from './viewport';

// jsdom has no modal <dialog> API. Minimal stand-in: toggles `open` and fires `close` like a browser.
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
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
