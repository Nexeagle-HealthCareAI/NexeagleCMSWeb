// Protected screen for the Daily Work Board (people without the work.export permission).
//
// What it does
//   Copy and cut keep working INSIDE the board, but what reaches the computer's clipboard is a
//   notice, not the content. The real content is held in this page's memory and is put back when
//   the person pastes inside the board.
//   Dragging text or pictures out, printing and "save page" are stopped.
//
// What it cannot do
//   A web page cannot stop the operating system taking a screenshot, or a phone photographing the
//   monitor. ScreenGuard covers that as far as a browser allows: the content is hidden whenever the
//   window is not the one in use, and a watermark names the signed-in person on every capture.

export const CLIPBOARD_NOTICE = 'Copying out of the NexEagle Daily Work Board is turned off.';

let held: { text: string; html: string } | null = null;
/** True while we replay a paste ourselves, so our own listener lets it through. */
let replaying = false;

type TextField = HTMLInputElement | HTMLTextAreaElement;
const isTextField = (el: Element | null): el is TextField =>
  !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && typeof (el as HTMLInputElement).selectionStart === 'number'));

function selection(): { text: string; html: string } {
  const active = document.activeElement;
  if (isTextField(active)) {
    const text = active.value.slice(active.selectionStart ?? 0, active.selectionEnd ?? 0);
    return { text, html: '' };
  }
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return { text: '', html: '' };
  const holder = document.createElement('div');
  for (let i = 0; i < sel.rangeCount; i++) holder.appendChild(sel.getRangeAt(i).cloneContents());
  return { text: sel.toString(), html: holder.innerHTML };
}

/** Copy or cut: keep the content here, hand the clipboard the notice. Returns false when nothing was selected. */
export function guardCopy(e: ClipboardEvent): boolean {
  const data = e.clipboardData;
  if (!data) return false;
  // An editor that handles the event itself (the page editor) has already put its content in.
  const own = e.defaultPrevented ? { text: data.getData('text/plain'), html: data.getData('text/html') } : null;
  const picked = own && (own.text || own.html) ? own : selection();
  if (!picked.text && !picked.html) return false;

  held = picked;
  if (e.type === 'cut' && !e.defaultPrevented) document.execCommand?.('delete');
  e.preventDefault();
  data.clearData();
  data.setData('text/plain', CLIPBOARD_NOTICE);
  return true;
}

/** Paste: when the clipboard holds our notice, put back what was copied inside the board. */
export function guardPaste(e: ClipboardEvent): boolean {
  if (replaying || !held) return false;
  if ((e.clipboardData?.getData('text/plain') || '').trim() !== CLIPBOARD_NOTICE) return false;
  e.preventDefault();
  e.stopImmediatePropagation();

  const target = e.target instanceof Element ? e.target : document.activeElement;
  const field = isTextField(document.activeElement) ? document.activeElement : null;
  if (field) {
    document.execCommand?.('insertText', false, held.text);
    return true;
  }
  // A rich editor reads the paste event itself, so give it one carrying the real content.
  try {
    const data = new DataTransfer();
    data.setData('text/plain', held.text);
    if (held.html) data.setData('text/html', held.html);
    replaying = true;
    target?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  } catch {
    document.execCommand?.('insertText', false, held.text);
  } finally {
    replaying = false;
  }
  return true;
}

/** For tests. */
export function forgetHeld(): void { held = null; }

/** Tiled watermark naming who is looking and when, as a CSS background image. */
export function watermarkImage(label: string): string {
  const safe = label.replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="300"><text x="320" y="150" text-anchor="middle" transform="rotate(-22 320 150)" font-family="system-ui,sans-serif" font-size="14" font-weight="600" fill="#667085" fill-opacity="0.16">${safe}</text></svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}
