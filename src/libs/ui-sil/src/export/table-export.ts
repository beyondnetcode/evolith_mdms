import { zipStore } from './zip-store.ts';

/**
 * Exportación de tablas sin dominio: cualquier pantalla con una tabla (bandeja, servicios planificados…) define
 * sus columnas como texto y obtiene un CSV o un libro de Excel. Los valores ya vienen formateados para leerse
 * (fechas en hora de Lima, estados con su nombre): el archivo muestra lo mismo que la tabla.
 */
export interface ExportColumn<T> {
  readonly label: string;
  /** El valor tal como se lee; texto vacío si no hay dato. */
  readonly value: (row: T) => string;
}

export type ExportFormat = 'csv' | 'xlsx';

export const EXPORT_MIME_TYPE: Readonly<Record<ExportFormat, string>> = {
  csv: 'text/csv;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * Un texto que una hoja de cálculo tomaría por fórmula (`=`, `+`, `-`, `@`, tabulador o retorno al inicio)
 * se escribe con un apóstrofo delante: así un dato digitado («=HYPERLINK(…)») nunca se ejecuta al abrir el
 * archivo (inyección de fórmulas, OWASP A03).
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

const quote = (value: string): string => (/[";\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);

/** Marca de orden de bytes de UTF-8: Excel la usa para leer el archivo como UTF-8. */
const BOM = String.fromCodePoint(0xfe_ff);

/**
 * CSV para Excel en español: UTF-8 con BOM (las tildes se leen bien), separador `;` (la coma es el separador
 * decimal de `es-PE` en Excel), comillas según RFC 4180 y fin de línea CRLF.
 */
export function toCsv<T>(columns: ReadonlyArray<ExportColumn<T>>, rows: readonly T[]): string {
  const line = (cells: readonly string[]): string => cells.map((cell) => quote(neutralizeFormula(cell))).join(';');
  const lines = [line(columns.map((c) => c.label)), ...rows.map((row) => line(columns.map((c) => c.value(row))))];
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    // Caracteres de control que XML 1.0 no admite.
    // eslint-disable-next-line no-control-regex -- se quitan justamente los caracteres de control
    .replaceAll(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/** «A», «B», … «Z», «AA»: la letra de la columna `index` (desde 0). */
export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rest = (n - 1) % 26;
    letters = String.fromCodePoint(65 + rest) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Ancho aproximado de cada columna, en caracteres: el texto más largo entre 8 y 60. */
function widths<T>(columns: ReadonlyArray<ExportColumn<T>>, rows: readonly T[]): number[] {
  return columns.map((column) => Math.min(60, Math.max(8, column.label.length, ...rows.map((row) => column.value(row).length)) + 2));
}

function sheetXml<T>(columns: ReadonlyArray<ExportColumn<T>>, rows: readonly T[]): string {
  const cell = (ref: string, value: string, header: boolean): string =>
    value === '' && !header ? '' : `<c r="${ref}" t="inlineStr"${header ? ' s="1"' : ''}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  const row = (index: number, values: readonly string[], header: boolean): string =>
    `<row r="${index}">${values.map((value, c) => cell(`${columnLetter(c)}${index}`, value, header)).join('')}</row>`;
  const last = `${columnLetter(Math.max(0, columns.length - 1))}${rows.length + 1}`;
  const cols = widths(columns, rows)
    .map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`)
    .join('');
  return (
    `${XML_HEAD}<worksheet xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">` +
    // El encabezado queda fijo al desplazarse.
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols><sheetData>` +
    row(
      1,
      columns.map((c) => c.label),
      true,
    ) +
    rows.map((r, i) => row(i + 2, columns.map((c) => c.value(r)), false)).join('') +
    `</sheetData><autoFilter ref="A1:${last}"/></worksheet>`
  );
}

/** Un nombre de hoja válido para Excel: sin `[]:*?/\` y hasta 31 caracteres. */
export function sheetName(name: string): string {
  const clean = name.replaceAll(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31).trim();
  return clean === '' ? 'Hoja1' : clean;
}

/**
 * Libro de Excel (.xlsx, Office Open XML) con una hoja: encabezado en negrita y fijo, autofiltro, anchos según
 * el contenido y cada celda como texto, tal como se lee en la tabla. Sin dependencias: XML + `zipStore`.
 */
export function toXlsx<T>(name: string, columns: ReadonlyArray<ExportColumn<T>>, rows: readonly T[]): Uint8Array {
  const sheet = escapeXml(sheetName(name));
  return zipStore([
    {
      path: '[Content_Types].xml',
      content:
        `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    },
    {
      path: '_rels/.rels',
      content:
        `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    },
    {
      path: 'xl/workbook.xml',
      content:
        `${XML_HEAD}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheets><sheet name="${sheet}" sheetId="1" r:id="rId1"/></sheets>` +
        // El autofiltro necesita su nombre definido para que Excel lo muestre activo.
        `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${sheet.replaceAll("'", "''")}'!$A$1:$${columnLetter(Math.max(0, columns.length - 1))}$${rows.length + 1}</definedName></definedNames></workbook>`,
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      content:
        `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>',
    },
    {
      path: 'xl/styles.xml',
      content:
        `${XML_HEAD}<styleSheet xmlns="${MAIN_NS}">` +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        '</styleSheet>',
    },
    { path: 'xl/worksheets/sheet1.xml', content: sheetXml(columns, rows) },
  ]);
}
