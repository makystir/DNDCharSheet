import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConfirmDialog } from '../ConfirmDialog';

afterEach(cleanup);

/**
 * A harness with a trigger button that opens the dialog, so focus-restore to
 * the trigger on close can be asserted.
 */
function Harness({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && (
        <ConfirmDialog
          message="Delete this?"
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={() => {
            onConfirm();
            setOpen(false);
          }}
          onCancel={() => {
            onCancel();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

describe('ConfirmDialog', () => {
  it('moves focus into the dialog on open', () => {
    render(
      <ConfirmDialog message="Delete this?" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('cycles focus within the dialog on Tab from the last focusable', () => {
    render(
      <ConfirmDialog
        message="Delete this?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Delete' });

    confirm.focus();
    expect(document.activeElement).toBe(confirm);
    // Tab from the last focusable wraps to the first. Fire on the focused
    // element so the event bubbles up to the focus-trap listener on the dialog.
    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);
    expect(dialog).toBeInTheDocument();
  });

  it('invokes onCancel on Escape', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog message="Delete this?" onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('invokes onCancel on overlay click', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog message="Delete this?" onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole('dialog'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the trigger on close and releases the scroll lock', () => {
    const onCancel = vi.fn();
    render(<Harness onConfirm={vi.fn()} onCancel={onCancel} />);

    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);

    // Scroll locked while open.
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Dialog gone, focus back on the trigger, scroll lock released.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('');
  });
});
