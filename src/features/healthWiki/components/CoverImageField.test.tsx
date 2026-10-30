import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
const prep = vi.hoisted(() => ({ prepareImage: vi.fn() }));
vi.mock('./prepareImage', async (orig) => ({ ...(await orig<typeof import('./prepareImage')>()), prepareImage: prep.prepareImage }));

import CoverImageField from './CoverImageField';
import { ImageProblem } from './prepareImage';

const photo = new File([new Uint8Array(8_000_000)], 'IMG_1.jpg', { type: 'image/jpeg' });
const chooser = (c: HTMLElement) => c.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(() => vi.clearAllMocks());

describe('CoverImageField', () => {
  it('makes a big photo small, then uploads that', async () => {
    const small = new File([new Uint8Array(300_000)], 'IMG_1.webp', { type: 'image/webp' });
    prep.prepareImage.mockResolvedValue(small);
    const uploadImage = vi.fn().mockResolvedValue('https://cdn.example.com/a.webp');
    const onChange = vi.fn();
    const { container } = render(<CoverImageField url={null} alt="" uploadImage={uploadImage} onChange={onChange} />);
    await userEvent.upload(chooser(container), photo);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://cdn.example.com/a.webp', ''));
    expect(prep.prepareImage).toHaveBeenCalledWith(photo);
    expect(uploadImage).toHaveBeenCalledWith(small);
  });

  it('says what is wrong with a picture it cannot use, and uploads nothing', async () => {
    prep.prepareImage.mockRejectedValue(new ImageProblem('Use a JPG, PNG or WebP picture, or an iPhone (HEIC) photo.'));
    const uploadImage = vi.fn();
    const { container } = render(<CoverImageField url={null} alt="" uploadImage={uploadImage} onChange={vi.fn()} />);
    await userEvent.upload(chooser(container), new File(['x'], 'a.gif', { type: 'image/gif' }), { applyAccept: false });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/JPG, PNG or WebP/)));
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("shows the server's own message instead of a general one", async () => {
    prep.prepareImage.mockResolvedValue(photo);
    const uploadImage = vi.fn().mockRejectedValue({ response: { data: { message: "You have reached today's limit for image uploads. Try again tomorrow." } } });
    const { container } = render(<CoverImageField url={null} alt="" uploadImage={uploadImage} onChange={vi.fn()} />);
    await userEvent.upload(chooser(container), photo);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/today's limit/)));
  });

  it('asks for alt text only as an option', () => {
    render(<CoverImageField url="https://cdn.example.com/a.webp" alt="" uploadImage={vi.fn()} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Alt text/)).toBeInTheDocument();
    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });
});
