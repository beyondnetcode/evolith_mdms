import type { Establishment } from '@mdm/contracts';
import { ActionMenu, LoadError, LoadingBar, Skeleton, joinClasses, useWindowSizeClass } from '@sil/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useMdmGateway } from '../../../application/gateway-context.ts';
import { mdmQueries } from '../../../application/queries.ts';
import { useMdmSession } from '../../../application/session-context.ts';
import { establishmentRowCommands, type EstablishmentFilter, type EstablishmentRowCommand } from '../../../domain/establishment-form.ts';
import type { FocusTarget } from '../../common/dialogs/use-dialog-host.ts';
import { EmptyState } from '../../common/EmptyState.tsx';
import { SyncStatusTag } from '../../common/SyncStatusTag.tsx';
import { SecondaryTabs, secondaryTabId } from '../../common/SecondaryTabs.tsx';
import { SectionToolbar, type SectionAction } from '../../common/SectionToolbar.tsx';
import { useFocusRescue } from '../../common/use-focus-rescue.ts';
import { EstablishmentStatusTags } from './EstablishmentStatusTags.tsx';
import { hasEnabledItem, rowMenuItems, type Availability } from './row-menu.ts';
import { ESTABLISHMENT_TEXTS as T, REFERENCE_TEXTS as R } from './texts.ts';

type FilterId = 'active' | 'inactive' | 'closed' | 'all';

const FILTERS: ReadonlyArray<{ readonly id: FilterId; readonly label: string; readonly status: EstablishmentFilter; readonly empty: string }> = [
  { id: 'active', label: T.filters.active, status: 'active', empty: T.noneActive },
  { id: 'inactive', label: T.filters.inactive, status: 'inactive', empty: T.noneInactive },
  { id: 'closed', label: T.filters.closed, status: 'closed', empty: T.noneClosed },
  { id: 'all', label: T.filters.all, status: null, empty: T.noneAll },
];

const LABELS: Readonly<Record<EstablishmentRowCommand, string>> = {
  editEstablishment: T.edit,
  deactivateEstablishment: T.deactivate,
  reactivateEstablishment: T.reactivate,
  closeEstablishment: T.close,
};

interface Props {
  readonly partyId: string;
  readonly code: string;
  /** «Abrir establecimiento»: `null` si no se ofrece (sin permiso o solo lectura). */
  readonly open: SectionAction | null;
  readonly availability: Availability;
  readonly onCommand: (command: EstablishmentRowCommand, establishment: Establishment) => void;
  /** Adónde va el foco si, tras una acción de un clic, el elemento deja de verse con el filtro (el `h2` de la sección). */
  readonly focusFallback: FocusTarget;
}

/** Órdenes de un clic: sin diálogo que devuelva el foco (UX-MDM-001 §5.1). */
const QUICK_COMMANDS: ReadonlySet<EstablishmentRowCommand> = new Set(['deactivateEstablishment', 'reactivateEstablishment']);

/** Selector del botón del menú de un establecimiento: el foco vuelve a él al cerrar un diálogo. */
export function establishmentMenuSelector(establishmentId: string): string {
  return `[data-establishment-menu="${establishmentId}"] button[aria-haspopup="menu"]`;
}

type KindNames = Readonly<Record<string, string>>;

function kindName(establishment: Establishment, kinds: KindNames): string {
  return kinds[establishment.kindCode] ?? establishment.kindCode;
}

/** «Av. Néstor Gambetta 0000, Callao, Callao, Callao, PE»: lo que tenga, en orden. */
function addressLine(establishment: Establishment): string {
  const { line1, line2, district, province, department, countryCode } = establishment.address;
  return [line1, line2, district, province, department, countryCode].filter((part): part is string => part !== null && part !== '').join(', ');
}

/** «Sede · 0001 · Principal»: segunda línea de la lista (UI-MDM-001 §3.3). */
function summaryLine(establishment: Establishment, kinds: KindNames): string {
  return [kindName(establishment, kinds), establishment.taxEstablishmentCode ?? T.noTaxCode].join(' · ');
}

function RowMenu({ establishment, availability, onCommand }: { readonly establishment: Establishment } & Pick<Props, 'availability' | 'onCommand'>) {
  const items = rowMenuItems(establishmentRowCommands(establishment), availability, LABELS, (command) => onCommand(command, establishment));
  // Cerrado: sin menú (terminal, `INV-PTY-10`).
  if (!hasEnabledItem(items)) return null;
  return (
    <div data-establishment-menu={establishment.id}>
      <ActionMenu label={T.moreActions(establishment.code)} items={items} />
    </div>
  );
}

/**
 * Referencias externas del establecimiento (UX-MDM-001 §5.4, wireframe «SAP / PRD / KNA1 / 100234»): de la misma
 * consulta X-01 de la organización que la pestaña Referencias externas, filtradas por el establecimiento. Una sola
 * petición para todos los establecimientos. Si no se puede leer, lo dice aquí sin tapar el resto del detalle.
 */
