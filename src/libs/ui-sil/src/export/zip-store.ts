/**
 * ZIP mínimo sin compresión («stored», método 0): lo justo para empaquetar un libro .xlsx sin dependencias
 * (no hay librería de hojas de cálculo autorizada en el frontend, S-07). Formato de PKWARE APPNOTE 6.3:
 * cabecera local + datos por archivo, directorio central y fin de directorio. Sin ZIP64: hasta 65 535
 * archivos y 4 GiB, de sobra para una exportación.
 */

export interface ZipEntry {
  /** Ruta dentro del ZIP, con `/` («xl/workbook.xml»). */
  readonly path: string;
  readonly content: Uint8Array | string;
}

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 de ISO-HDLC, el que exige el ZIP. */
export function crc32(data: Uint8Array): number {
  let crc = 0xff_ff_ff_ff;
  for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xff_ff_ff_ff) >>> 0;
}

const encoder = new TextEncoder();
const bytesOf = (content: Uint8Array | string): Uint8Array => (typeof content === 'string' ? encoder.encode(content) : content);

/** Fecha y hora fijas (1/1/1980 00:00, la mínima de MS-DOS): el mismo contenido produce el mismo ZIP. */
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;
/** Bit 11: nombres en UTF-8. */
const UTF8_FLAG = 0x08_00;

/** Empaqueta los archivos, en su orden, en un ZIP sin compresión. */
export function zipStore(entries: readonly ZipEntry[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const data = bytesOf(entry.content);
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length + data.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04_03_4b_50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, UTF8_FLAG, true);
    l.setUint16(8, 0, true);
    l.setUint16(10, DOS_TIME, true);
    l.setUint16(12, DOS_DATE, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, data.length, true);
    l.setUint32(22, data.length, true);
    l.setUint16(26, name.length, true);
    l.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02_01_4b_50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, UTF8_FLAG, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, DOS_TIME, true);
    c.setUint16(14, DOS_DATE, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);

    offset += local.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06_05_4b_50, true);
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);

  const zip = new Uint8Array(offset + centralSize + end.length);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) {
    zip.set(part, at);
    at += part.length;
  }
  return zip;
}
