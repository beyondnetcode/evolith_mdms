import { describe, expect, it } from 'vitest';
import { exportFileName } from './download.ts';
import { columnLetter, neutralizeFormula, sheetName, toCsv, toXlsx, type ExportColumn } from './table-export.ts';
import { crc32, zipStore } from './zip-store.ts';

const BOM = String.fromCodePoint(0xfe_ff);

interface Row {
  readonly id: string;
  readonly name: string;
}
const COLUMNS: ReadonlyArray<ExportColumn<Row>> = [
  { label: 'Expediente', value: (r) => r.id },
  { label: 'Cliente', value: (r) => r.name },
];
const ROWS: readonly Row[] = [
  { id: 'SIL-00001', name: 'Santa Sofía del Sur S.A.' },
  { id: 'SIL-00002', name: 'Pesquera "Andina"; S.A.' },
];

/** Los archivos de un ZIP sin compresión, leídos del directorio central. */
function unzip(zip: Uint8Array): Map<string, string> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.byteLength - 22;
  expect(view.getUint32(end, true)).toBe(0x06_05_4b_50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = new Map<string, string>();
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02_01_4b_50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(zip.subarray(at + 46, at + 46 + nameLength));
    const dataStart = local + 30 + view.getUint16(local + 26, true);
    const data = zip.subarray(dataStart, dataStart + size);
    expect(crc32(data)).toBe(crc);
    files.set(name, decoder.decode(data));
    at += 46 + nameLength;
  }
  return files;
}

describe('zipStore', () => {
  it('CRC-32 de referencia («123456789» → CBF43926)', () => {
    expect(crc32(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926');
  });

  it('empaqueta los archivos en su orden y se pueden leer de vuelta', () => {
    const files = unzip(zipStore([{ path: 'a.txt', content: 'hola' }, { path: 'carpeta/ñ.xml', content: '<x/>' }]));
    expect([...files.entries()]).toEqual([
      ['a.txt', 'hola'],
      ['carpeta/ñ.xml', '<x/>'],
    ]);
  });
});

describe('toCsv', () => {
  it('UTF-8 con BOM, separador «;», comillas RFC 4180 y CRLF', () => {
    expect(toCsv(COLUMNS, ROWS)).toBe(`${BOM}Expediente;Cliente\r\nSIL-00001;Santa Sofía del Sur S.A.\r\nSIL-00002;"Pesquera ""Andina""; S.A."\r\n`);
  });

  it('neutraliza un texto que la hoja tomaría por fórmula', () => {
    expect(['=1+1', '+51 999', '-3', '@SUMA', 'normal'].map(neutralizeFormula)).toEqual(["'=1+1", "'+51 999", "'-3", "'@SUMA", 'normal']);
    expect(toCsv(COLUMNS, [{ id: '=HYPERLINK("x")', name: '' }])).toContain(`"'=HYPERLINK(""x"")";`);
  });
});

describe('toXlsx', () => {
  it('es un paquete OOXML con libro, hoja y estilos bien formados', () => {
    const files = unzip(toXlsx('Bandeja de expedientes', COLUMNS, ROWS));
    expect([...files.keys()]).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']);
    for (const [name, xml] of files) {
      const parsed = new DOMParser().parseFromString(xml, 'application/xml');
      expect(parsed.getElementsByTagName('parsererror'), name).toHaveLength(0);
    }
  });

  it('la hoja lleva el encabezado en negrita y fijo, el autofiltro y cada dato como texto escapado', () => {
    const sheet = unzip(toXlsx('Bandeja', COLUMNS, ROWS)).get('xl/worksheets/sheet1.xml') ?? '';
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Expediente</t></is></c>');
    expect(sheet).toContain('state="frozen"');
    expect(sheet).toContain('<autoFilter ref="A1:B3"/>');
    expect(sheet).toContain('Pesquera &quot;Andina&quot;; S.A.');
    expect(unzip(toXlsx('Bandeja', COLUMNS, ROWS)).get('xl/workbook.xml')).toContain('<sheet name="Bandeja" sheetId="1" r:id="rId1"/>');
  });

  it('letras de columna y nombres de hoja válidos para Excel', () => {
    expect([0, 25, 26, 701].map(columnLetter)).toEqual(['A', 'Z', 'AA', 'ZZ']);
    expect(sheetName('Bandeja: [octubre]/2026 con un nombre demasiado largo')).toBe('Bandeja   octubre  2026 con un');
    expect(sheetName('  ')).toBe('Hoja1');
  });
});

describe('exportFileName', () => {
  it('base, fecha y hora de Lima y la extensión', () => {
    // 21/10/2026 19:30 UTC = 14:30 en Lima.
    expect(exportFileName('bandeja-expedientes', 'xlsx', new Date('2026-10-21T19:30:00Z'))).toBe('bandeja-expedientes-20261021-1430.xlsx');
  });
});
