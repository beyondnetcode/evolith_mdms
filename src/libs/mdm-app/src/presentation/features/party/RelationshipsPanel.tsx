import type { PartyRelationship, RelationshipKind } from '@mdm/contracts';
import { ActionMenu, LoadError, LoadingBar, Skeleton, Switch, formatCivilDate, joinClasses, useWindowSizeClass } from '@sil/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { useMdmGateway } from '../../../application/gateway-context.ts';
import { usePartyNames, type PartyName } from '../../../application/party-names.ts';
import { mdmQueries } from '../../../application/queries.ts';
import { useMdmSession } from '../../../application/session-context.ts';
import { canEndRelationship, compareRelationships, relationshipDisplayState, sideLabel, viewFrom } from '../../../domain/relationship-state.ts';
import { EmptyState } from '../../common/EmptyState.tsx';
import { SectionToolbar, type SectionAction } from '../../common/SectionToolbar.tsx';
import { StatusTag } from '../../common/StatusTag.tsx';
import { TableFrame } from '../../common/TableFrame.tsx';
import { SECTION_TABLE } from '../../common/table-styles.ts';
import { organizationPath } from '../../mdm-roots.ts';
import { RELATIONSHIP_TEXTS as T } from './texts.ts';

/** Catálogo de tipos de relación (C-04) por código. */
export type RelationshipKinds = ReadonlyMap<string, RelationshipKind>;

export function useRelationshipKinds(): RelationshipKinds {
  const gateway = useMdmGateway();
  const kinds = useQuery(mdmQueries.relationshipKinds(gateway));
  return new Map((kinds.data?.items ?? []).map((kind) => [kind.code, kind]));
}

/** «Es matriz de»: el papel de la organización de la ficha; sin catálogo, el código y el extremo. */
export function relationshipSentence(relationship: PartyRelationship, partyId: string, kinds: RelationshipKinds): string {
  const { side } = viewFrom(relationship, partyId);
  const label = sideLabel(kinds.get(relationship.kindCode), side);
  return label === null ? T.sentenceFallback(relationship.kindCode, side) : T.sentence(label);
}

/** «NAVIERA-PACIFICO · NAVIERA DEL PACÍFICO S.A.C.», o su estado si aún no se resolvió. */
export function partyNameText(name: PartyName | undefined): string {
  if (name === undefined || name.kind === 'loading') return T.resolving;
  return name.kind === 'ready' ? `${name.code} · ${name.legalName}` : T.unresolved;
}

/** Selector del botón del menú de una relación: el foco vuelve a él al cerrar un diálogo. */
export function relationshipMenuSelector(relationshipId: string): string {
  return `[data-relationship-menu="${relationshipId}"] button[aria-haspopup="menu"]`;
}

interface Props {
  readonly partyId: string;
  readonly code: string;
  readonly today: string;
  /** «Nueva relación»: `null` si no se ofrece. */
  readonly start: SectionAction | null;
  /** Terminar se ofrece (permiso y organización no terminal). */
  readonly canEnd: boolean;
  readonly onEnd: (relationship: PartyRelationship) => void;
}

function RelationshipStatusTag({ relationship, today }: { readonly relationship: PartyRelationship; readonly today: string }) {
  const state = relationshipDisplayState(relationship, today);
  switch (state.kind) {
    case 'current':
      return <StatusTag tone="ready" icon="check_circle" text={T.current} />;
    case 'future':
      return <StatusTag tone="quiet" icon="schedule" text={T.future(state.startsOn)} />;
    case 'expired':
      return <StatusTag tone="quiet" icon="schedule" text={T.expired(state.endedOn)} />;
    case 'ended':
      return <StatusTag tone="outline" icon="cancel" text={T.ended} />;
  }
}

interface RowData {
  readonly relationship: PartyRelationship;
  readonly sentence: string;
  readonly otherId: string;
  readonly other: string;
  readonly kind: string;
  readonly from: string;
  readonly to: string;
}

interface RowProps {
  readonly row: RowData;
  readonly today: string;
  readonly canEnd: boolean;
  readonly onEnd: (relationship: PartyRelationship) => void;
}

function RowMenu({ row, canEnd, onEnd }: Omit<RowProps, 'today'>) {
  // Terminada: sin menú (terminal, UX-MDM-001 §5.4).
  if (!canEnd || !canEndRelationship(row.relationship)) return null;
  return (
    <div data-relationship-menu={row.relationship.id}>
      <ActionMenu label={T.moreActions(row.other)} items={[{ id: 'end', label: T.end, onSelect: () => onEnd(row.relationship) }]} />
    </div>
  );
}

function OtherLink({ row }: { readonly row: RowData }) {
  return (
    <Link to={organizationPath(row.otherId)} className="text-primary underline underline-offset-2 break-words">
      {row.other}
    </Link>
  );
}

