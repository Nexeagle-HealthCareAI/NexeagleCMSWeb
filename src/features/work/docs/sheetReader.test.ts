import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { cellRef, columnName, readCsv } from './sheetReader';
import { excelDate, isDateFormat, readXlsx } from './xlsxReader';

const WB = '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';

async function workbook(): Promise<ArrayBuffer> {
  const z = new JSZip();
  z.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  z.file('xl/workbook.xml', `${WB}<sheets><sheet name="Leads" sheetId="1" r:id="rId1"/><sheet name="Notes" sheetId="2" state="hidden" r:id="rId2"/><sheet name="Secret" sheetId="3" state="veryHidden" r:id="rId3"/></sheets></workbook>`);
  z.file('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="x/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="x/worksheet" Target="worksheets/sheet3.xml"/></Relationships>');
  z.file('xl/sharedStrings.xml', '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Hospital</t></si><si><r><t>Purnia </t></r><r><t>City</t></r><rPh><t>x</t></rPh></si><si><t>&lt;b&gt;not html&lt;/b&gt;</t></si></sst>');
  z.file('xl/styles.xml', '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="&quot;₹&quot;#,##0.00"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="10"/><xf numFmtId="165"/><xf numFmtId="14"/></cellXfs></styleSheet>');
  z.file('xl/worksheets/sheet1.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
    + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>Joined</t></is></c></row>'
    + '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>0.125</v></c><c r="B2" s="2"><v>0.125</v></c><c r="C2" s="1"><v>46354</v></c><c r="D2" s="3"><v>1234567.5</v></c><c r="E2" t="b"><v>1</v></c><c r="F2" t="str"><f>A1&amp;"x"</f><v>Hospitalx</v></c></row>'
    + '<row r="4"><c r="A4" t="s"><v>2</v></c><c r="B4"><v>3.14159265358979</v></c><c r="C4" s="4"><v>46354</v></c></row>'
    + '<row r="5"></row></sheetData></worksheet>');
  z.file('xl/worksheets/sheet2.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>');
  z.file('xl/worksheets/sheet3.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>never shown</t></is></c></row></sheetData></worksheet>');
  return z.generateAsync({ type: 'arraybuffer' });
}

describe('spreadsheet preview', () => {
  it('reads each visible sheet with its values formatted the way the cells say', async () => {
    const sheets = await readXlsx(await workbook());
    expect(sheets.map(s => [s.name, s.hidden])).toEqual([['Leads', false], ['Notes', true]]);
    const [leads] = sheets;
    expect(leads.columns).toBe(6);
    expect(leads.rows).toEqual([
      ['Hospital', '', 'Joined', '', '', ''],
      ['Purnia City', '12.50%', '28 Nov 2026', '₹12,34,567.50', 'TRUE', 'Hospitalx'],
      ['', '', '', '', '', ''],
      ['<b>not html</b>', '3.14159265359', '28 Nov 2026', '', '', ''],
    ]);
    expect(sheets[1].rows).toEqual([]);
  });

  it('refuses a file that is not a workbook', async () => {
    const z = new JSZip();
    z.file('hello.txt', 'hi');
    await expect(readXlsx(await z.generateAsync({ type: 'arraybuffer' }))).rejects.toThrow();
  });

  it('knows cells, columns and date formats', () => {
    expect(cellRef('AB12')).toEqual([11, 27]);
    expect(columnName(0)).toBe('A');
    expect(columnName(27)).toBe('AB');
    expect(isDateFormat('dd/mm/yyyy hh:mm')).toBe(true);
    expect(isDateFormat('#,##0.00')).toBe(false);
    expect(isDateFormat('"Days: "0')).toBe(false);
    expect(excelDate(46354.5, false, true)).toBe('28 Nov 2026, 12:00');
    expect(excelDate(44892, true, false)).toBe('28 Nov 2026');
  });

  it('reads CSV with quotes, commas and line breaks inside cells, and semicolon files', () => {
    expect(readCsv('﻿Name,Note\r\n"Rao, A.","said ""hi""\nthen left"\r\nB,\n').rows).toEqual([['Name', 'Note'], ['Rao, A.', 'said "hi"\nthen left'], ['B', '']]);
    expect(readCsv('a;b;c\n1;2;3').rows).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });
});
