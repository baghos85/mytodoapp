import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OfflineBanner } from './OfflineBanner';

const MESSAGE = "You're offline. Showing saved data; changes are disabled.";

describe('OfflineBanner', () => {
  it('OfflineBanner_Online_ShowsNothing', () => {
    render(<OfflineBanner />);

    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
  });

  it('OfflineBanner_GoesOffline_ShowsExactSpecTextInLiveRegion', () => {
    render(<OfflineBanner />);

    act(() => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByRole('status')).toHaveTextContent(MESSAGE);
  });

  it('OfflineBanner_BackOnline_HidesMessage', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<OfflineBanner />);
    expect(screen.getByText(MESSAGE)).toBeInTheDocument();

    act(() => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
  });
});
