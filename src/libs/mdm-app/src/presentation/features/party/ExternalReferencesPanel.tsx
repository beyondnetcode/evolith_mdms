import type { Establishment, ExternalReference } from '@mdm/contracts';
import { ActionMenu, LoadError, LoadingBar, Skeleton, joinClasses, useWindowSizeClass } from '@sil/ui';
import { useQuery } from '@tanstack/react-query';
import { useMdmGateway } from '../../../application/gateway-context.ts';
import { mdmQueries } from '../../../application/queries.ts';
import { useMdmSession } from '../../../application/session-context.ts';
import { canUnlink } from '../../../domain/reference-form.ts';
import { EmptyState } from '../../common/EmptyState.tsx';
import { SectionToolbar, type SectionAction } from '../../common/SectionToolbar.tsx';
import { SyncStatusTag } from '../../common/SyncStatusTag.tsx';
import { TableFrame } from '../../common/TableFrame.tsx';
import { SECTION_TABLE } from '../../common/table-styles.ts';
import { REFERENCE_TEXTS as T } from './texts.ts';

/** «Organización ORG» o «Establecimiento CALLAO»: el objeto vinculado, por su código (UX-MDM-001 §5.4). */
export function referenceObject(reference: Pick<ExternalReference, 'mdmObjectType' | 'mdmObjectId'>, code: string, establishments: readonly Establishment[]): string {
  if (reference.mdmObjectType === 'PARTY') return T.partyObject(code);
  const establishment = establishments.find((item) => item.id === reference.mdmObjectId);
  return establishment === undefined ? T.unknownEstablishment : T.establishmentObject(establishment.code);
}

/** «la organización ORG» o «el establecimiento CALLAO», dentro de una frase (D-MDM-12). */
export function referenceObjectInSentence(reference: Pick<ExternalReference, 'mdmObjectType' | 'mdmObjectId'>, code: string, establishments: readonly Establishment[]): string {
  if (reference.mdmObjectType === 'PARTY') return T.partyInSentence(code);
  const establishment = establishments.find((item) => item.id === reference.mdmObjectId);
  return establishment === undefined ? T.unknownEstablishmentInSentence : T.establishmentInSentence(establishment.code);
}

/** Selector del botón del menú de una referencia: el foco vuelve a él al cerrar un diálogo. */
export function referenceMenuSelector(referenceId: string): string {
  return `[data-reference-menu="${referenceId}"] button[aria-haspopup="menu"]`;
}

interface Props {
  readonly partyId: string;
  readonly code: string;
  /** De la ficha cargada (P-03): para nombrar el establecimiento de cada referencia. */
  readonly establishments: readonly Establishment[];
  /** «Vincular»: `null` si no se ofrece. */
  readonly link: SectionAction | null;
  /** Desvincular se ofrece (permiso y organización no terminal). */
  readonly canUnlink: boolean;
  readonly onUnlink: (reference: ExternalReference) => void;
}

type RowProps = Pick<Props, 'code' | 'establishments' | 'canUnlink' | 'onUnlink'>;

function RowMenu({ reference, canUnlink: allowed, onUnlink }: { readonly reference: ExternalReference } & Pick<Props, 'canUnlink' | 'onUnlink'>) {
  // Desvinculada: sin menú (terminal, US-MDM-012).
  if (!allowed || !canUnlink(reference)) return null;
  return (
    <div data-reference-menu={reference.id}>
      <ActionMenu label={T.moreActions(reference.externalKey)} items={[{ id: 'unlink', label: T.unlink, onSelect: () => onUnlink(reference) }]} />
    </div>
  );
}

function lastSynced(reference: ExternalReference): string {
  return reference.lastSyncedVersion === null ? T.notSynced : String(reference.lastSyncedVersion);
}

