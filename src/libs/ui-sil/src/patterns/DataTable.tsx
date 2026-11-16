import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatDate, formatDateTime } from '../format.ts';
import { Icon } from '../Icon.tsx';
import { joinClasses } from '../join-classes.ts';

export type SortDirection = 'asc' | 'desc';

export interface TableSort<Column extends string> {
  readonly column: Column;
  readonly direction: SortDirection;
}

export interface TableColumn<Row, Column extends string> {
  readonly id: Column;
  readonly label: string;
  /** Cifras alineadas a la derecha (cantidades). */
  readonly align?: 'start' | 'end';
  /** Clases extra de la celda (p. ej. `whitespace-nowrap tabular-nums`). */
  readonly cellClassName?: string;
  readonly render: (row: Row) => ReactNode;
}

interface DataTableProps<Row, Column extends string> {
  /** Título de la tabla para el lector de pantalla (`caption`). */
  readonly caption: string;
  /** Nombre de la región desplazable. */
  readonly regionLabel: string;
  /** La primera columna: fija al desplazar en horizontal y con el enlace de la fila. */
  readonly keyColumn: { readonly id: Column; readonly label: string; readonly text: (row: Row) => string };
  readonly columns: ReadonlyArray<TableColumn<Row, Column>>;
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row) => string;
  /** Destino de la fila: lo abre el enlace de la primera columna y, por comodidad, el clic en la fila. */
  readonly rowHref: (row: Row) => string;
  /** `state` del historial al abrir una fila (p. ej. para que «Volver» conserve los filtros). */
  readonly rowState?: unknown;
  readonly sort: TableSort<Column> | null;
  /** El orden que se aplica cuando `sort` es `null`: lo marca el encabezado. */
  readonly defaultSort: TableSort<Column>;
  readonly onSort: (column: Column) => void;
}

/**
 * Alturas de los tokens de componente de la tabla (UI-SIL-001 §3.11): bajan con `data-density="compact"`. El
 * encabezado no se envuelve (48 dp, UI-03): si las columnas no caben, la tabla se desplaza en horizontal. El enlace
 * de la fila y el botón de orden miden 40 dp para caber en la densidad compacta (fila de 44 dp y encabezado de 40 dp);
 * la fila entera también abre el destino.
 */
const HEADER = 'h-table-header whitespace-nowrap bg-surface-container-low px-3 text-left text-title-small text-on-surface-variant';
const CELL = 'h-row-two-lines px-3 text-body-medium';
/** Primera columna fija al desplazar en horizontal, con su separador: el identificador siempre a la vista. */
const FIXED = 'sticky left-0 z-10 border-r border-outline-variant';

/** Un dato que no se informó se deja vacío, con su nombre para el lector de pantalla. */
export function EmptyCell() {
  return (
    <>
      <span aria-hidden="true" className="text-on-surface-variant">
        —
      </span>
      <span className="sr-only">Sin dato</span>
    </>
  );
}

/** Fecha arriba y hora debajo: la columna ocupa la mitad del ancho. */
export function DateTimeCell({ instant }: { readonly instant: string }) {
  return (
    <>
      <span className="block whitespace-nowrap">{formatDate(instant)}</span>
      <span className="block text-body-small text-on-surface-variant">{formatDateTime(instant).slice(-5)}</span>
    </>
  );
}

