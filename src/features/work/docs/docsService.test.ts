import { describe, expect, it } from 'vitest';
import { readBlobError } from './docsService';
import { errorMessage } from '../services/workService';

describe('reading the API\'s reason when a file cannot be fetched', () => {
  it('turns a JSON body that arrived as bytes back into a message', async () => {
    const body = new Blob([JSON.stringify({ success: false, message: 'The file could not be opened: no read access.' })], { type: 'application/json' });
    const e = await readBlobError({ response: { status: 503, data: body } });
    expect(errorMessage(e, 'Could not open this file.')).toBe('The file could not be opened: no read access.');
  });

  it('falls back to the plain message when the body is not JSON', async () => {
    const e = await readBlobError({ response: { status: 502, data: new Blob(['<html>Bad gateway</html>']) } });
    expect(errorMessage(e, 'Could not open this file.')).toBe('Could not open this file.');
  });

  it('leaves other errors as they are', async () => {
    const e = new Error('Network Error');
    expect(await readBlobError(e)).toBe(e);
  });
});
