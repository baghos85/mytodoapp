/**
 * jsdom has no layout and no `matchMedia`. This stand-in answers `(min-width: Npx)` / `(max-width: Npx)`
 * queries for the current test viewport width, so tests can render each breakpoint (SPEC 6.2).
 * Changing the width while rendered fires `change` on the subscribed lists, like a browser resize
 * (wrap the call in `act()`).
 */
function matches(query: string, width: number): boolean {
  const conditions = [...query.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)];
  if (conditions.length === 0) return false;
  return conditions.every(([, kind, value]) =>
    kind === 'min' ? width >= Number(value) : width <= Number(value),
  );
}

let currentWidth = 1280;
const listeners = new Set<EventListener>();

function matchMedia(query: string): MediaQueryList {
  const list: MediaQueryList = {
    get matches() {
      return matches(query, currentWidth);
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === 'function') listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === 'function') listeners.delete(listener);
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };
  return list;
}

export function setViewportWidth(width: number): void {
  currentWidth = width;
  if (window.matchMedia !== matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: matchMedia,
    });
  }
  // Subscribers re-read `matches`; an extra notification for an unchanged query is harmless.
  for (const listener of [...listeners]) listener(new Event('change'));
}

export const viewports = { mobile: 375, tablet: 800, desktop: 1280 } as const;
