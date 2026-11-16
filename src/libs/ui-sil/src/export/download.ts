import { nowInLima } from '../dates.ts';
import { EXPORT_MIME_TYPE, type ExportFormat } from './table-export.ts';

/**
 * Entrega un archivo generado en el navegador: un `Blob` con su tipo, un enlace `download` temporal y la URL
 * revocada después. Nada sale del navegador ni pasa por un servidor.
 */
export function downloadFile(content: Uint8Array | string, fileName: string, mimeType: string): void {
  const blob = new Blob([content as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  // La descarga ya tomó la URL; se libera en la siguiente vuelta para no cortarla en navegadores lentos.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** `bandeja-expedientes-20261021-1430.xlsx`: base, fecha y hora de Lima y la extensión del formato. */
export function exportFileName(base: string, format: ExportFormat, now: Date = new Date()): string {
  const { date, time } = nowInLima(now);
  return `${base}-${date.replaceAll('-', '')}-${time.replace(':', '')}.${format}`;
}

/** El tipo de contenido de cada formato, para `downloadFile`. */
export const mimeTypeOf = (format: ExportFormat): string => EXPORT_MIME_TYPE[format];
