import { EMPTY_PLACE_QUERY, PLACE_STATUSES, type CountryList, type CountrySummary, type PlacePage as PlacePageData, type PlaceQuery, type PlaceStatus, type PlaceType } from '@mdm/contracts';
import { Button, LoadError, LoadingBar, SelectField, Skeleton, useDocumentTitle } from '@sil/ui';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMdmGateway } from '../../../application/gateway-context.ts';
import { useMdmSession } from '../../../application/session-context.ts';
import { EmptyState } from '../../common/EmptyState.tsx';
import { SearchBar } from '../../common/SearchBar.tsx';
import { StatusTag } from '../../common/StatusTag.tsx';
import { countryPath, MDM_TITLE_SUFFIX, placePath } from '../../mdm-roots.ts';
import { NewCountrySheet } from './NewCountrySheet.tsx';
import { NewPlaceSheet } from './NewPlaceSheet.tsx';

const STATUS: Readonly<Record<PlaceStatus, { readonly text: string; readonly tone: 'ready' | 'quiet' | 'outline'; readonly icon: 'check_circle' | 'pause' | 'history' }>> = {
  Active: { text: 'Vigente', tone: 'ready', icon: 'check_circle' },
  Inactive: { text: 'Desactivado', tone: 'quiet', icon: 'pause' },
  Historical: { text: 'Histórico', tone: 'outline', icon: 'history' },
};

const DEFAULT_QUERY: PlaceQuery = { ...EMPTY_PLACE_QUERY, type: 'AdministrativeDivision', pageSize: 20 };

function Countries({ countries }: { readonly countries: CountryList }) {
  return (
    <section aria-labelledby="geo-countries-heading" className="flex flex-col gap-3">
      <h2 id="geo-countries-heading" className="text-title-large">Países</h2>
      {countries.items.length === 0 ? <EmptyState icon="public" title="No hay países registrados." /> :
        <ul className="grid gap-2 medium:grid-cols-2">
          {countries.items.map((country) => (
            <li key={country.alpha2} className="rounded-md border border-outline-variant p-4">
              <Link className="font-medium text-primary underline-offset-4 hover:underline" to={countryPath(country.alpha2)}>
                {country.officialName} ({country.alpha2})
              </Link>
              <p className="mt-1 text-body-small text-on-surface-variant">{country.alpha3} · {country.levelCount} niveles territoriales</p>
            </li>
          ))}
        </ul>}
    </section>
  );
}

function CountryResults({ countries }: { readonly countries: UseQueryResult<CountryList> }) {
  if (countries.isError) return <LoadError subject="países" error={countries.error} onRetry={() => void countries.refetch()} />;
  if (countries.data === undefined) return null;
  return <Countries countries={countries.data} />;
}

