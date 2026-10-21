// Builds a real Excel file (.xlsx) in the browser, with no library.
//
// An .xlsx is a zip of a few XML files. We write those files (one sheet per
// table, a bold header row that stays put when you scroll, filters on the
// header, real numbers / money / dates) and zip them up without compression.

import { localDate } from './format';

export type CellType = 'text' | 'number' | 'money' | 'date';
export type CellValue = string | number | null | undefined; // dates as ISO strings

export interface Column<T> {
  header: string;
  type?: CellType; // default 'text'
  value: (row: T) => CellValue;
}

export interface Sheet {
  name: string;
  headers: string[];
  types: CellType[];
  rows: CellValue[][];
}

/** Turns typed rows + column definitions into a sheet. */
export function sheet<T>(name: string, columns: Column<T>[], rows: T[]): Sheet {
  return {
    name,
    headers: columns.map((c) => c.header),
    types: columns.map((c) => c.type ?? 'text'),
    rows: rows.map((r) => columns.map((c) => c.value(r))),
  };
}

/** Builds the workbook and makes the browser save it as `<fileName>-<today>.xlsx`. */
export function downloadXlsx(fileName: string, sheets: Sheet[], rtl = false) {
  const blob = new Blob([buildXlsx(sheets, rtl)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = `${fileName}-${localDate()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

// ---- Workbook ----

// Style ids in styles.xml (cellXfs order below).
const STYLE = { header: 1, text: 0, number: 2, money: 3, date: 4 } as const;

export function buildXlsx(sheets: Sheet[], rtl = false): Uint8Array<ArrayBuffer> {
  const names = uniqueSheetNames(sheets.map((s) => s.name));
  const files: [string, string][] = [
    ['[Content_Types].xml', contentTypes(sheets.length)],
    ['_rels/.rels', ROOT_RELS],
    ['xl/workbook.xml', workbook(names, sheets)],
    ['xl/_rels/workbook.xml.rels', workbookRels(sheets.length)],
    ['xl/styles.xml', STYLES],
    ...sheets.map((s, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, worksheet(s, rtl)]),
  ];
  const enc = new TextEncoder();
  return zip(files.map(([path, xml]) => [path, enc.encode(xml)]));
}

function worksheet(s: Sheet, rtl: boolean): string {
  const lastCol = colName(Math.max(s.headers.length, 1) - 1);
  const lastRow = s.rows.length + 1;

  const header = `<row r="1">${s.headers.map((h, c) => textCell(`${colName(c)}1`, h, STYLE.header)).join('')}</row>`;
  const body = s.rows.map((row, r) =>
    `<row r="${r + 2}">${row.map((v, c) => cell(`${colName(c)}${r + 2}`, v, s.types[c])).join('')}</row>`,
  ).join('');

  const cols = s.headers.map((h, c) => {
    const w = columnWidth(h, s.rows.map((row) => row[c]), s.types[c]);
    return `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`;
  }).join('');

  return XML +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<dimension ref="A1:${lastCol}${lastRow}"/>` +
    `<sheetViews><sheetView workbookViewId="0"${rtl ? ' rightToLeft="1"' : ''}>` +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' +
    '</sheetView></sheetViews>' +
    `<cols>${cols}</cols>` +
    `<sheetData>${header}${body}</sheetData>` +
    `<autoFilter ref="A1:${lastCol}${lastRow}"/>` +
    '</worksheet>';
}

function cell(ref: string, v: CellValue, type: CellType): string {
  if (v === null || v === undefined || v === '') return '';
  if (type === 'date' && typeof v === 'string') {
    const serial = excelDate(v);
    return serial === null ? textCell(ref, v, STYLE.text) : `<c r="${ref}" s="${STYLE.date}"><v>${serial}</v></c>`;
  }
  if ((type === 'number' || type === 'money') && typeof v === 'number' && Number.isFinite(v)) {
    return `<c r="${ref}" s="${STYLE[type]}"><v>${v}</v></c>`;
  }
  return textCell(ref, String(v), STYLE.text);
}

// Text is stored inline, so a value like "=SUM(A1)" stays plain text, never a formula.
const textCell = (ref: string, text: string, style: number) =>
  `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${esc(text)}</t></is></c>`;

/** Excel stores a date as days since 30 Dec 1899. Uses the local calendar day, like the app. */
function excelDate(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

function columnWidth(header: string, values: CellValue[], type: CellType): number {
  const len = (v: CellValue) => (type === 'date' ? 11 : type === 'money' ? String(v ?? '').length + 4 : String(v ?? '').length);
  const longest = Math.max(header.length + 2, ...values.slice(0, 500).map(len)); // +2 for the filter arrow
  return Math.min(Math.max(longest + 2, 8), 60);
}

/** 0 → A, 25 → Z, 26 → AA. */
function colName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Excel sheet names: max 31 chars, none of []:*?/\ , and unique (case-insensitive). */
function uniqueSheetNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((raw) => {
    const base = (raw.replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim() || 'Sheet').slice(0, 31);
    let name = base;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 31 - String(i).length - 1)} ${i}`;
    used.add(name.toLowerCase());
    return name;
  });
}

// Escapes XML and drops control characters XML can't hold.
const esc = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // eslint-disable-line no-control-regex
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- The fixed XML parts ----

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const contentTypes = (n: number) => XML +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  Array.from({ length: n }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('') +
  '</Types>';

const ROOT_RELS = XML +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

function workbook(names: string[], sheets: Sheet[]): string {
  // The filter range has to be named too, or Excel drops the filter buttons.
  const filters = sheets.map((s, i) =>
    `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">` +
    `'${esc(names[i].replace(/'/g, "''"))}'!$A$1:$${colName(Math.max(s.headers.length, 1) - 1)}$${s.rows.length + 1}</definedName>`,
  ).join('');
  return XML +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
    `<definedNames>${filters}</definedNames>` +
    '</workbook>';
}

const workbookRels = (n: number) => XML +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  Array.from({ length: n }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join('') +
  `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  '</Relationships>';

// cellXfs: 0 text, 1 header (bold, light fill, line below), 2 number, 3 money ($1,234.50), 4 date (22 Sep 2026)
const STYLES = XML +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="dd mmm yyyy"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFEDEBFF"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left/><right/><top/><bottom style="thin"><color rgb="FF7C6CFF"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="5">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

// ---- Zip (stored, no compression) ----

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(entries: [string, Uint8Array][]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const [path, data] of entries) {
    const name = enc.encode(path);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // local file header
    local.setUint16(4, 20, true);         // version needed
    local.setUint16(6, 0x0800, true);     // UTF-8 names
    local.setUint16(8, 0, true);          // stored
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, data);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);   // central directory header
    dir.setUint16(4, 20, true);           // made by
    dir.setUint16(6, 20, true);           // version needed
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint16(12, dosTime, true);
    dir.setUint16(14, dosDate, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);      // where the local header starts
    central.push(new Uint8Array(dir.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const dirSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);     // end of central directory
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, dirSize, true);
  end.setUint32(16, offset, true);

  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) { out.set(p, at); at += p.length; }
  return out;
}
