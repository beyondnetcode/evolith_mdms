import { PARTY_STATUSES, type IdentifierFilter, type PartyPage } from '@mdm/contracts';
import { Button, Icon, LoadError, LoadingBar, SelectField, Skeleton, useDocumentTitle, useWindowSizeClass } from '@sil/ui';
import type { WindowSizeClass } from '@sil/ui-tokens';
import { useQuery } from '@tanstack/react-query';
import { useId, useMemo, useState } from 'react';
import { useMdmGateway } from '../../../application/gateway-context.ts';
import { mdmQueries } from '../../../application/queries.ts';
import { useMdmSession } from '../../../application/session-context.ts';
import { PAGE_SIZES, hasFilters, nextSort, toPartyQuery, toSearchParams, type OrganizationSearch } from '../../../domain/organization-search.ts';
import { PARTY_STATUS_DISPLAY } from '../../common/PartyStatusTag.tsx';
import { Pagination } from '../../common/Pagination.tsx';
import { SearchBar } from '../../common/SearchBar.tsx';
import { MDM_TITLE_SUFFIX } from '../../mdm-roots.ts';
import { IdentifierSearch } from './IdentifierSearch.tsx';
import { OrganizationCardList } from './OrganizationCardList.tsx';
import { OrganizationsEmpty } from './OrganizationsEmpty.tsx';
import { OrganizationsTable } from './OrganizationsTable.tsx';
import type { RoleNames } from './organization-display.ts';
import { ORGANIZATIONS_TEXTS as T } from './texts.ts';
import { useOrganizationSearch } from './use-organization-search.ts';

/** Estado de la consulta de resultados como unión discriminada: la pantalla pinta exactamente uno. */
type ResultsView =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly error: unknown }
  | { readonly kind: 'empty'; readonly page: PartyPage }
  | { readonly kind: 'results'; readonly page: PartyPage };

function resultsView(data: PartyPage | undefined, error: unknown, isError: boolean): ResultsView {
  // Ante un fallo nunca se muestra la página anterior como si fuera la actual (UX-MDM-001 §5.3).
  if (isError) return { kind: 'error', error };
  if (data === undefined) return { kind: 'loading' };
  return data.totalCount === 0 ? { kind: 'empty', page: data } : { kind: 'results', page: data };
}

/** En `compact` la lista crece con «Cargar más»: se pide la primera página con un tamaño creciente (hasta 100). */
const COMPACT_STEP = 20;
const MAX_COMPACT = 100;

function useRoleNames(): { readonly names: RoleNames; readonly options: ReadonlyArray<{ readonly id: string; readonly name: string }> } {
  const gateway = useMdmGateway();
  const { data } = useQuery(mdmQueries.roleTypes(gateway));
  return useMemo(() => {
    const items = data?.items ?? [];
    return { names: Object.fromEntries(items.map((type) => [type.code, type.name])), options: items.map((type) => ({ id: type.code, name: type.name })) };
  }, [data]);
}

