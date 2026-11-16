import type { Place, PlaceStatus } from '@mdm/contracts';
import { LoadError, LoadingBar, Skeleton, useDocumentTitle } from '@sil/ui';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { useMdmGateway } from '../../../application/gateway-context.ts';
import { useMdmSession } from '../../../application/session-context.ts';
import { BackLink } from '../../common/BackLink.tsx';
import { EmptyState } from '../../common/EmptyState.tsx';
import { StatusTag } from '../../common/StatusTag.tsx';
import { MDM_TITLE_SUFFIX, GEOGRAPHY_PATH, placePath } from '../../mdm-roots.ts';

const STATUS: Readonly<Record<PlaceStatus, { readonly text: string; readonly tone: 'ready' | 'quiet' | 'outline'; readonly icon: 'check_circle' | 'pause' | 'history' }>> = {
  Active: { text: 'Vigente', tone: 'ready', icon: 'check_circle' },
  Inactive: { text: 'Desactivado', tone: 'quiet', icon: 'pause' },
  Historical: { text: 'Histórico', tone: 'outline', icon: 'history' },
};

function OfficialCodes({ place }: { readonly place: Place }) {
  if (place.codes.length === 0) return <EmptyState icon="info" title="Este lugar no tiene códigos registrados." />;
  return (
    <ul className="divide-y divide-outline-variant">
      {place.codes.map((code) => (
        <li key={code.codeId} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <span className="font-medium">{code.schemeCode}: {code.value}</span>
          <span className="text-body-small text-on-surface-variant">{code.authority} · {code.validFrom}{code.validTo === null ? ' — vigente' : ` — ${code.validTo}`}</span>
        </li>
      ))}
    </ul>
  );
}

function PlaceHierarchy({ place }: { readonly place: Place }) {
  if (place.ancestors.length === 0) return <p className="text-body-medium text-on-surface-variant">Este lugar no tiene antecesores registrados.</p>;
  return (
    <ol className="flex flex-col gap-2">
      {place.ancestors.map((ancestor) => (
        <li key={ancestor.id}><Link className="text-primary underline-offset-4 hover:underline" to={placePath(ancestor.id)}>{ancestor.officialName}</Link><span className="ms-2 text-body-small text-on-surface-variant">{ancestor.canonicalCode === null ? '' : `${ancestor.canonicalCode.schemeCode} ${ancestor.canonicalCode.value}`}</span></li>
      ))}
    </ol>
  );
}

function usePlace() {
  const { placeId = '' } = useParams();
  const gateway = useMdmGateway();
  const session = useMdmSession();
  return useQuery({
    queryKey: ['mdm', session.role, 'geo', 'place', placeId],
    queryFn: ({ signal }) => gateway.getPlace(placeId, { signal }),
    enabled: placeId.length > 0,
  });
}

export function PlaceDetailPage() {
  const result = usePlace();
  useDocumentTitle(result.data?.officialName ?? 'Lugar', MDM_TITLE_SUFFIX);

  if (result.isError) return <LoadError subject="lugar" error={result.error} onRetry={() => void result.refetch()} />;
  if (result.data === undefined) return <div className="flex flex-col gap-3"><LoadingBar subject="Cargando lugar" /><Skeleton className="h-12 w-full" /><Skeleton className="h-40 w-full" /></div>;

  const place = result.data;
  const status = STATUS[place.status];
  return (
    <div className="flex flex-col gap-5">
      <BackLink to={GEOGRAPHY_PATH}>Volver a Geografía</BackLink>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-headline-small">{place.officialName}</h1>
          <p className="mt-1 text-body-medium text-on-surface-variant">{place.displayPath}</p>
        </div>
        <StatusTag {...status} size="regular" />
      </header>

      <section aria-labelledby="place-general-heading" className="flex flex-col gap-3 rounded-md border border-outline-variant p-4">
        <h2 id="place-general-heading" className="text-title-large">Datos del lugar</h2>
        <dl className="grid gap-3 medium:grid-cols-2">
          <div><dt className="text-label-medium text-on-surface-variant">Tipo</dt><dd className="text-body-large">{place.type}</dd></div>
          <div><dt className="text-label-medium text-on-surface-variant">País</dt><dd className="text-body-large">{place.countryCode}</dd></div>
          <div><dt className="text-label-medium text-on-surface-variant">Nivel territorial</dt><dd className="text-body-large">{place.levelLabel ?? 'No aplica'}</dd></div>
          <div><dt className="text-label-medium text-on-surface-variant">Código canónico</dt><dd className="text-body-large">{place.canonicalCode === null ? '—' : `${place.canonicalCode.schemeCode} ${place.canonicalCode.value}`}</dd></div>
          <div><dt className="text-label-medium text-on-surface-variant">Vigencia</dt><dd className="text-body-large">{place.validFrom}{place.validTo === null ? ' · sin fecha de término' : ` — ${place.validTo}`}</dd></div>
          <div><dt className="text-label-medium text-on-surface-variant">Hijos directos</dt><dd className="text-body-large">{place.childCount}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="place-codes-heading" className="flex flex-col gap-3 rounded-md border border-outline-variant p-4">
        <h2 id="place-codes-heading" className="text-title-large">Códigos oficiales</h2>
        <OfficialCodes place={place} />
      </section>

      <section aria-labelledby="place-hierarchy-heading" className="flex flex-col gap-3 rounded-md border border-outline-variant p-4">
        <h2 id="place-hierarchy-heading" className="text-title-large">Jerarquía territorial</h2>
        <PlaceHierarchy place={place} />
      </section>
    </div>
  );
}
