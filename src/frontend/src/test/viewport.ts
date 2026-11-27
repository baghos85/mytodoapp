/**
 * jsdom has no layout and no `matchMedia`. This stand-in answers `(min-width: Npx)` / `(max-width: Npx)`
 * queries for a fixed viewport width, so tests can render each breakpoint (SPEC 6.2).
 */
function matches(query: string, width: number): boolean {
  const conditions = [...query.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)];
  if (conditions.length === 0) return false;
  return conditions.every(([, kind, value]) =>
    kind === 'min' ? width >= Number(value) : width <= Number(value),
  );
}

export function setViewportWidth(width: number): void {
  const matchMedia = (query: string): MediaQueryList => ({
    matches: matches(query, width),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: matchMedia,
  });
}

export const viewports = { mobile: 375, tablet: 800, desktop: 1280 } as const;
