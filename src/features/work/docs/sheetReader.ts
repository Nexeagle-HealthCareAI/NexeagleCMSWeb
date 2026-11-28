// Spreadsheets in the Docs board: CSV reading and shared helpers here; Excel in xlsxReader.ts (loaded when needed).
// Reads a spreadsheet in the browser so the Docs board can show it: Excel workbooks (.xlsx, .xlsm) and CSV.
// Only the values are read, never formulas or macros, and they are shown as plain text in a table.
// The old binary .xls format is not readable here.

export interface Sheet { name: string; rows: string[][]; columns: number; truncated: boolean; hidden: boolean }

/** Enough to read any normal sheet without freezing the page on a huge one. */
export const MAX_ROWS = 2000;
export const MAX_COLUMNS = 60;

/** "B12" → [11, 1] (row, column), both counted from 0. */
export function cellRef(ref: string): [number, number] | null {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return [Number(m[2]) - 1, col - 1];
}

/** 0 → "A", 27 → "AB". */
export function columnName(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// ── .csv ─────────────────────────────────────────────────────────────────

/** CSV as rows, with quoted fields, doubled quotes and line breaks inside quotes. Tabs or semicolons work too. */
export function readCsv(text: string): Sheet {
  const body = text.replace(/^\uFEFF/, '');
  const head = body.slice(0, 2000);
  const sep = [',', ';', '\t'].map(s => [s, head.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let truncated = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"') { if (body[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && body[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
      if (rows.length >= MAX_ROWS) { truncated = i < body.length - 1; break; }
    } else cell += ch;
  }
  if (!truncated && (cell !== '' || row.length)) { row.push(cell); rows.push(row); }
  const columns = Math.min(MAX_COLUMNS, Math.max(0, ...rows.map(r => r.length)));
  if (rows.some(r => r.length > MAX_COLUMNS)) truncated = true;
  return { name: 'Sheet', rows: rows.map(r => Array.from({ length: columns }, (_, i) => r[i] ?? '')), columns, truncated, hidden: false };
}
