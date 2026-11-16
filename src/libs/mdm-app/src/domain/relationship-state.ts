import type { PartyRelationship, RelationshipKind } from '@mdm/contracts';

/**
 * Estado visible de una relación (UI-MDM-001 §2.5): `Active` y vigente → «Vigente»; `Active` no vigente → «Fuera de
 * vigencia» con su fecha, como el rol; `Ended` → «Terminada». `isCurrent` lo calcula el servidor.
 */
export type RelationshipDisplayState =
  | { readonly kind: 'current' }
  | { readonly kind: 'future'; readonly startsOn: string }
  | { readonly kind: 'expired'; readonly endedOn: string | null }
  | { readonly kind: 'ended' };

type RelationshipState = Pick<PartyRelationship, 'status' | 'isCurrent' | 'validFrom' | 'validTo'>;

export function relationshipDisplayState(relationship: RelationshipState, today: string): RelationshipDisplayState {
  if (relationship.status === 'Ended') return { kind: 'ended' };
  if (relationship.isCurrent) return { kind: 'current' };
  if (relationship.validFrom > today) return { kind: 'future', startsOn: relationship.validFrom };
  return { kind: 'expired', endedOn: relationship.validTo !== null && relationship.validTo < today ? relationship.validTo : null };
}

/** Extremo que ocupa la organización de la ficha en una relación: origen (`from`) o destino (`to`). */
export type RelationshipSide = 'from' | 'to';

/** La otra organización y el extremo de la actual. */
export interface RelationshipView {
  readonly side: RelationshipSide;
  readonly otherPartyId: string;
}

export function viewFrom(relationship: Pick<PartyRelationship, 'fromPartyId' | 'toPartyId'>, partyId: string): RelationshipView {
  return relationship.fromPartyId === partyId ? { side: 'from', otherPartyId: relationship.toPartyId } : { side: 'to', otherPartyId: relationship.fromPartyId };
}

/** Papel del extremo según el catálogo (C-04): «Matriz» o «Filial». Sin catálogo, `null`. */
export function sideLabel(kind: RelationshipKind | undefined, side: RelationshipSide): string | null {
  if (kind === undefined) return null;
  return side === 'from' ? kind.fromLabel : kind.toLabel;
}

const ORDER: Readonly<Record<RelationshipDisplayState['kind'], number>> = { current: 0, future: 1, expired: 2, ended: 3 };

/** Vigentes primero, después futuras, vencidas y terminadas; dentro de cada grupo, la más reciente. */
export function compareRelationships(today: string): (a: RelationshipState, b: RelationshipState) => number {
  return (a, b) => {
    const byState = ORDER[relationshipDisplayState(a, today).kind] - ORDER[relationshipDisplayState(b, today).kind];
    return byState !== 0 ? byState : b.validFrom.localeCompare(a.validFrom);
  };
}

/** Una relación terminada no admite ninguna orden (terminal). */
export function canEndRelationship(relationship: Pick<PartyRelationship, 'status'>): boolean {
  return relationship.status === 'Active';
}