function EstablishmentReferences({ partyId, establishmentId }: { readonly partyId: string; readonly establishmentId: string }) {
  const gateway = useMdmGateway();
  const { role } = useMdmSession();
  const references = useQuery(mdmQueries.partyReferences(gateway, role, partyId));
  if (references.isPending) return <Skeleton className="h-6 w-64" />;
  if (references.isError) return <p className="text-body-medium text-on-surface-variant">{R.establishmentLoadError}</p>;
  const own = references.data.items.filter((item) => item.mdmObjectType === 'ESTABLISHMENT' && item.mdmObjectId === establishmentId);
  if (own.length === 0) return <p className="text-body-medium text-on-surface-variant">{R.establishmentNone}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {own.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center gap-2">
          <span className="text-body-medium break-words tabular-nums">{R.line(item.systemCode, item.systemInstance, item.externalObjectType, item.externalKey)}</span>
          <SyncStatusTag syncStatus={item.syncStatus} />
        </li>
      ))}
    </ul>
  );
}

function Detail({
  partyId,
  establishment,
  kinds,
  ...menu
}: { readonly partyId: string; readonly establishment: Establishment; readonly kinds: KindNames } & Pick<Props, 'availability' | 'onCommand'>) {
  const { address } = establishment;
  const pairs: ReadonlyArray<readonly [string, string]> = [
    [T.code, establishment.code],
    [T.kind, kindName(establishment, kinds)],
    [T.taxCode, establishment.taxEstablishmentCode ?? T.noTaxCode],
    [T.address, addressLine(establishment)],
    ...(address.ubigeo === null ? [] : [[T.ubigeo, address.ubigeo] as const]),
    ...(address.postalCode === null ? [] : [[T.postalCode, address.postalCode] as const]),
    ...(address.reference === null ? [] : [[T.reference, address.reference] as const]),
    ...(establishment.closedBy === null ? [] : [[T.closedBy, establishment.closedBy] as const]),
  ];
  return (
    <section aria-label={T.detail(establishment.code)} className="flex min-w-0 flex-1 flex-col gap-4 rounded-md border border-outline-variant p-4">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h3 className="text-title-large break-words">{establishment.name}</h3>
          <EstablishmentStatusTags establishment={establishment} />
        </div>
        <RowMenu establishment={establishment} {...menu} />
      </div>
      <dl className="grid gap-x-6 gap-y-3 large:grid-cols-2">
        {pairs.map(([term, value]) => (
          <div key={term} className="flex flex-col gap-1">
            <dt className="text-body-small text-on-surface-variant">{term}</dt>
            <dd className="text-body-large break-words tabular-nums">{value}</dd>
          </div>
        ))}
        <div className="flex flex-col gap-1 large:col-span-2">
          <dt className="text-body-small text-on-surface-variant">{R.establishmentReferences}</dt>
          <dd>
            <EstablishmentReferences partyId={partyId} establishmentId={establishment.id} />
          </dd>
        </div>
      </dl>
    </section>
  );
}

/**
 * Lista-detalle (`expanded` o más, UI-MDM-001 §3.3): lista de 360 dp (`--mdm-establishment-list-width`, token local
 * SU-UI-MDM-01) con elementos de dos líneas y `aria-current` en el elegido, y el detalle como región con nombre. El
 * orden del DOM es lista → detalle (WCAG 1.3.2).
 */
function ListDetail({
  partyId,
  code,
  items,
  kinds,
  ...menu
}: { readonly partyId: string; readonly code: string; readonly items: readonly Establishment[]; readonly kinds: KindNames } & Pick<Props, 'availability' | 'onCommand'>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  if (selected === undefined) return null;
  return (
    <div className="flex items-start gap-6">
      <ul aria-label={T.list(code)} className="flex w-(--mdm-establishment-list-width) shrink-0 flex-col gap-1">
        {items.map((establishment) => {
          const current = establishment.id === selected.id;
          return (
            <li key={establishment.id}>
              <button
                type="button"
                aria-current={current ? 'true' : undefined}
                onClick={() => setSelectedId(establishment.id)}
                className={joinClasses(
                  'state-layer flex min-h-18 w-full cursor-pointer flex-col items-start gap-1 rounded-md px-4 py-2 text-left',
                  current ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface',
                )}
              >
                <span className="text-body-large">{`${establishment.code} · ${establishment.name}`}</span>
                <span className={joinClasses('text-body-medium tabular-nums', current ? 'text-on-secondary-container' : 'text-on-surface-variant')}>
                  {summaryLine(establishment, kinds)}
                </span>
                <EstablishmentStatusTags establishment={establishment} onSelected={current} />
              </button>
            </li>
          );
        })}
      </ul>
      <Detail key={selected.id} partyId={partyId} establishment={selected} kinds={kinds} {...menu} />
    </div>
  );
}