function ReferencesTable({ items, code, establishments, ...menu }: { readonly items: readonly ExternalReference[] } & RowProps) {
  return (
    <TableFrame label={T.table(code)}>
      <table className={SECTION_TABLE.table}>
        <caption className="sr-only">{T.table(code)}</caption>
        <thead>
          <tr>
            {[T.object, T.system, T.instance, T.objectType, T.key, T.syncStatus, T.lastSynced].map((heading) => (
              <th key={heading} scope="col" className={SECTION_TABLE.headerCell}>
                {heading}
              </th>
            ))}
            <th scope="col" className={SECTION_TABLE.headerCell}>
              <span className="sr-only">{T.rowActions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((reference) => (
            <tr key={reference.id} className={SECTION_TABLE.row}>
              <td className={SECTION_TABLE.cell}>{referenceObject(reference, code, establishments)}</td>
              <td className={SECTION_TABLE.cell}>{reference.systemCode}</td>
              <td className={SECTION_TABLE.cell}>{reference.systemInstance}</td>
              <td className={SECTION_TABLE.cell}>{reference.externalObjectType}</td>
              <td className={joinClasses(SECTION_TABLE.cell, 'tabular-nums')}>{reference.externalKey}</td>
              <td className={SECTION_TABLE.cell}>
                <SyncStatusTag syncStatus={reference.syncStatus} />
              </td>
              <td className={joinClasses(SECTION_TABLE.cell, 'tabular-nums')}>{lastSynced(reference)}</td>
              <td className={SECTION_TABLE.actionsCell}>
                <RowMenu reference={reference} {...menu} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

function ReferenceCards({ items, code, establishments, ...menu }: { readonly items: readonly ExternalReference[] } & RowProps) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((reference) => (
        <li key={reference.id} className="flex items-start gap-2 rounded-md border border-outline-variant p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-title-medium break-words">{T.line(reference.systemCode, reference.systemInstance, reference.externalObjectType, reference.externalKey)}</span>
            <span className="text-body-medium text-on-surface-variant">{referenceObject(reference, code, establishments)}</span>
            <SyncStatusTag syncStatus={reference.syncStatus} />
            <span className="text-body-medium text-on-surface-variant tabular-nums">{`${T.lastSynced}: ${lastSynced(reference)}`}</span>
          </div>
          <RowMenu reference={reference} {...menu} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Sección «Referencias externas» (US-MDM-012; UX-MDM-001 §5.4; UI-MDM-001 §2.4 y §3.3): X-01 con `partyId`, que trae
 * las de la organización y las de sus establecimientos, cargada al abrir la pestaña. Objeto, sistema, instancia, tipo
 * de objeto, clave, estado de sincronización (color, icono y texto) y última versión sincronizada. `SyncFailed` sin
 * causa ni reintento (SU-MDM-17, G-568). «Vincular» (D-MDM-07) y «Desvincular» por fila (D-MDM-12); las
 * desvinculadas se quedan visibles, sin menú.
 */
export function ExternalReferencesPanel({ partyId, code, establishments, link, canUnlink: allowed, onUnlink }: Props) {
  const gateway = useMdmGateway();
  const { role } = useMdmSession();
  const compact = useWindowSizeClass() === 'compact';
  const list = useQuery(mdmQueries.partyReferences(gateway, role, partyId));
  const page = list.data;
  const row = { code, establishments, canUnlink: allowed, onUnlink };
  return (
    <div className="flex flex-col gap-4">
      <SectionToolbar action={link} />
      {list.isError && <LoadError subject={T.loadingSubject} error={list.error} onRetry={() => void list.refetch()} />}
      {list.isPending && (
        <>
          <LoadingBar subject={T.loadingSubject} />
          <Skeleton className="h-12 w-full" />
        </>
      )}
      {page?.items.length === 0 && <EmptyState icon="storage" title={T.none} />}
      {page !== undefined && page.items.length > 0 && (compact ? <ReferenceCards items={page.items} {...row} /> : <ReferencesTable items={page.items} {...row} />)}
      {page !== undefined && page.totalCount > page.items.length && <p className="text-body-medium text-on-surface-variant">{T.truncated(page.items.length, page.totalCount)}</p>}
    </div>
  );
}
