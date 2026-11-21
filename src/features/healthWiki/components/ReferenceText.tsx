import type { ReactNode } from 'react';

// One reference line, with its web addresses made clickable. Two ways to write a link, both plain text:
//   [WHO prostate cancer factsheet](https://www.who.int/...)     shows the words, links to the address
//   https://www.who.int/...                                     a bare address links to itself
// Only http and https become links; anything else stays text.
const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"]+)/gi;

export function ReferenceText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(LINK)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    let label = m[1];
    let href = m[2] ?? m[3];
    let tail = '';
    if (!m[2]) {
      // A bare address often ends the sentence: keep the full stop or bracket out of the link.
      const trimmed = href.replace(/[.,;:!?)\]]+$/, '');
      tail = href.slice(trimmed.length);
      href = trimmed;
      label = href;
    }
    out.push(<a key={key++} href={href} target="_blank" rel="noopener noreferrer nofollow ugc">{label}</a>);
    if (tail) out.push(tail);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
