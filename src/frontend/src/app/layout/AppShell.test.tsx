import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '../../test/renderWithProviders';
import { setViewportWidth, viewports } from '../../test/viewport';

const NAV_LINKS = [
  ['Today', '/today'],
  ['Upcoming', '/upcoming'],
  ['Completed', '/completed'],
  ['Lists', '/lists'],
] as const;

function expectMainNavLinks(nav: HTMLElement) {
  const links = within(nav).getAllByRole('link');
  expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual(NAV_LINKS);
}

async function renderToday() {
  const result = renderRoute('/today');
  await screen.findByRole('heading', { level: 1, name: 'Today' });
  return result;
}

describe('AppShell', () => {
  it('AppShell_Desktop_ShowsSidebarNavigationAndPrivacyLink', async () => {
    setViewportWidth(viewports.desktop);
    await renderToday();

    expectMainNavLinks(screen.getByRole('navigation', { name: 'Main' }));
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(screen.queryByRole('button', { name: 'Open navigation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('AppShell_Tablet_ShowsNavigationInDrawerBehindMenuButton', async () => {
    setViewportWidth(viewports.tablet);
    const { user, router } = await renderToday();

    const menuButton = screen.getByRole('button', { name: 'Open navigation' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();

    await user.click(menuButton);

    const drawer = screen.getByRole('dialog', { name: 'Menu' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expectMainNavLinks(within(drawer).getByRole('navigation', { name: 'Main' }));
    expect(within(drawer).getByRole('link', { name: 'Privacy' })).toBeInTheDocument();

    await user.click(within(drawer).getByRole('link', { name: 'Upcoming' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Upcoming' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/upcoming');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('AppShell_Mobile_ShowsTopBarWithTitleAndBottomNavigation', async () => {
    setViewportWidth(viewports.mobile);
    await renderToday();

    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('Today')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open navigation' })).not.toBeInTheDocument();
    expectMainNavLinks(screen.getByRole('navigation', { name: 'Main' }));
    expect(screen.queryByRole('link', { name: 'Privacy' })).not.toBeInTheDocument();
  });

  it('AppShell_AnyBreakpoint_HasSkipLinkToMain', async () => {
    await renderToday();

    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });
});
