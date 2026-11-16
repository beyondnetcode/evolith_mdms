import type { PartyRelationship, StartRelationshipRequest } from '@mdm/contracts';
import { checkDate, isCivilDate, validitiesOverlap, type FieldIssue } from './field-rules.ts';
import type { RelationshipSide } from './relationship-state.ts';

/**
 * Borrador de D-MDM-06 «Nueva relación» (US-MDM-011; UX-MDM-001 §5.6). El sentido lo fija el tipo (contrato §5.3:
 * `PARENT_OF` va de la matriz a la filial): la persona elige qué papel tiene la organización de la ficha.
 */
export interface RelationshipDraft {
  readonly kindCode: string;
  /** Extremo de la organización de la ficha. */
  readonly side: RelationshipSide;
  /** `''`: sin elegir. Se elige con el buscador, nunca escribiendo el id (SU-MDM-08). */
  readonly otherPartyId: string;
  /** Vacío es hoy (R-02). */
  readonly validFrom: string;
  /** Vacío es indefinido. */
  readonly validTo: string;
}

export type RelationshipDraftField = 'kindCode' | 'otherPartyId' | 'validFrom' | 'validTo';
/** En el orden del formulario: el resumen de errores los lista así. */
export const RELATIONSHIP_DRAFT_FIELDS: readonly RelationshipDraftField[] = ['kindCode', 'otherPartyId', 'validFrom', 'validTo'];

export function emptyRelationshipDraft(today: string): RelationshipDraft {
  return { kindCode: '', side: 'from', otherPartyId: '', validFrom: today, validTo: '' };
}

/** La organización de la ficha, para no relacionarla consigo misma (`INV-PTY-12`). */
export interface CurrentParty {
  readonly id: string;
  readonly code: string;
}

/** Problemas locales: tipo y otra organización obligatorios, distinta de la actual, fechas válidas y «hasta» ≥ «desde». */
export function validateRelationshipDraft(draft: RelationshipDraft, current: CurrentParty, today: string): Partial<Record<RelationshipDraftField, FieldIssue>> {
  const from = draft.validFrom === '' ? today : draft.validFrom;
  const otherIssue: FieldIssue | null =
    draft.otherPartyId === '' ? { kind: 'required' } : draft.otherPartyId === current.id ? { kind: 'same_party', code: current.code } : null;
  const found: Array<readonly [RelationshipDraftField, FieldIssue | null]> = [
    ['kindCode', draft.kindCode === '' ? { kind: 'required' } : null],
    ['otherPartyId', otherIssue],
    ['validFrom', checkDate(draft.validFrom, { required: false, notBefore: null })],
    ['validTo', checkDate(draft.validTo, { required: false, notBefore: isCivilDate(from) ? from : null })],
  ];
  return Object.fromEntries(found.filter(([, issue]) => issue !== null));
}

/** Origen y destino según el extremo elegido. */
function ends(draft: RelationshipDraft, partyId: string): { readonly fromPartyId: string; readonly toPartyId: string } {
  return draft.side === 'from' ? { fromPartyId: partyId, toPartyId: draft.otherPartyId } : { fromPartyId: draft.otherPartyId, toPartyId: partyId };
}

/** Cuerpo de R-02. */
export function toStartRelationshipRequest(draft: RelationshipDraft, partyId: string): StartRelationshipRequest {
  return {
    ...ends(draft, partyId),
    kindCode: draft.kindCode,
    validFrom: draft.validFrom === '' ? null : draft.validFrom,
    validTo: draft.validTo === '' ? null : draft.validTo,
  };
}

/**
 * Relación cargada `Active` del mismo tipo y sentido entre las mismas organizaciones cuya vigencia se cruza con la del
 * borrador (`INV-PTY-12`). Es una ayuda: lo decide el servidor, porque otra persona pudo crear una después de cargar.
 */
export function findLoadedRelationshipOverlap(draft: RelationshipDraft, partyId: string, loaded: readonly PartyRelationship[], today: string): PartyRelationship | null {
  if (draft.kindCode === '' || draft.otherPartyId === '') return null;
  const validFrom = draft.validFrom === '' ? today : draft.validFrom;
  if (!isCivilDate(validFrom) || (draft.validTo !== '' && !isCivilDate(draft.validTo))) return null;
  const validity = { validFrom, validTo: draft.validTo === '' ? null : draft.validTo };
  const { fromPartyId, toPartyId } = ends(draft, partyId);
  return (
    loaded.find(
      (item) =>
        item.status === 'Active' && item.kindCode === draft.kindCode && item.fromPartyId === fromPartyId && item.toPartyId === toPartyId && validitiesOverlap(item, validity),
    ) ?? null
  );
}
