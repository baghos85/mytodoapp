import { useMediaQuery } from '../../shared/hooks/useMediaQuery';

/** SPEC 6.2: mobile < 640 px, tablet 640–1023 px, desktop ≥ 1024 px. Keep in sync with the CSS media queries. */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export const TABLET_QUERY = '(min-width: 640px)';
export const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * The current layout breakpoint. The shell renders only the navigation for this breakpoint, so the
 * accessibility tree never contains a hidden duplicate of it.
 */
export function useBreakpoint(): Breakpoint {
  const tablet = useMediaQuery(TABLET_QUERY);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  if (desktop) return 'desktop';
  return tablet ? 'tablet' : 'mobile';
}
