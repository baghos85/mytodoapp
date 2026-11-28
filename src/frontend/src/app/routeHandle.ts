import { useMatches } from 'react-router';

/** Static data on a route (`handle`). `title` names the page in the top bar and `document.title`. */
export interface RouteHandle {
  title: string;
}

function isRouteHandle(value: unknown): value is RouteHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    typeof value.title === 'string'
  );
}

/** Title of the deepest matched route that has one. */
export function useRouteTitle(): string | undefined {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const routeHandle = matches[i]?.handle;
    if (isRouteHandle(routeHandle)) return routeHandle.title;
  }
  return undefined;
}
