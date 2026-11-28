import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './Toast';
import type { ToastOptions } from './toastContext';
import { useToast } from './useToast';

function ShowToastButton(options: ToastOptions) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast(options)}>
      Show
    </button>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it('ShowToast_DefaultDuration_AnnouncesAndDismissesAfterFiveSeconds', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ShowToastButton message="Task completed." />
      </ToastProvider>,
    );

    act(() => screen.getByRole('button', { name: 'Show' }).click());

    const message = screen.getByText('Task completed.');
    expect(message.closest('[aria-live="polite"]')).not.toBeNull();

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText('Task completed.')).not.toBeInTheDocument();
  });

  it('ShowToast_WithAction_RunsActionAndCloses', () => {
    const onAction = vi.fn();
    render(
      <ToastProvider>
        <ShowToastButton message="Task completed." action={{ label: 'Undo', onAction }} />
      </ToastProvider>,
    );

    act(() => screen.getByRole('button', { name: 'Show' }).click());
    act(() => screen.getByRole('button', { name: 'Undo' }).click());

    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.queryByText('Task completed.')).not.toBeInTheDocument();
  });
});