function Filters({ search, update, roleOptions }: { readonly search: OrganizationSearch; readonly update: (change: Partial<OrganizationSearch>) => void; readonly roleOptions: ReadonlyArray<{ readonly id: string; readonly name: string }> }) {
  const statusOptions = PARTY_STATUSES.map((status) => ({ id: status, name: PARTY_STATUS_DISPLAY[status].text }));
  return (
    <>
      <SelectField
        label={T.roleFilter}
        options={roleOptions}
        emptyText={T.anyRole}
        value={search.roleTypeCode ?? ''}
        onChange={(event) => update({ roleTypeCode: event.target.value === '' ? null : event.target.value })}
        className="medium:w-56"
      />
      <SelectField
        label={T.statusFilter}
        options={statusOptions}
        emptyText={T.currentStatuses}
        value={search.status ?? ''}
        onChange={(event) => update({ status: PARTY_STATUSES.find((status) => status === event.target.value) ?? null })}
        className="medium:w-56"
      />
    </>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

interface ResultsProps {
  readonly view: ResultsView;
  readonly sizeClass: WindowSizeClass;
  readonly search: OrganizationSearch;
  readonly update: (change: Partial<OrganizationSearch>) => void;
  readonly roleNames: RoleNames;
  readonly canRegister: boolean;
  readonly onSearchByIdentifier: () => void;
  readonly onClear: () => void;
  readonly onRetry: () => void;
  /** «Cargar más» de `compact`; `null` si ya se alcanzó el máximo. */
  readonly onLoadMore: (() => void) | null;
}

/** Resultados: exactamente uno de cargando, error, vacío o la lista (tabla o tarjetas según el tamaño). */
function Results({ view, sizeClass, search, update, roleNames, canRegister, onSearchByIdentifier, onClear, onRetry, onLoadMore }: ResultsProps) {
  switch (view.kind) {
    case 'loading':
      return <ResultsSkeleton />;
    case 'error':
      return <LoadError subject={T.loading} error={view.error} onRetry={onRetry} />;
    case 'empty':
      return <OrganizationsEmpty search={search} canRegister={canRegister} onSearchByIdentifier={onSearchByIdentifier} onClear={onClear} />;
    case 'results':
      break;
  }
  const { page } = view;
  if (sizeClass === 'compact') {
    return (
      <>
        <OrganizationCardList items={page.items} roleNames={roleNames} />
        {onLoadMore !== null && page.items.length < page.totalCount && (
          <Button variant="tonal" className="self-center" onClick={onLoadMore}>
            {T.loadMore}
          </Button>
        )}
      </>
    );
  }
  return (
    <>
      <OrganizationsTable
        items={page.items}
        totalCount={page.totalCount}
        variant={sizeClass === 'medium' ? 'reduced' : 'full'}
        sort={search.sort}
        onSort={(field) => update({ sort: nextSort(search.sort, field) })}
        roleNames={roleNames}
      />
      <Pagination
        page={page.page}
        pageSize={search.pageSize}
        pageSizes={PAGE_SIZES}
        totalCount={page.totalCount}
        totalPages={page.totalPages}
        onPage={(next) => update({ page: next })}
        onPageSize={(pageSize) => update({ pageSize })}
      />
    </>
  );
}

/**
 * P-MDM-01 «Organizaciones» (UX-MDM-001 §5.3, UI-MDM-001 §3.2; US-MDM-001): búsqueda por texto, búsqueda exacta por
 * identificador, filtros de rol vigente y estado, y resultados en tabla (`medium` o más) o tarjetas (`compact`). La
 * acción «Nueva organización» no la pinta la pantalla: es el FAB del riel de MDM (`MdmShell`, G-584).
 */
export function OrganizationsPage() {
  useDocumentTitle(T.title, MDM_TITLE_SUFFIX);
  const gateway = useMdmGateway();
  const session = useMdmSession();
  const sizeClass = useWindowSizeClass();
  const compact = sizeClass === 'compact';
  const { search, update, clear } = useOrganizationSearch();
  const roles = useRoleNames();
  const schemes = useQuery(mdmQueries.identifierSchemes(gateway));
  const [identifierOpen, setIdentifierOpen] = useState(search.identifier !== null);
  const identifierPanelId = useId();
  // El tamaño de la lista de `compact` vuelve al inicial en cuanto cambia la búsqueda (estado derivado de la URL).
  const searchKey = toSearchParams({ ...search, page: 1 }).toString();
  const [growth, setGrowth] = useState({ key: searchKey, size: COMPACT_STEP });
  const compactSize = growth.key === searchKey ? growth.size : COMPACT_STEP;
  const query = toPartyQuery(search, compact ? { page: 1, pageSize: compactSize } : search);
  const results = useQuery(mdmQueries.parties(gateway, session.role, query));
  const view = resultsView(results.data, results.error, results.isError);
  const canRegister = session.can('organization.register');

  function searchIdentifier(filter: IdentifierFilter | null): void {
    update({ identifier: filter });
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="pt-2 text-headline-small">{T.title}</h1>
      <div className="h-1">{results.isFetching && <LoadingBar subject={T.loading} />}</div>

      <SearchBar label={T.searchLabel} value={search.text} onSearch={(text) => update({ text })} />

      <div>
        <Button aria-expanded={identifierOpen} aria-controls={identifierPanelId} onClick={() => setIdentifierOpen((open) => !open)}>
          <Icon name={identifierOpen ? 'expand_less' : 'expand_more'} className="size-4.5" />
          {T.identifierToggle}
        </Button>
        <div id={identifierPanelId} hidden={!identifierOpen} className="pt-3">
          {identifierOpen && <IdentifierSearch schemes={schemes.data?.items ?? []} current={search.identifier} onSearch={searchIdentifier} />}
        </div>
      </div>

      <div className="flex flex-col gap-4 medium:flex-row medium:flex-wrap medium:items-start medium:gap-2">
        <Filters search={search} update={update} roleOptions={roles.options} />
        {hasFilters(search) && (
          <Button onClick={clear} className="medium:mt-1">
            {T.clearFilters}
          </Button>
        )}
      </div>

      <p role="status" className="text-body-medium text-on-surface-variant">
        {view.kind === 'results' || view.kind === 'empty' ? T.count(view.page.totalCount) : ''}
      </p>

      <Results
        view={view}
        sizeClass={sizeClass}
        search={search}
        update={update}
        roleNames={roles.names}
        canRegister={canRegister}
        onSearchByIdentifier={() => setIdentifierOpen(true)}
        onClear={clear}
        onRetry={() => void results.refetch()}
        onLoadMore={compactSize < MAX_COMPACT ? () => setGrowth({ key: searchKey, size: Math.min(compactSize + COMPACT_STEP, MAX_COMPACT) }) : null}
      />
    </div>
  );
}
