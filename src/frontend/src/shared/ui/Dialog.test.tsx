import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

function DialogHarness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Edit task
      </button>
      <Dialog
        open={open}
        title="Edit task"
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
      >
        <p>Dialog content</p>
      </Dialog>
    </>
  );
}

async function openDialog(onClose?: () => void) {
  const user = userEvent.setup();
  render(<DialogHarness onClose={onClose} />);
  const opener = screen.getByRole('button', { name: 'Edit task' });
  await user.click(opener);
  const dialog = screen.getByRole('dialog', { name: 'Edit task' });
  return { user, opener, dialog };
}

describe('Dialog', () => {
  it('Dialog_Opened_ShowsTitledDialogWithFocusInside', async () => {
    const { dialog } = await openDialog();

    expect(dialog).toHaveAttribute('open');
    expect(screen.getByText('Dialog content')).toBeInTheDocument();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('Dialog_CloseButton_CallsOnClose', async () => {
    const onClose = vi.fn();
    const { user } = await openDialog(onClose);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Dialog_EscapePressed_ClosesAndCallsOnClose', async () => {
    const onClose = vi.fn();
    const { user } = await openDialog(onClose);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Dialog_Closed_ReturnsFocusToOpener', async () => {
    const { user, opener } = await openDialog();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(opener).toHaveFocus();
  });
});
