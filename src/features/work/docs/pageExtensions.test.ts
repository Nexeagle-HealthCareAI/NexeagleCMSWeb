import { describe, expect, it } from 'vitest';
import { cleanPage, filterSlash } from './pageExtensions';

interface Node { attrs?: Record<string, unknown>; marks?: unknown[]; content?: Node[] }

describe('Docs page building blocks', () => {
  it('keeps only palette colours, known callout tones and alignments in a saved page', () => {
    const page = {
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { textAlign: 'center' }, content: [
          { type: 'text', text: 'blue', marks: [{ type: 'textStyle', attrs: { color: '#1570EF' } }, { type: 'bold' }] },
          { type: 'text', text: 'sneaky', marks: [{ type: 'textStyle', attrs: { color: 'red;background:url(x)' } }] },
          { type: 'text', text: 'mark', marks: [{ type: 'highlight', attrs: { color: '#FEF08A' } }] },
          { type: 'text', text: 'odd mark', marks: [{ type: 'highlight', attrs: { color: 'expression(1)' } }] },
        ] },
        { type: 'paragraph', attrs: { textAlign: 'left; color: red' } },
        { type: 'callout', attrs: { tone: 'party' }, content: [{ type: 'paragraph' }] },
      ],
    };
    const out = cleanPage(page) as Node;
    const blocks = out.content!;
    const texts = blocks[0].content!;
    expect(texts[0].marks).toEqual([{ type: 'textStyle', attrs: { color: '#1570EF' } }, { type: 'bold' }]);
    expect(texts[1].marks).toEqual([]);
    expect(texts[2].marks).toEqual([{ type: 'highlight', attrs: { color: '#FEF08A' } }]);
    expect(texts[3].marks).toEqual([{ type: 'highlight', attrs: { color: null } }]);
    expect(blocks[0].attrs).toEqual({ textAlign: 'center' });
    expect(blocks[1].attrs).toEqual({ textAlign: null });
    expect(blocks[2].attrs).toEqual({ tone: 'note' });
  });

  it('finds blocks in the "/" menu by name or by what people call them', () => {
    expect(filterSlash('').length).toBeGreaterThan(10);
    expect(filterSlash('warn').map(i => i.key)).toEqual(['callout-warning']);
    expect(filterSlash('todo').map(i => i.key)).toEqual(['task']);
    expect(filterSlash('divider').map(i => i.key)).toEqual(['rule']);
    expect(filterSlash('zzz')).toEqual([]);
  });
});
