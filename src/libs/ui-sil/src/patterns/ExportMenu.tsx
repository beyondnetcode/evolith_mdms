import { ActionMenu } from '../ActionMenu.tsx';
import type { ExportFormat } from '../export/table-export.ts';

const FORMAT_LABEL: Readonly<Record<ExportFormat, string>> = {
  csv: 'CSV (.csv)',
  xlsx: 'Excel (.xlsx)',
};

interface ExportMenuProps {
  /** Qué se exporta, para el nombre accesible del menú: «los expedientes». */
  readonly subject: string;
  readonly onExport: (format: ExportFormat) => void;
  readonly formats?: readonly ExportFormat[];
  /** En `compact` el botón pasa a botón de icono (M3: la etiqueta cede ante el ancho). */
  readonly iconOnly?: boolean;
  /** Mientras se prepara el archivo. */
  readonly busy?: boolean;
  /** Por qué no se puede exportar (p. ej. no hay filas): los formatos se ven deshabilitados con ese motivo. */
  readonly unavailableReason?: string;
  readonly className?: string;
}

/**
 * «Exportar»: botón de texto de M3 con el icono de descarga que abre un menú con los formatos. Es el mismo menú
 * de `ActionMenu` (teclado del APG, `Escape` devuelve el foco), así que cualquier pantalla con tabla lo pone
 * junto a sus acciones sin repetir lógica. Un formato deshabilitado siempre dice por qué (UX-SIL-001 §3.6).
 */
export function ExportMenu({ subject, onExport, formats = ['csv', 'xlsx'], iconOnly = false, busy = false, unavailableReason, className }: ExportMenuProps) {
  return (
    <ActionMenu
      label={busy ? `Exportando ${subject}…` : 'Exportar'}
      menuLabel={`Exportar ${subject}`}
      icon="download"
      {...(iconOnly ? {} : { text: busy ? 'Exportando…' : 'Exportar' })}
      {...(className === undefined ? {} : { className })}
      busy={busy}
      items={formats.map((format) => ({
        id: format,
        label: FORMAT_LABEL[format],
        onSelect: () => onExport(format),
        ...(unavailableReason === undefined ? {} : { disabled: true, reason: unavailableReason }),
      }))}
    />
  );
}
