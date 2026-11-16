import { Icon, IconButton, SelectionMenu } from '@sil/ui';

interface Props<S extends number> {
  readonly page: number;
  readonly pageSize: S;
  readonly pageSizes: readonly S[];
  readonly totalCount: number;
  readonly totalPages: number;
  readonly onPage: (page: number) => void;
  readonly onPageSize: (pageSize: S) => void;
}

/** «1–20 de 134». */
export function rangeText(page: number, pageSize: number, totalCount: number): string {
  if (totalCount === 0) return '0 de 0';
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  return `${from}–${to} de ${totalCount}`;
}

/**
 * Paginación (composición; M3 no la especifica): «Filas por página», rango y «Página anterior/siguiente». El
 * número de resultados ya se anuncia en la región de estado de la pantalla: el rango no se anuncia otra vez.
 * `Pagination` de SIL no se puede importar (frontera D-026); propuesto para `ui-sil` (G-580).
 */
export function Pagination<S extends number>({ page, pageSize, pageSizes, totalCount, totalPages, onPage, onPageSize }: Props<S>) {
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
      <span className="text-body-small text-on-surface-variant">Filas por página</span>
      <SelectionMenu label="Filas por página" options={pageSizes} value={pageSize} onChange={onPageSize} />
      <p className="text-body-small text-on-surface-variant tabular-nums">{rangeText(page, pageSize, totalCount)}</p>
      <div className="flex">
        <IconButton aria-label="Página anterior" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <Icon name="navigate_before" />
        </IconButton>
        <IconButton aria-label="Página siguiente" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          <Icon name="navigate_next" />
        </IconButton>
      </div>
    </nav>
  );
}
