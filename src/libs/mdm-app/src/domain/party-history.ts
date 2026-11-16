import type { ExternalReference, Party, PartyRelationship } from '@mdm/contracts';
import { isExpired } from './party-policy.ts';

/**
 * Historial derivado de la ficha (UX-MDM-001 §5.4; SU-MDM-11, G-565): no hay endpoint de historial, así que solo se
 * puede contar lo que el contrato deja ver con su fecha — el alta y la última actualización de la organización (sin
 * qué cambió) y cuándo terminó cada elemento terminal. No se inventan eventos: los cambios de nombre, las suspensiones
 * y las reactivaciones intermedias no constan.
 */

/** Cuándo: un instante con hora (auditoría) o una fecha civil (fin de vigencia). */
export type HistoryMoment = { readonly kind: 'instant'; readonly value: string } | { readonly kind: 'date'; readonly value: string };

export type HistoryEvent =
  | { readonly kind: 'created'; readonly at: HistoryMoment; readonly actor: string }
  | { readonly kind: 'updated'; readonly at: HistoryMoment; readonly actor: string | null }
  | { readonly kind: 'identifierExpired'; readonly at: HistoryMoment; readonly schemeCode: string; readonly value: string }
  | { readonly kind: 'roleTerminated'; readonly at: HistoryMoment; readonly roleTypeCode: string }
  | { readonly kind: 'establishmentClosed'; readonly at: HistoryMoment; readonly code: string; readonly actor: string | null }
  | { readonly kind: 'relationshipEnded'; readonly at: HistoryMoment; readonly relationship: PartyRelationship }
  | { readonly kind: 'referenceUnlinked'; readonly at: HistoryMoment; readonly reference: ExternalReference; readonly actor: string | null };

const instant = (value: string): HistoryMoment => ({ kind: 'instant', value });
const date = (value: string): HistoryMoment => ({ kind: 'date', value });

function partyEvents(party: Party): HistoryEvent[] {
  const created: HistoryEvent = { kind: 'created', at: instant(party.createdAt), actor: party.createdBy };
  return party.updatedAt === null ? [created] : [created, { kind: 'updated', at: instant(party.updatedAt), actor: party.updatedBy }];
}

function partEvents(party: Party, today: string): HistoryEvent[] {
  return [
    ...party.identifiers.flatMap((identifier): HistoryEvent[] =>
      identifier.validTo !== null && isExpired(identifier, today)
        ? [{ kind: 'identifierExpired', at: date(identifier.validTo), schemeCode: identifier.schemeCode, value: identifier.value }]
        : [],
    ),
    // El fin de un rol terminado es su «hasta» (P-15 lo fija); el contrato no da el instante del término.
    ...party.roles.flatMap((role): HistoryEvent[] =>
      role.status === 'Terminated' && role.validTo !== null ? [{ kind: 'roleTerminated', at: date(role.validTo), roleTypeCode: role.roleTypeCode }] : [],
    ),
    ...party.establishments.flatMap((establishment): HistoryEvent[] =>
      establishment.isClosed && establishment.closedAt !== null
        ? [{ kind: 'establishmentClosed', at: instant(establishment.closedAt), code: establishment.code, actor: establishment.closedBy }]
        : [],
    ),
  ];
}

/** Lo de las relaciones y referencias: una terminada vale lo que su «hasta»; una desvinculada no cambia después (terminal). */
function linkEvents(relationships: readonly PartyRelationship[], references: readonly ExternalReference[]): HistoryEvent[] {
  return [
    ...relationships.flatMap((relationship): HistoryEvent[] =>
      relationship.status === 'Ended' && relationship.validTo !== null ? [{ kind: 'relationshipEnded', at: date(relationship.validTo), relationship }] : [],
    ),
    ...references.flatMap((reference): HistoryEvent[] =>
      reference.syncStatus === 'Unlinked' && reference.updatedAt !== null
        ? [{ kind: 'referenceUnlinked', at: instant(reference.updatedAt), reference, actor: reference.updatedBy }]
        : [],
    ),
  ];
}

/** Lo más reciente primero. Fecha civil e instante se comparan por su día (`AAAA-MM-DD…` ordena como texto). */
export function deriveHistory(party: Party, relationships: readonly PartyRelationship[], references: readonly ExternalReference[], today: string): readonly HistoryEvent[] {
  return [...partyEvents(party), ...partEvents(party, today), ...linkEvents(relationships, references)].toSorted((a, b) => b.at.value.localeCompare(a.at.value));
}