function Results({ page, onPage }: { readonly page: PlacePageData; readonly onPage: (page: number) => void }) {
  if (page.items.length === 0) {
    return <EmptyState icon="search" title="No hay lugares que coincidan con la búsqueda." announce />;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-outline-variant">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Resultados del catálogo geográfico</caption>
        <thead className="bg-surface-container text-label-medium text-on-surface-variant">
          <tr>
            <th scope="col" className="px-4 py-3">Lugar</th>
            <th scope="col" className="px-4 py-3">Código canónico</th>
            <th scope="col" className="px-4 py-3">Jerarquía</th>
            <th scope="col" className="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {page.items.map((place) => {
            const status = STATUS[place.status];
            return (
              <tr key={place.id} className="hover:bg-surface-container-low">
                <th scope="row" className="px-4 py-3 font-medium">
                  <Link className="text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2" to={placePath(place.id)}>
                    {place.officialName}
                  </Link>
                  {place.matchedName !== null && <span className="mt-1 block text-body-small text-on-surface-variant">Coincidencia: {place.matchedName}</span>}
                </th>
                <td className="px-4 py-3 text-body-medium">{place.canonicalCode === null ? '—' : `${place.canonicalCode.schemeCode} ${place.canonicalCode.value}`}</td>
                <td className="px-4 py-3 text-body-medium">{place.displayPath}</td>
                <td className="px-4 py-3"><StatusTag {...status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center justify-between gap-2 border-t border-outline-variant px-4 py-3 text-body-small text-on-surface-variant">
        <span>{page.totalCount} {page.totalCount === 1 ? 'lugar' : 'lugares'}</span>
        <div className="flex items-center gap-2">
          <Button variant="text" disabled={page.page <= 1} onClick={() => onPage(page.page - 1)}>Anterior</Button>
          <span aria-current="page">Página {page.page} de {Math.max(1, page.totalPages)}</span>
          <Button variant="text" disabled={page.page >= page.totalPages} onClick={() => onPage(page.page + 1)}>Siguiente</Button>
        </div>
      </div>
    </div>
  );
}

function GeographyFilters({
  countries,
  countryCode,
  status,
  type,
  onCountry,
  onStatus,
  onType,
}: {
  readonly countries: readonly CountrySummary[];
  readonly countryCode: string | null;
  readonly status: PlaceStatus | null;
  readonly type: PlaceType;
  readonly onCountry: (countryCode: string | null) => void;
  readonly onStatus: (status: PlaceStatus | null) => void;
  readonly onType: (type: PlaceType) => void;
}) {
  return (
    <div className="grid gap-3 medium:grid-cols-3">
      <SelectField
        label="País"
        options={countries.map((country) => ({ id: country.alpha2, name: country.officialName }))}
        emptyText="Todos los países"
        value={countryCode ?? ''}
        onChange={(event) => onCountry(event.target.value || null)}
      />
      <SelectField
        label="Tipo de ubicación"
        options={[
          { id: 'AdministrativeDivision', name: 'División administrativa' },
          { id: 'Locality', name: 'Localidad' },
        ]}
        value={type}
        onChange={(event) => {
          const selected = event.target.value;
          if (selected === 'AdministrativeDivision' || selected === 'Locality') onType(selected);
        }}
      />
      <SelectField
        label="Estado"
        options={[
          { id: 'Active', name: 'Vigente' },
          { id: 'Inactive', name: 'Desactivado' },
          { id: 'Historical', name: 'Histórico' },
        ]}
        emptyText="Estados vigentes y desactivados"
        value={status ?? ''}
        onChange={(event) => onStatus(PLACE_STATUSES.find((candidate) => candidate === event.target.value) ?? null)}
      />
    </div>
  );
}

function PlaceResults({
  validName,
  isError,
  error,
  data,
  onRetry,
  onPage,
}: {
  readonly validName: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly data: PlacePageData | undefined;
  readonly onRetry: () => void;
  readonly onPage: (page: number) => void;
}) {
  if (!validName) return <p role="status" className="text-body-small text-on-surface-variant">Escribe al menos dos caracteres para buscar por nombre.</p>;
  if (isError) return <LoadError subject="lugares" error={error} onRetry={onRetry} />;
  if (data === undefined) return <div className="flex flex-col gap-2" aria-hidden="true"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>;
  return <Results page={data} onPage={onPage} />;
}

function GeographyActions({
  canApprove,
  canMaintain,
  onNewCountry,
  onNewPlace,
}: {
  readonly canApprove: boolean;
  readonly canMaintain: boolean;
  readonly onNewCountry: () => void;
  readonly onNewPlace: () => void;
}) {
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {canApprove && <Button variant="outlined" onClick={onNewCountry}>Nuevo país</Button>}
        {canMaintain && <Button variant="filled" onClick={onNewPlace}>Nuevo lugar</Button>}
      </div>
      {canMaintain && !canApprove ? (
        <p className="max-w-prose text-right text-body-small text-on-surface-variant">
          Puedes crear divisiones bajo países con escalera declarada; crear países y declarar escaleras requiere un rol responsable.
        </p>
      ) : null}
    </div>
  );
}

export function GeographyPage() {
  useDocumentTitle('Geografía', MDM_TITLE_SUFFIX);
  const gateway = useMdmGateway();
  const session = useMdmSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [showNewPlace, setShowNewPlace] = useState(false);
  const [showNewCountry, setShowNewCountry] = useState(false);
  const countryCode = searchParams.get('pais')?.toUpperCase() ?? null;
  const effectiveQuery = { ...query, countryCode };
  const countries = useQuery({
    queryKey: ['mdm', session.role, 'geo', 'countries'],
    queryFn: ({ signal }) => gateway.listCountries({ search: null, status: null }, { signal }),
  });
  const validName = query.name === null || query.name.length >= 2;
  const places = useQuery({
    queryKey: ['mdm', session.role, 'geo', 'places', effectiveQuery],
    queryFn: ({ signal }) => gateway.searchPlaces(effectiveQuery, { signal }),
    enabled: validName,
  });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h1 className="text-headline-small">Geografía</h1>
        <GeographyActions
          canApprove={session.can('geography.approve')}
          canMaintain={session.can('geography.maintain')}
          onNewCountry={() => setShowNewCountry(true)}
          onNewPlace={() => setShowNewPlace(true)}
        />
      </header>
      <p className="max-w-prose text-body-medium text-on-surface-variant">Registra y consulta países y sus ubicaciones geográficas: divisiones administrativas y localidades.</p>
      <div className="h-1">{places.isFetching && <LoadingBar subject="Cargando lugares" />}</div>
      <SearchBar
        label="Buscar por nombre"
        value={query.name ?? ''}
        onSearch={(name) => setQuery((current) => ({ ...current, name: name.length === 0 ? null : name, code: name.length > 0 ? null : current.code, page: 1 }))}
        maxLength={100}
      />
      <SearchBar
        label="Buscar por código oficial"
        value={query.code ?? ''}
        onSearch={(code) => setQuery((current) => ({ ...current, code: code.length === 0 ? null : code, name: code.length > 0 ? null : current.name, page: 1 }))}
        maxLength={35}
      />
      <GeographyFilters
        countries={countries.data?.items ?? []}
        countryCode={countryCode}
        status={query.statuses?.[0] ?? null}
        type={query.type ?? 'AdministrativeDivision'}
        onCountry={(nextCountry) => {
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            if (nextCountry === null) next.delete('pais');
            else next.set('pais', nextCountry);
            return next;
          });
          setQuery((current) => ({ ...current, page: 1 }));
        }}
        onStatus={(status) => setQuery((current) => ({ ...current, statuses: status === null ? null : [status], page: 1 }))}
        onType={(type) => setQuery((current) => ({ ...current, type, page: 1 }))}
      />
      <CountryResults countries={countries} />
      <PlaceResults
        validName={validName}
        isError={places.isError}
        error={places.error}
        data={places.data}
        onRetry={() => void places.refetch()}
        onPage={(page) => setQuery((current) => ({ ...current, page }))}
      />
      {showNewPlace && <NewPlaceSheet onClose={() => setShowNewPlace(false)} />}
      {showNewCountry && <NewCountrySheet onClose={() => setShowNewCountry(false)} />}
    </div>
  );
}
