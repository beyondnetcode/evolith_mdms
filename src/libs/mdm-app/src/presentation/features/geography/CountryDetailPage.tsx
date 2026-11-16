import type { TerritorialSchema } from '@mdm/contracts';
import { Button, LoadError, LoadingBar, Skeleton, useDocumentTitle } from '@sil/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMdmGateway } from '../../../application/gateway-context.ts';
import { useMdmSession } from '../../../application/session-context.ts';
import { BackLink } from '../../common/BackLink.tsx';
import { EmptyState } from '../../common/EmptyState.tsx';
import { GEOGRAPHY_PATH, MDM_TITLE_SUFFIX } from '../../mdm-roots.ts';
import { TerritorialSchemaSheet } from './TerritorialSchemaSheet.tsx';

function SchemaDetails({ schema }: { readonly schema: TerritorialSchema }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-medium">Código postal: {schema.usesPostalCode ? `sí${schema.postalCodePattern === null ? '' : ` · patrón ${schema.postalCodePattern}`}` : 'no'}</p>
      {schema.levels.length === 0 ? <EmptyState icon="info" title="La escalera territorial no tiene niveles." /> :
        <ol className="flex flex-col gap-2">
          {schema.levels.map((level) => (
            <li key={level.order} className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-surface-container-low p-3">
              <span className="font-medium">{level.order}. {level.localLabel}</span>
              <span className="text-body-small text-on-surface-variant">{level.canonicalLabel} · {level.canonicalSchemeCode} · {level.placeCount} lugares{level.isAddressLevel ? ' · nivel para direcciones' : ''}</span>
            </li>
          ))}
        </ol>}
    </div>
  );
}

export function CountryDetailPage() {
  const { countryCode = '' } = useParams();
  const gateway = useMdmGateway();
  const session = useMdmSession();
  const [showSchemaEditor, setShowSchemaEditor] = useState(false);
  const country = useQuery({
    queryKey: ['mdm', session.role, 'geo', 'country', countryCode],
    queryFn: ({ signal }) => gateway.getCountry(countryCode, { signal }),
    enabled: countryCode.length > 0,
  });
  const schema = useQuery({
    queryKey: ['mdm', session.role, 'geo', 'territorial-schema', countryCode],
    queryFn: ({ signal }) => gateway.getTerritorialSchema(countryCode, { signal }),
    enabled: country.data?.territorialSchema.declared === true,
  });
  useDocumentTitle(country.data?.officialName ?? 'País', MDM_TITLE_SUFFIX);

  if (country.isError) return <LoadError subject="país" error={country.error} onRetry={() => void country.refetch()} />;
  if (country.data === undefined) return <div className="flex flex-col gap-3"><LoadingBar subject="Cargando país" /><Skeleton className="h-12 w-full" /><Skeleton className="h-40 w-full" /></div>;

  const item = country.data;
  return (
    <div className="flex flex-col gap-5">
      <BackLink to={GEOGRAPHY_PATH}>Volver a Geografía</BackLink>
      <header>
        <h1 className="text-headline-small">{item.officialName}</h1>
        {item.englishName !== null && <p className="mt-1 text-body-medium text-on-surface-variant">{item.englishName}</p>}
      </header>
      <section aria-labelledby="country-codes-heading" className="flex flex-col gap-3 rounded-md border border-outline-variant p-4">
        <h2 id="country-codes-heading" className="text-title-large">Identificación</h2>
        <dl className="grid gap-3 medium:grid-cols-3">
          <div><dt className="text-label-medium text-on-surface-variant">ISO alfa-2</dt><dd className="text-body-large">{item.alpha2}</dd></div>
          <div><dt className="text-label-medium text-on-surface-variant">ISO alfa-3</dt><dd className="text-body-large">{item.alpha3}</dd></div>
          <div><dt className="text-label-medium text-on-surface-variant">ISO numérico</dt><dd className="text-body-large">{item.numeric}</dd></div>
        </dl>
      </section>
      <section aria-labelledby="country-schema-heading" className="flex flex-col gap-3 rounded-md border border-outline-variant p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="country-schema-heading" className="text-title-large">Política territorial</h2>
          {!item.territorialSchema.declared && session.can('geography.approve') ? (
            <Button variant="outlined" onClick={() => setShowSchemaEditor(true)}>Definir escalera territorial</Button>
          ) : null}
        </div>
        {schema.isError ? <LoadError subject="escalera territorial" error={schema.error} onRetry={() => void schema.refetch()} /> :
          schema.isFetching ? <Skeleton className="h-28 w-full" /> :
            schema.data !== undefined ? <SchemaDetails schema={schema.data} /> :
            <p className="text-body-medium text-on-surface-variant">Este país aún no tiene una escalera territorial declarada.</p>}
      </section>
      <section aria-labelledby="country-place-heading" className="flex flex-col gap-2 rounded-md border border-outline-variant p-4">
        <h2 id="country-place-heading" className="text-title-large">Catálogo geográfico</h2>
        <p className="text-body-medium text-on-surface-variant">Explora divisiones administrativas, códigos y lugares asociados a este país.</p>
        <Link className="w-fit text-primary underline-offset-4 hover:underline" to={`${GEOGRAPHY_PATH}?pais=${encodeURIComponent(item.alpha2)}`}>Ver lugares de {item.officialName}</Link>
      </section>
      {showSchemaEditor ? (
        <TerritorialSchemaSheet countryCode={item.alpha2} countryName={item.officialName} onClose={() => setShowSchemaEditor(false)} />
      ) : null}
    </div>
  );
}
