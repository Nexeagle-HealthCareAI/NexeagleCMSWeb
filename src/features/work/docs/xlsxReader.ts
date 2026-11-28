import JSZip from 'jszip';
import { MAX_COLUMNS, MAX_ROWS, cellRef, type Sheet } from './sheetReader';

// Reads an Excel workbook (.xlsx, .xlsm) in the browser for the Docs board: each sheet's values as text,
// with numbers, percentages and dates shown the way their cell format asks. Never formulas or macros.

const MAX_SHEET_XML = 40_000_000;
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const xml = (text: string): Document => new DOMParser().parseFromString(text, 'application/xml');
const kids = (el: Element | Document, tag: string): Element[] => Array.from(el.getElementsByTagName(tag));
const first = (el: Element | Document, tag: string): Element | null => el.getElementsByTagName(tag)[0] ?? null;

// ── number formats ───────────────────────────────────────────────────────

const BUILTIN_DATES = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
const BUILTIN: Record<number, string> = { 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 49: '@' };

/** Whether a format code shows a date or time (letters outside quotes, brackets and escapes). */
export function isDateFormat(code: string): boolean {
  const bare = code.split(';')[0].replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
  return /[dmyhs]/i.test(bare) && !/^[#0.,%E+-]*$/i.test(bare);
}

/** An Excel date number as text, the way Indian users read it: 28 Nov 2026, with the time when there is one. */
export function excelDate(serial: number, date1904: boolean, withTime: boolean): string {
  // 25569 = Excel's day number for 1 Jan 1970 (it counts 1900 as a leap year); 24107 in the 1904 system.
  const ms = Math.round((serial - (date1904 ? 24107 : 25569)) * 86_400_000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(serial);
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  if (!withTime) return day;
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return serial < 1 ? time : `${day}, ${time}`;
}

function formatNumber(v: number, code: string | undefined, date1904: boolean): string {
  if (code && isDateFormat(code)) return excelDate(v, date1904, /[hs]/i.test(code.replace(/"[^"]*"/g, '')));
  const section = (code ?? '').split(';')[0];
  const percent = section.includes('%');
  const n = percent ? v * 100 : v;
  const decimals = /\.(0+)/.exec(section)?.[1].length;
  const grouped = section.includes(',');
  let text: string;
  if (decimals !== undefined || grouped) {
    text = n.toLocaleString('en-IN', { minimumFractionDigits: decimals ?? 0, maximumFractionDigits: decimals ?? 0, useGrouping: grouped });
  } else {
    text = Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(12)));
  }
  // Text around the number in the format: currency symbols (₹, [$₹-4009]) and quoted words.
  const tidy = (part: string) => part.replace(/\[\$([^\]-]*)[^\]]*\]/g, '$1').replace(/\[[^\]]*\]/g, '').replace(/[_*]./g, '').replace(/["\\]/g, '');
  const firstDigit = section.search(/[0#?]/);
  const lastDigit = Math.max(section.lastIndexOf('0'), section.lastIndexOf('#'), section.lastIndexOf('?'));
  const before = firstDigit > 0 ? tidy(section.slice(0, firstDigit)) : '';
  const after = lastDigit >= 0 ? tidy(section.slice(lastDigit + 1)).replace('%', '') : '';
  const sign = text.startsWith('-') && before ? '-' : '';
  const body = sign ? text.slice(1) : text;
  return `${sign}${before}${body}${percent ? '%' : ''}${after}`;
}

// ── .xlsx ────────────────────────────────────────────────────────────────

function textOf(el: Element): string {
  // Rich text keeps its words in several <t> runs; phonetic hints (<rPh>) are not part of the value.
  return kids(el, 't').filter(t => t.parentElement?.tagName !== 'rPh').map(t => t.textContent ?? '').join('');
}

function resolve(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const p of target.split('/')) { if (p === '..') parts.pop(); else if (p !== '.') parts.push(p); }
  return parts.join('/');
}

export async function readXlsx(data: ArrayBuffer): Promise<Sheet[]> {
  const zip = await JSZip.loadAsync(data);
  const read = async (path: string) => (await zip.file(path)?.async('string')) ?? null;

  const rootRels = await read('_rels/.rels');
  const bookPath = (rootRels && kids(xml(rootRels), 'Relationship').find(r => r.getAttribute('Type')?.endsWith('/officeDocument'))?.getAttribute('Target')?.replace(/^\//, '')) || 'xl/workbook.xml';
  const bookText = await read(bookPath);
  if (!bookText) throw new Error('This is not an Excel workbook.');
  const book = xml(bookText);
  const date1904 = ['1', 'true'].includes(first(book, 'workbookPr')?.getAttribute('date1904') ?? '');

  const relsText = await read(bookPath.replace(/[^/]+$/, m => `_rels/${m}.rels`));
  const targets = new Map<string, string>();
  if (relsText) for (const r of kids(xml(relsText), 'Relationship')) targets.set(r.getAttribute('Id') ?? '', resolve(bookPath, r.getAttribute('Target') ?? ''));

  const shared: string[] = [];
  const sharedText = await read(resolve(bookPath, 'sharedStrings.xml'));
  if (sharedText) for (const si of kids(xml(sharedText), 'si')) shared.push(textOf(si));

  // Each cell style points at a number format; dates are numbers with a date format.
  const formats: (string | undefined)[] = [];
  const stylesText = await read(resolve(bookPath, 'styles.xml'));
  if (stylesText) {
    const styles = xml(stylesText);
    const custom = new Map<number, string>();
    for (const f of kids(styles, 'numFmt')) custom.set(Number(f.getAttribute('numFmtId')), f.getAttribute('formatCode') ?? '');
    const xfs = first(styles, 'cellXfs');
    for (const xf of xfs ? kids(xfs, 'xf') : []) {
      const id = Number(xf.getAttribute('numFmtId') ?? 0);
      formats.push(custom.get(id) ?? (BUILTIN_DATES.has(id) ? 'd mmm yyyy' : BUILTIN[id]));
    }
  }

  const sheets: Sheet[] = [];
  for (const s of kids(book, 'sheet')) {
    const state = s.getAttribute('state');
    if (state === 'veryHidden') continue;
    const name = s.getAttribute('name') ?? `Sheet ${sheets.length + 1}`;
    const path = targets.get(s.getAttributeNS(NS_REL, 'id') ?? s.getAttribute('r:id') ?? '');
    const file = path ? zip.file(path) : null;
    if (!file) continue;
    const text = await file.async('string');
    if (text.length > MAX_SHEET_XML) { sheets.push({ name, rows: [], columns: 0, truncated: true, hidden: state === 'hidden' }); continue; }

    const rows: string[][] = [];
    let columns = 0;
    let truncated = false;
    let nextRow = 0;
    for (const row of kids(xml(text), 'row')) {
      const r = Number(row.getAttribute('r') ?? nextRow + 1) - 1;
      nextRow = r + 1;
      if (r >= MAX_ROWS) { truncated = true; break; }
      let nextCol = 0;
      for (const c of kids(row, 'c')) {
        const at = cellRef(c.getAttribute('r') ?? '') ?? [r, nextCol];
        const col = at[1];
        nextCol = col + 1;
        if (col >= MAX_COLUMNS) { truncated = true; continue; }
        const t = c.getAttribute('t');
        const v = first(c, 'v')?.textContent ?? '';
        let value: string;
        if (t === 's') value = shared[Number(v)] ?? '';
        else if (t === 'inlineStr') value = (first(c, 'is') && textOf(first(c, 'is')!)) || '';
        else if (t === 'str' || t === 'e') value = v;
        else if (t === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
        else if (t === 'd') value = v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        else value = v === '' ? '' : formatNumber(Number(v), formats[Number(c.getAttribute('s') ?? 0)], date1904);
        if (value === '') continue;
        while (rows.length <= r) rows.push([]);
        rows[r][col] = value;
        columns = Math.max(columns, col + 1);
      }
    }
    // Fill the gaps so every row has the same cells; drop empty rows at the end.
    while (rows.length && rows[rows.length - 1].every(x => !x)) rows.pop();
    sheets.push({ name, rows: rows.map(row => Array.from({ length: columns }, (_, i) => row[i] ?? '')), columns, truncated, hidden: state === 'hidden' });
  }
  if (!sheets.length) throw new Error('The workbook has no sheets to show.');
  return sheets;
}