function ariaSort<Column extends string>(column: Column, sort: TableSort<Column>): 'ascending' | 'descending' | 'none' {
  if (sort.column !== column) return 'none';
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

interface HeaderCellProps<Column extends string> {
  readonly column: Column;
  readonly label: string;
  readonly sort: TableSort<Column>;
  readonly onSort: (column: Column) => void;
  readonly className?: string | false;
}

function HeaderCell<Column extends string>({ column, label, sort, onSort, className }: HeaderCellProps<Column>) {
  const direction = ariaSort(column, sort);
  return (
    <th scope="col" aria-sort={direction} className={joinClasses(HEADER, className)}>
      <button
        type="button"
        aria-label={`${label}: ordenar`}
        onClick={() => onSort(column)}
        className="state-layer -mx-2 inline-flex h-10 cursor-pointer items-center gap-1 rounded-xs px-2 text-left"
      >
        {label}
        {direction === 'none' ? (
          <span className="size-4.5" aria-hidden="true" />
        ) : (
          <Icon name={direction === 'ascending' ? 'arrow_upward' : 'arrow_downward'} className="size-4.5" />
        )}
      </button>
    </th>
  );
}

/**
 * Si queda contenido oculto a la derecha de la región desplazable. El ancho de la ventana y el
 * desplazamiento son un sistema externo: se sincronizan con un efecto y un `ResizeObserver`.
 */
function useContentToTheRight() {
  const region = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    const node = region.current;
    if (node === null) return;
    const measure = (): void => setHasMore(node.scrollLeft + node.clientWidth < node.scrollWidth - 1);
    measure();
    node.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    return () => {
      node.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, []);
  return { region, hasMore };
}

/**
 * Tabla de datos plana: composición con tokens de M3 (M3 no especifica tabla, D-021, G-136). Encabezado de
 * 48 dp, filas de 56 dp (tokens de componente con densidad), contenedor de forma `medium` y primera columna fija. La fila entera es clicable
 * mediante un enlace real en la primera columna, que sirve a teclado y a lectores de pantalla. Cada
 * encabezado ordena por su columna; si no caben, se desplaza en horizontal con una señal a la derecha.
 */
export function DataTable<Row, Column extends string>(props: DataTableProps<Row, Column>) {
  const { caption, regionLabel, keyColumn, columns, rows, rowKey, rowHref, rowState, sort, defaultSort, onSort } = props;
  const navigate = useNavigate();
  const { region, hasMore } = useContentToTheRight();
  const effective = sort ?? defaultSort;
  const openRow = (event: MouseEvent<HTMLTableRowElement>, row: Row): void => {
    if (!(event.target instanceof HTMLElement) || event.target.closest('a') === null) void navigate(rowHref(row), { state: rowState });
  };
  return (
    <div className="relative overflow-hidden rounded-md border border-outline-variant">
      {/* Región desplazable con foco de teclado: las flechas la mueven cuando la tabla no cabe (WCAG 2.1.1). */}
      <div
        ref={region}
        role="region"
        aria-label={regionLabel}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- una región que se desplaza debe poder enfocarse para moverla con el teclado (axe scrollable-region-focusable)
        tabIndex={0}
        className="overflow-x-auto focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-secondary"
      >
        <table className="w-full border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <HeaderCell column={keyColumn.id} label={keyColumn.label} sort={effective} onSort={onSort} className={FIXED} />
              {columns.map((column) => (
                <HeaderCell key={column.id} column={column.id} label={column.label} sort={effective} onSort={onSort} className={column.align === 'end' && 'text-right'} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              // El enlace de la primera columna es la vía para teclado y lector de pantalla; el clic en la fila es solo una comodidad del puntero.
              <tr
                key={rowKey(row)}
                onClick={(event) => openRow(event, row)}
                // `row-state`: capa de estado sobre toda la fila y anillo de foco hacia dentro (UI-SIL-001 §3.9).
                className="group row-state cursor-pointer border-t border-outline-variant"
              >
                <td className={joinClasses(CELL, FIXED, 'bg-surface whitespace-nowrap tabular-nums group-hover:bg-surface-container-high group-focus-within:bg-surface-container-high')}>
                  <Link to={rowHref(row)} state={rowState} className="inline-flex min-h-10 items-center text-body-medium-emphasized text-primary underline-offset-2 hover:underline">
                    {keyColumn.text(row)}
                  </Link>
                </td>
                {columns.map((column) => (
                  <td key={column.id} className={joinClasses(CELL, column.align === 'end' && 'text-right', column.cellClassName)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Señal de que hay más columnas a la derecha; desaparece al llegar al final. */}
      {hasMore && <div data-overflow="" aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-on-surface/16 to-transparent" />}
    </div>
  );
}
