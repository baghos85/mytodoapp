import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { UpdatePrompt } from './UpdatePrompt';

const registration = vi.hoisted(() => ({
  needRefresh: false,
  updateServiceWorker: vi.fn<(reloadPage?: boolean) => Promise<void>>(),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [registration.needRefresh, () => undefined],
    offlineReady: [false, () => undefined],
    updateServiceWorker: registration.updateServiceWorker,
  }),
}));

beforeEach(() => {
  registration.needRefresh = false;
  registration.updateServiceWorker.mockResolvedValue(undefined);
});

describe('UpdatePrompt', () => {
  it('UpdatePrompt_NoUpdateWaiting_ShowsNothing', () => {
    renderWithProviders(<UpdatePrompt />);

    expect(screen.queryByText('A new version is available.')).not.toBeInTheDocument();
  });

  it('UpdatePrompt_UpdateWaiting_ShowsToastAndReloadActivatesIt', async () => {
    registration.needRefresh = true;
    const { user } = renderWithProviders(<UpdatePrompt />);

    expect(await screen.findByText('A new version is available.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reload' }));

    expect(registration.updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
