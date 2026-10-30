import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
const prep = vi.hoisted(() => ({ prepareImage: vi.fn() }));
vi.mock('./prepareImage', async (orig) => ({ ...(await orig<typeof import('./prepareImage')>()), prepareImage: prep.prepareImage }));

vi.mock('./CoverCropDialog', () => ({
  default: ({ file, onApply, onSkip, onCancel }: { file: File; onApply: (f: File) => void; onSkip: () => void; onCancel: () => void }) => (
    <div role="dialog" aria-label="crop">
      <span>cropping {file.name}</span>
      <button onClick={() => onApply(new File(['c'], 'cropped.webp', { type: 'image/webp' }))}>Use this crop</button>
      <button onClick={onSkip}>Use the whole picture, no crop</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

import CoverImageField from './CoverImageField';
import { ImageProblem } from './prepareImage';

const photo = new File([new Uint8Array(8_000_000)], 'IMG_1.jpg', { type: 'image/jpeg' });
const chooser = (c: HTMLElement) => c.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(() => vi.clearAllMocks());

describe('CoverImageField', () => {
  it('opens the crop window for a chosen photo, and uploads the cropped cover', async () => {
    const uploadImage = vi.fn().mockResolvedValue('https://cdn.example.com/a.webp');
    const onChange = vi.fn();
    const { container } = render(<CoverImageField url={null} alt="" uploadImage={uploadImage} onChange={onChange} />);
    await userEvent.upload(chooser(container), photo);

    expect(await screen.findByText('cropping IMG_1.jpg')).toBeInTheDocument();
    expect(uploadImage).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Use this crop' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://cdn.example.com/a.webp', ''));
    expect((uploadImage.mock.calls[0][0] as File).name).toBe('cropped.webp');
  });

  it('lets them use the whole picture without cropping: it is only made smaller', async () => {
    const small = new File([new Uint8Array(300_000)], 'IMG_1.webp', { type: 'image/webp' });
    prep.prepareImage.mockResolvedValue(small);
    const uploadImage = vi.fn().mockResolvedValue('https://cdn.example.com/a.webp');
    const { container } = render(<CoverImageField url={null} alt="" uploadImage={uploadImage} onChange={vi.fn()} />);
    await userEvent.upload(chooser(container), photo);
    await userEvent.click(await screen.findByRole('button', { name: 'Use the whole picture, no crop' }));
    await waitFor(() => expect(uploadImage).toHaveBeenCalledWith(small));
    expect(prep.prepareImage).toHaveBeenCalledWith(photo);
  });

  it('uploads nothing when the crop window is cancelled', async () => {
    const uploadImage = vi.fn();
    const { container } = render(<CoverImageField url={null} alt="" uploadImage={uploadImage} onChange={vi.fn()} />);
    await userEvent.upload(chooser(container), photo);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'crop' })).toBeNull();
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('offers Crop and position again once a cover was added', async () => {
    const { container, rerender } = render(<CoverImageField url={null} alt="" uploadImage={vi.fn().mockResolvedValue('https://cdn.example.com/a.webp')} onChange={vi.fn()} />);
    await userEvent.upload(chooser(container), photo);
    await userEvent.click(await screen.findByRole('button', { name: 'Use this crop' }));
    rerender(<CoverImageField url="https://cdn.example.com/a.webp" alt="" uploadImage={vi.fn()} onChange={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Crop and position' }));
    expect(await screen.findByText('cropping IMG_1.jpg')).toBeInTheDocument();
  });

  it('says what is wrong with a file it cannot use, and opens nothing', async () => {
    const uploadImage = vi.fn();
    const { container } = render(<CoverImageField url={null} alt="" uploadImage={uploadImage} onChange={vi.fn()} />);
    await userEvent.upload(chooser(container), new File(['x'], 'a.gif', { type: 'image/gif' }), { applyAccept: false });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/JPG, PNG or WebP/)));
    expect(screen.queryByRole('dialog', { name: 'crop' })).toBeNull();
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("shows the server's own message instead of a general one", async () => {
    const uploadImage = vi.fn().mockRejectedValue({ response: { data: { message: "You have reached today's limit for image uploads. Try again tomorrow." } } });
    const { container } = render(<CoverImageField url={null} alt="" uploadImage={uploadImage} onChange={vi.fn()} />);
    await userEvent.upload(chooser(container), photo);
    await userEvent.click(await screen.findByRole('button', { name: 'Use this crop' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/today's limit/)));
  });

  it('asks for alt text only as an option', () => {
    render(<CoverImageField url="https://cdn.example.com/a.webp" alt="" uploadImage={vi.fn()} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Alt text/)).toBeInTheDocument();
    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });
});
