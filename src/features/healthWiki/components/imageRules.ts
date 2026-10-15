import { IMAGE_TYPES, MAX_IMAGE_BYTES } from '../types';

/** Returns a message when the file cannot be used, otherwise null. */
export function validateImageFile(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Use a JPG, PNG or WebP file.';
  if (file.size > MAX_IMAGE_BYTES) {
    return `That file is ${(file.size / 1048576).toFixed(1)} MB. The limit is 2 MB.`;
  }
  return null;
}