function RelationshipsTable({ code, rows, ...rest }: { readonly code: string; readonly rows: readonly RowData[] } & Omit<RowProps, 'row'>) {
  return (
    <TableFrame label={T.table(code)}>
      <table className={SECTION_TABLE.table}>
        <caption className="sr-only">{T.table(code)}</caption>
        <thead>
          <tr>
            {[T.direction, T.other, T.kind, T.from, T.to, T.status].map((heading) => (
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
          {rows.map((row) => (
            <tr key={row.relationship.id} className={SECTION_TABLE.row}>
              <td className={SECTION_TABLE.cell}>{row.sentence}</td>
              <td className={SECTION_TABLE.cell}>
                <OtherLink row={row} />
              </td>
              <td className={SECTION_TABLE.cell}>{row.kind}</td>
              <td className={joinClasses(SECTION_TABLE.cell, 'tabular-nums')}>{row.from}</td>
              <td className={joinClasses(SECTION_TABLE.cell, 'tabular-nums')}>{row.to}</td>
              <td className={SECTION_TABLE.cell}>
                <RelationshipStatusTag relationship={row.relationship} today={rest.today} />
              </td>
              <td className={SECTION_TABLE.actionsCell}>
                <RowMenu row={row} canEnd={rest.canEnd} onEnd={rest.onEnd} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

function RelationshipCards({ rows, ...rest }: { readonly rows: readonly RowData[] } & Omit<RowProps, 'row'>) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.relationship.id} className="flex items-start gap-2 rounded-md border border-outline-variant p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-body-medium text-on-surface-variant">{row.sentence}</span>
            <span className="text-title-medium">
              <OtherLink row={row} />
            </span>
            <RelationshipStatusTag relationship={row.relationship} today={rest.today} />
            <span className="text-body-medium text-on-surface-variant tabular-nums">{`${row.kind} · ${T.from} ${row.from} – ${row.to}`}</span>
          </div>
          <RowMenu row={row} canEnd={rest.canEnd} onEnd={rest.onEnd} />
        </li>
      ))}
    </ul>
  );
}

function useRows(partyId: string, items: readonly PartyRelationship[], today: string): readonly RowData[] {
  const kinds = useRelationshipKinds();
  const names = usePartyNames(items.map((item) => viewFrom(item, partyId).otherPartyId));
  return items.toSorted(compareRelationships(today)).map((relationship) => {
    const { otherPartyId } = viewFrom(relationship, partyId);
    const kind = kinds.get(relationship.kindCode);
    return {
      relationship,
      sentence: relationshipSentence(relationship, partyId, kinds),
      otherId: otherPartyId,
      other: partyNameText(names.get(otherPartyId)),
      kind: kind === undefined ? relationship.kindCode : T.kindName(kind.name, kind.code),
      from: formatCivilDate(relationship.validFrom),
      to: relationship.validTo === null ? T.open : formatCivilDate(relationship.validTo),
    };
  });
}

function RelationshipList({ partyId, code, items, ...rest }: { readonly items: readonly PartyRelationship[] } & Omit<Props, 'start'>) {
  const compact = useWindowSizeClass() === 'compact';
  const rows = useRows(partyId, items, rest.today);
  return compact ? <RelationshipCards rows={rows} {...rest} /> : <RelationshipsTable code={code} rows={rows} {...rest} />;
}

/**
 * Sección «Relaciones» (US-MDM-011; UX-MDM-001 §5.4; UI-MDM-001 §2.5 y §3.3): R-01 con la organización en cualquiera
 * de los dos extremos, cargada al abrir la pestaña. Sentido en texto («Es matriz de»), la otra organización como
 * enlace a su ficha (su nombre se resuelve con P-03 por id, G-566), tipo, vigencia y estado. «Solo vigentes»
 * (encendido) filtra en el servidor (`currentOnly`). «Nueva relación» (D-MDM-06) y «Terminar» por fila (D-MDM-11).
 * Un error al leer se queda en esta sección.
 */
export function RelationshipsPanel({ partyId, code, today, start, canEnd, onEnd }: Props) {
  const gateway = useMdmGateway();
  const { role } = useMdmSession();
  const [currentOnly, setCurrentOnly] = useState(true);
  const list = useQuery(mdmQueries.relationships(gateway, role, partyId, currentOnly));
  const page = list.data;
  return (
    <div className="flex flex-col gap-4">
      <SectionToolbar action={start} filter={<Switch label={T.currentOnly} description={T.currentOnlyHelp} active={currentOnly} onChange={setCurrentOnly} />} />
      {list.isError && <LoadError subject={T.loadingSubject} error={list.error} onRetry={() => void list.refetch()} />}
      {list.isPending && (
        <>
          <LoadingBar subject={T.loadingSubject} />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </>
      )}
      {page?.items.length === 0 && <EmptyState icon="group" title={currentOnly ? T.noneCurrent : T.none} announce />}
      {page !== undefined && page.items.length > 0 && <RelationshipList partyId={partyId} code={code} items={page.items} today={today} canEnd={canEnd} onEnd={onEnd} />}
      {page !== undefined && page.totalCount > page.items.length && <p className="text-body-medium text-on-surface-variant">{T.truncated(page.items.length, page.totalCount)}</p>}
    </div>
  );
}
