import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CharacterPortrait } from '../CharacterPortrait';
import { PORTRAIT_MAX_BYTES } from '../../../logic/portrait';

function makeFile(type: string, size: number): File {
  const file = new File(['x'], 'portrait', { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function renderPortrait(portrait = '') {
  const onUpload = vi.fn();
  const onRemove = vi.fn();
  render(
    <CharacterPortrait
      portrait={portrait}
      characterName="Tester"
      onUpload={onUpload}
      onRemove={onRemove}
    />,
  );
  return { onUpload, onRemove };
}

describe('CharacterPortrait - generate prompt trigger', () => {
  it('renders the trigger directly below the Upload Portrait button and fires the callback', () => {
    const onGeneratePrompt = vi.fn();
    render(
      <CharacterPortrait
        portrait=""
        characterName="Tester"
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onGeneratePrompt={onGeneratePrompt}
      />,
    );
    const upload = screen.getByRole('button', { name: /upload portrait/i });
    const generate = screen.getByRole('button', { name: /generate portrait prompt/i });
    // Immediately follows Upload in the same controls column.
    expect(upload.nextElementSibling).toBe(generate);
    fireEvent.click(generate);
    expect(onGeneratePrompt).toHaveBeenCalledTimes(1);
  });

  it('keeps the trigger between Upload and Remove when a portrait exists', () => {
    render(
      <CharacterPortrait
        portrait="blob:x"
        characterName="Tester"
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onGeneratePrompt={vi.fn()}
      />,
    );
    const generate = screen.getByRole('button', { name: /generate portrait prompt/i });
    expect(generate.previousElementSibling).toBe(
      screen.getByRole('button', { name: /upload portrait/i }),
    );
    expect(generate.nextElementSibling).toBe(screen.getByRole('button', { name: /remove/i }));
  });

  it('renders no trigger when onGeneratePrompt is not provided', () => {
    renderPortrait('');
    expect(screen.queryByRole('button', { name: /generate portrait prompt/i })).toBeNull();
  });
});

describe('CharacterPortrait', () => {
  it('shows the placeholder when no portrait is set', () => {
    renderPortrait('');
    expect(screen.getByText('No portrait set')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
  });

  it('shows the image with correct alt text when a portrait is set', () => {
    renderPortrait('blob:x');
    const img = screen.getByAltText('Portrait of Tester') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain('blob:x');
  });

  it('exposes accessible names for the upload button and file input', () => {
    renderPortrait('');
    expect(screen.getByLabelText('Upload portrait')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload Portrait/ })).toBeInTheDocument();
  });

  it('rejects a non-image file: shows the error and does not call onUpload', () => {
    const { onUpload } = renderPortrait('');
    const input = screen.getByLabelText('Upload portrait');
    fireEvent.change(input, { target: { files: [makeFile('application/pdf', 1024)] } });
    expect(screen.getByText(/JPEG, PNG, or WebP/)).toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('rejects an oversized file and does not call onUpload', () => {
    const { onUpload } = renderPortrait('');
    const input = screen.getByLabelText('Upload portrait');
    fireEvent.change(input, {
      target: { files: [makeFile('image/png', PORTRAIT_MAX_BYTES + 1)] },
    });
    expect(screen.getByText(/5 MB or smaller/)).toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('accepts a valid file and calls onUpload', () => {
    const { onUpload } = renderPortrait('');
    const input = screen.getByLabelText('Upload portrait');
    const file = makeFile('image/png', 2048);
    fireEvent.change(input, { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it('calls onRemove when Remove is clicked', () => {
    const { onRemove } = renderPortrait('blob:x');
    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('opens the enlarge dialog, names it, and closes on Escape', () => {
    renderPortrait('blob:x');
    fireEvent.click(screen.getByRole('button', { name: /View enlarged portrait/ }));
    const dialog = screen.getByRole('dialog', { name: 'Enlarged portrait of Tester' });
    expect(dialog).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(
      screen.queryByRole('dialog', { name: 'Enlarged portrait of Tester' }),
    ).toBeNull();
  });
});
