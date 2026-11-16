/**
 * Clases de las tablas de sección de la ficha (UI-MDM-001 §3.3; DV-01): filas de una línea de 48 dp, cabecera
 * `title-small` sobre `surface-container-low` y celdas `body-medium`. Solo tokens de `ui-tokens`.
 */
export const SECTION_TABLE = {
  frame: 'overflow-x-auto rounded-md border border-outline-variant',
  table: 'w-full border-collapse',
  headerCell: 'h-12 whitespace-nowrap bg-surface-container-low px-3 text-left text-title-small text-on-surface-variant',
  row: 'h-12 border-t border-outline-variant',
  cell: 'px-3 text-body-medium',
  actionsCell: 'w-14 px-1 text-right',
} as const;
