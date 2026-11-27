import type { IconName } from './Icon';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

/** Main navigation (SPEC 6.2), the same on every breakpoint. */
export const navItems: readonly NavItem[] = [
  { to: '/today', label: 'Today', icon: 'today' },
  { to: '/upcoming', label: 'Upcoming', icon: 'upcoming' },
  { to: '/completed', label: 'Completed', icon: 'completed' },
  { to: '/lists', label: 'Lists', icon: 'lists' },
];
