import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReferenceText } from './ReferenceText';

describe('ReferenceText', () => {
  it('keeps plain text as text', () => {
    render(<p><ReferenceText text="ICMR guideline, 2023" /></p>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('ICMR guideline, 2023')).toBeTruthy();
  });

  it('turns [words](address) into a link that shows the words', () => {
    render(<p><ReferenceText text="See [WHO factsheet](https://www.who.int/x) for more" /></p>);
    const a = screen.getByRole('link', { name: 'WHO factsheet' });
    expect(a.getAttribute('href')).toBe('https://www.who.int/x');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toContain('noopener');
  });

  it('links a bare address but leaves the closing full stop out of it', () => {
    render(<p><ReferenceText text="Source: https://example.org/a/b." /></p>);
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://example.org/a/b');
  });

  it('never links javascript: or other schemes', () => {
    render(<p><ReferenceText text="[x](javascript:alert(1)) and ftp://a.b" /></p>);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
