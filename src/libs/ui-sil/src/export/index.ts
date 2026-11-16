/*
 * EXPORTACIÓN DE TABLAS sin dominio ni dependencias: CSV para Excel y libro .xlsx, más la descarga del
 * archivo. La reutilizan todas las pantallas con tabla; el botón es `ExportMenu` (patrones).
 */
export { toCsv, toXlsx, neutralizeFormula, columnLetter, sheetName, EXPORT_MIME_TYPE, type ExportColumn, type ExportFormat } from './table-export.ts';
export { downloadFile, exportFileName, mimeTypeOf } from './download.ts';
export { zipStore, crc32, type ZipEntry } from './zip-store.ts';
