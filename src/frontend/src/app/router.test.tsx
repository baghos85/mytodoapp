import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '../test/renderWithProviders';

describe('routes', () => {
  it('Route_Root_RedirectsToToday', async () => {
    const { router } = renderRoute('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/today');
  });

  it.each([
    ['/today', 'Today'],
    ['/upcoming', 'Upcoming'],
    ['/completed', 'Completed'],
    ['/lists', 'Lists'],
    ['/lists/0193a1b2-0000-7000-8000-000000000001', 'List'],
    ['/account', 'Account'],
    ['/login', 'Sign in'],
    ['/register', 'Create account'],
    ['/privacy', 'Privacy'],
  ])('Route_DeepLink_%s_RendersItsPage', async (path, heading) => {
    renderRoute(path);

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(document.title).toBe(`${heading} · MyTodoApp`);
  });

  it('Route_UnknownPath_ShowsNotFoundWithLinkToToday', async () => {
    const { user, router } = renderRoute('/no/such/page');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Go to Today' });
    expect(link).toHaveAttribute('href', '/today');

    await user.click(link);

    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/today');
  });

  it('Route_UnknownPath_HasNoAppNavigation', async () => {
    renderRoute('/no/such/page');

    await screen.findByRole('heading', { level: 1, name: 'Page not found' });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
