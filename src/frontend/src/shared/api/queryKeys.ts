/**
 * TanStack Query keys (SPEC 10.8). Always build keys here so invalidation prefixes stay consistent:
 * any task mutation invalidates `queryKeys.tasks.all` + `queryKeys.lists.all`.
 */
export type ListTaskStatus = 'open' | 'completed' | 'all';

export const queryKeys = {
  me: ['auth', 'me'] as const,
  lists: {
    all: ['lists'] as const,
    detail: (listId: string) => ['lists', listId] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    list: (listId: string, status: ListTaskStatus) => ['tasks', 'list', listId, status] as const,
    /** `localDate` (YYYY-MM-DD) is part of the key so the view refetches after local midnight. */
    today: (timeZone: string, localDate: string) =>
      ['tasks', 'today', timeZone, localDate] as const,
    upcoming: (timeZone: string, localDate: string) =>
      ['tasks', 'upcoming', timeZone, localDate] as const,
    completed: ['tasks', 'completed'] as const,
    detail: (taskId: string) => ['tasks', 'detail', taskId] as const,
  },
};