/** Tarjetas (`compact` y `medium`): el detalle —la dirección— va en la propia tarjeta. */
function Cards({
  partyId,
  items,
  kinds,
  ...menu
}: { readonly partyId: string; readonly items: readonly Establishment[]; readonly kinds: KindNames } & Pick<Props, 'availability' | 'onCommand'>) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((establishment) => (
        <li key={establishment.id} className="flex items-start gap-2 rounded-md border border-outline-variant p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-title-medium break-words">{`${establishment.code} · ${establishment.name}`}</span>
            <span className="text-body-medium text-on-surface-variant tabular-nums">{summaryLine(establishment, kinds)}</span>
            <EstablishmentStatusTags establishment={establishment} />
            <span className="text-body-medium text-on-surface-variant break-words">{addressLine(establishment)}</span>
            <EstablishmentReferences partyId={partyId} establishmentId={establishment.id} />
          </div>
          <RowMenu establishment={establishment} {...menu} />
        </li>
      ))}
    </ul>
  );
}

interface BodyProps extends Pick<Props, 'availability' | 'onCommand'> {
  readonly partyId: string;
  readonly code: string;
  readonly list: readonly Establishment[] | undefined;
  readonly error: unknown;
  readonly onRetry: () => void;
  readonly empty: string;
}

/** Cargando, error (solo en esta sección), vacío por filtro o la lista: lista-detalle desde `expanded`, tarjetas por debajo. */
function ListBody({ partyId, code, list, error, onRetry, empty, ...menu }: BodyProps) {
  const gateway = useMdmGateway();
  const sizeClass = useWindowSizeClass();
  const kindsQuery = useQuery(mdmQueries.establishmentKinds(gateway));
  const kinds: KindNames = Object.fromEntries((kindsQuery.data?.items ?? []).map((kind) => [kind.code, kind.name]));
  if (error !== null) return <LoadError subject={T.loadingSubject} error={error} onRetry={onRetry} />;
  if (list === undefined) {
    return (
      <>
        <LoadingBar subject={T.loadingSubject} />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </>
    );
  }
  if (list.length === 0) return <EmptyState icon="storage" title={empty} announce />;
  const listDetail = sizeClass !== 'compact' && sizeClass !== 'medium';
  return listDetail ? <ListDetail partyId={partyId} code={code} items={list} kinds={kinds} {...menu} /> : <Cards partyId={partyId} items={list} kinds={kinds} {...menu} />;
}

/**
 * Sección «Establecimientos» (US-MDM-009 y 010; UX-MDM-001 §5.4; UI-MDM-001 §2.3 y §3.3): filtro por pestañas
 * secundarias «Activos · Inactivos · Cerrados · Todos» sobre P-16, lista-detalle desde `expanded` y tarjetas por
 * debajo. «Abrir establecimiento» (D-MDM-05) y, por elemento, editar, desactivar, reactivar y «Cerrar» (D-MDM-09).
 * Un error al leer se queda en esta sección; el resto de la ficha sigue.
 */
export function EstablishmentsPanel({ partyId, code, open, availability, onCommand, focusFallback }: Props) {
  const gateway = useMdmGateway();
  const { role } = useMdmSession();
  const [filterId, setFilterId] = useState<FilterId>('active');
  const filter = FILTERS.find((item) => item.id === filterId) ?? FILTERS[0];
  const status = filter?.status ?? 'active';
  const list = useQuery(mdmQueries.establishments(gateway, role, partyId, status));
  const rescueFocus = useFocusRescue(focusFallback, list.dataUpdatedAt);
  const baseId = `mdm-establecimientos-${partyId}`;
  const panelId = `${baseId}-panel`;
  const menu = {
    availability,
    onCommand: (command: EstablishmentRowCommand, establishment: Establishment) => {
      if (QUICK_COMMANDS.has(command)) {
        // El menú se cierra y su elemento desaparece: el foco vuelve a su botón y, si el elemento deja de verse con
        // el filtro, al encabezado de la sección.
        document.querySelector<HTMLElement>(establishmentMenuSelector(establishment.id))?.focus();
        rescueFocus();
      }
      onCommand(command, establishment);
    },
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionToolbar
        action={open}
        filter={
          <SecondaryTabs label={T.filter} baseId={baseId} panelId={panelId} items={FILTERS} value={filterId} onChange={(id) => setFilterId(id)} />
        }
      />
      <div role="tabpanel" id={panelId} aria-labelledby={secondaryTabId(baseId, filterId)} className="flex flex-col gap-4">
        <ListBody partyId={partyId} code={code} list={list.data} error={list.isError ? list.error : null} onRetry={() => void list.refetch()} empty={filter?.empty ?? T.noneAll} {...menu} />
      </div>
    </div>
  );
}
