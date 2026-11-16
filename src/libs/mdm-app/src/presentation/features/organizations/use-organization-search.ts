import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { EMPTY_SEARCH, parseOrganizationSearch, toSearchParams, type OrganizationSearch } from '../../../domain/organization-search.ts';

export interface OrganizationSearchState {
  readonly search: OrganizationSearch;
  /** Cambia la búsqueda; salvo que cambie la página, vuelve a la primera. */
  readonly update: (change: Partial<OrganizationSearch>) => void;
  readonly clear: () => void;
}

/** La búsqueda vive en la dirección (SU-MDM-13): «Atrás» y el enlace compartido llevan a la misma lista. */
export function useOrganizationSearch(): OrganizationSearchState {
  const [params, setParams] = useSearchParams();
  const search = useMemo(() => parseOrganizationSearch(params), [params]);
  const update = useCallback(
    (change: Partial<OrganizationSearch>) => {
      setParams(toSearchParams({ ...search, page: 1, ...change }));
    },
    [search, setParams],
  );
  const clear = useCallback(() => {
    setParams(toSearchParams({ ...EMPTY_SEARCH, sort: search.sort, pageSize: search.pageSize }));
  }, [search.sort, search.pageSize, setParams]);
  return { search, update, clear };
}
