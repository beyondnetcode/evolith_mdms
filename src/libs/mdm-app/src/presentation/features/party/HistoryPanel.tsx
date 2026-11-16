import type { ExternalReference, Party, PartyRelationship } from '@mdm/contracts';
import { InlineNotice, LoadError, LoadingBar, Skeleton, formatDateTime } from '@sil/ui';
import { useQuery } from '@tanstack/react-query';
import { useMdmGateway } from '../../../application/gateway-context.ts';
import { usePartyNames, type PartyName } from '../../../application/party-names.ts';
import { mdmQueries } from '../../../application/queries.ts';
import { useMdmSession } from '../../../application/session-context.ts';
import { deriveHistory, type HistoryEvent, type HistoryMoment } from '../../../domain/party-history.ts';
import { viewFrom } from '../../../domain/relationship-state.ts';
import type { RoleNames } from '../../common/field-messages.ts';
import { MdmIcon } from '../../common/MdmIcon.tsx';
import { referenceObject } from './ExternalReferencesPanel.tsx';
import { partyNameText, relationshipSentence, useRelationshipKinds, type RelationshipKinds } from './RelationshipsPanel.tsx';
import { HISTORY_TEXTS as T, REFERENCE_TEXTS as R } from './texts.ts';

interface Props {
  readonly party: Party;
  readonly roleNames: RoleNames;
  readonly today: string;
}

function momentText(moment: HistoryMoment): string {
  return moment.kind === 'instant' ? formatDateTime(moment.value) : T.onDate(moment.value);
}

interface Describe {
  readonly party: Party;
  readonly roleNames: RoleNames;
  readonly kinds: RelationshipKinds;
  readonly names: ReadonlyMap<string, PartyName>;
}

function describe(event: HistoryEvent, { party, roleNames, kinds, names }: Describe): { readonly text: string; readonly actor: string | null } {
  switch (event.kind) {
    case 'created':
      return { text: T.created, actor: event.actor };
    case 'updated':
      return { text: T.updated, actor: event.actor };
    case 'identifierExpired':
      return { text: T.identifierExpired(event.schemeCode, event.value), actor: null };
    case 'roleTerminated':
      return { text: T.roleTerminated(roleNames[event.roleTypeCode] ?? event.roleTypeCode), actor: null };
    case 'establishmentClosed':
      return { text: T.establishmentClosed(event.code), actor: event.actor };
    case 'relationshipEnded': {
      const other = viewFrom(event.relationship, party.id).otherPartyId;
      return { text: T.relationshipEnded(relationshipSentence(event.relationship, party.id, kinds), partyNameText(names.get(other))), actor: null };
    }
    case 'referenceUnlinked': {
      const { reference } = event;
      const line = R.line(reference.systemCode, reference.systemInstance, reference.externalObjectType, reference.externalKey);
      return { text: `${T.referenceUnlinked(line)} (${referenceObject(reference, party.code, party.establishments)})`, actor: event.actor };
    }
  }
}

/** Clave estable de un evento de la línea de tiempo. */
function eventKey(event: HistoryEvent, index: number): string {
  return `${event.kind}-${event.at.value}-${index}`;
}

function Timeline({ party, events, ...rest }: Omit<Describe, 'party'> & { readonly party: Party; readonly events: readonly HistoryEvent[] }) {
  return (
    <ul aria-label={T.list(party.code)} className="flex flex-col">
      {events.map((event, index) => {
        const { text, actor } = describe(event, { party, ...rest });
        return (
          <li key={eventKey(event, index)} className="flex min-h-14 items-start gap-4 border-b border-outline-variant py-2 last:border-b-0">
            <MdmIcon name="history" className="mt-1 text-on-surface-variant" />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-body-medium text-on-surface break-words">{text}</span>
              <span className="text-body-small text-on-surface-variant tabular-nums">{actor === null ? momentText(event.at) : `${momentText(event.at)} · ${T.by(actor)}`}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Sección «Historial» (UX-MDM-001 §5.4 y §6.4; UI-MDM-001 §3.3): línea de tiempo de solo lectura DERIVADA de lo que el
 * contrato deja ver — alta y última actualización (P-03), identificadores vencidos, roles terminados, establecimientos
 * cerrados, relaciones terminadas (R-01) y referencias desvinculadas (X-01) — con un aviso de que el historial
 * completo no está disponible (SU-MDM-11, G-565). No se inventan eventos.
 */
export function HistoryPanel({ party, roleNames, today }: Props) {
  const gateway = useMdmGateway();
  const { role } = useMdmSession();
  const relationships = useQuery(mdmQueries.relationships(gateway, role, party.id, false));
  const references = useQuery(mdmQueries.partyReferences(gateway, role, party.id));
  const kinds = useRelationshipKinds();
  const relationshipItems = relationships.data?.items ?? [];
  const names = usePartyNames(relationshipItems.filter((item) => item.status === 'Ended').map((item) => viewFrom(item, party.id).otherPartyId));
  const failed = relationships.isError ? relationships : references.isError ? references : null;

  return (
    <div className="flex flex-col gap-4">
      <InlineNotice severity="info" title={T.partialTitle}>
        {T.partialBody}
      </InlineNotice>
      {failed !== null && (
        // Sin una de las fuentes, la línea de tiempo no se presenta como completa.
        <LoadError subject={T.loadingSubject} error={failed.error} onRetry={() => void Promise.all([relationships.refetch(), references.refetch()])} />
      )}
      {failed === null && (relationships.isPending || references.isPending) && (
        <>
          <LoadingBar subject={T.loadingSubject} />
          <Skeleton className="h-14 w-full" />
        </>
      )}
      {relationships.data !== undefined && references.data !== undefined && (
        <HistoryBody party={party} roleNames={roleNames} kinds={kinds} names={names} today={today} relationships={relationshipItems} references={references.data.items} />
      )}
    </div>
  );
}

function HistoryBody({
  relationships,
  references,
  today,
  ...rest
}: Describe & { readonly today: string; readonly relationships: readonly PartyRelationship[]; readonly references: readonly ExternalReference[] }) {
  const events = deriveHistory(rest.party, relationships, references, today);
  const [only] = events;
  if (events.length === 1 && only?.kind === 'created') {
    return <p className="text-body-medium text-on-surface-variant">{T.onlyCreated(rest.party.createdAt, only.actor)}</p>;
  }
  return <Timeline events={events} {...rest} />;
}
