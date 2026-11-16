/**
 * Clases de la tabla de datos de M3 (UI-SIL-001 §4.7, UI-03). M3 no tiene componente de tabla (G-136): es una
 * composición con tokens. Plana: sin caja exterior ni radio, cabecera sin fondo con un divisor de 1 dp debajo,
 * filas con divisor y un solo relleno horizontal de 16 dp en todas las tablas. Las alturas salen de los tokens de
 * componente de `theme.css` (`h-row-two-lines` 56 dp, `h-row-one-line` 48 dp, `h-table-header` 48 dp), que bajan
 * a 44, 40 y 40 dp con la densidad compacta (`data-density="compact"`).
 */
export const TABLE_STYLES = {
  /** Contenedor: sin borde ni radio; solo desplaza si no cabe (la tabla no debería desbordar). */
  wrapper: 'overflow-x-auto',
  table: 'w-full border-collapse',
  /** Fila de cabecera: el divisor decorativo de 1 dp (`outline-variant`). */
  headerRow: 'border-b border-outline-variant',
  headerCell: 'h-table-header whitespace-nowrap px-4 text-left align-middle text-title-small text-on-surface-variant',
  /** Fila de dato: divisor de 1 dp. La capa de estado y el foco hacia dentro vienen de `row-state`. */
  row: 'border-b border-outline-variant',
  /** Celdas: una línea (48 dp) o dos (56 dp). */
  cell: 'px-4 align-middle text-body-medium',
  /** Enlace de la fila: ocupa toda la fila con `::after`, así que la fila entera es el objetivo (WCAG 2.5.8). */
  rowLink:
    'text-body-medium-emphasized text-primary underline-offset-2 after:absolute after:inset-0 hover:underline focus-visible:outline-none',
  /** Segunda línea de la celda de identificador: el cliente. */
  secondaryLine: 'block truncate text-body-small text-on-surface-variant',
} as const;
