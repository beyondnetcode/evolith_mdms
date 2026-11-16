import type { PartyRelationship } from '@mdm/contracts';
import { describe, expect, it } from 'vitest';
import { emptyReferenceDraft, linkedCount, toLinkRequest, validateReferenceDraft } from './reference-form.ts';
import { emptyRelationshipDraft, findLoadedRelationshipOverlap, toStartRelationshipRequest, validateRelationshipDraft } from './relationship-form.ts';
import { compareRelationships, relationshipDisplayState, viewFrom } from './relationship-state.ts';

const TODAY = '2026-10-24';
const ME = { id: 'b0000000-0000-4000-8000-000000000001', code: 'ORG' };
const OTHER = 'b0000000-0000-4000-8000-000000000002';

function relationship(fields: Partial<PartyRelationship>): PartyRelationship {
  return {
    id: 'f0000000-0000-4000-8000-000000000001',
    fromPartyId: ME.id,
    toPartyId: OTHER,
    kindCode: 'PARENT_OF',
    validFrom: '2024-01-01',
    validTo: null,
    isCurrent: true,
    status: 'Active',
    version: 1,
    createdAt: '2024-01-01T00:00:00Z',
    createdBy: 'x',
    updatedAt: null,
    updatedBy: null,
    ...fields,
  };
}

describe('relación: estado, sentido y borrador (US-MDM-011)', () => {
  it('estado derivado como el rol; terminada al final', () => {
    expect(relationshipDisplayState(relationship({}), TODAY)).toEqual({ kind: 'current' });
    expect(relationshipDisplayState(relationship({ isCurrent: false, validFrom: '2027-01-01' }), TODAY)).toEqual({ kind: 'future', startsOn: '2027-01-01' });
    expect(relationshipDisplayState(relationship({ isCurrent: false, validTo: '2025-01-01' }), TODAY)).toEqual({ kind: 'expired', endedOn: '2025-01-01' });
    expect(relationshipDisplayState(relationship({ status: 'Ended', validTo: '2025-01-01' }), TODAY)).toEqual({ kind: 'ended' });
    const sorted = [relationship({ status: 'Ended' }), relationship({})].toSorted(compareRelationships(TODAY));
    expect(sorted.map((item) => item.status)).toEqual(['Active', 'Ended']);
    expect(viewFrom(relationship({}), OTHER)).toEqual({ side: 'to', otherPartyId: ME.id });
  });

  it('la otra organización es obligatoria y distinta de la actual (INV-PTY-12); «hasta» ≥ «desde»', () => {
    const draft = emptyRelationshipDraft(TODAY);
    expect(validateRelationshipDraft(draft, ME, TODAY)).toEqual({ kindCode: { kind: 'required' }, otherPartyId: { kind: 'required' } });
    expect(validateRelationshipDraft({ ...draft, kindCode: 'PARENT_OF', otherPartyId: ME.id }, ME, TODAY)).toEqual({ otherPartyId: { kind: 'same_party', code: 'ORG' } });
    expect(validateRelationshipDraft({ ...draft, kindCode: 'PARENT_OF', otherPartyId: OTHER, validTo: '2026-01-01' }, ME, TODAY)).toEqual({
      validTo: { kind: 'before', from: TODAY },
    });
  });

  it('el sentido decide origen y destino; el solape se busca del mismo tipo y sentido', () => {
    const draft = { ...emptyRelationshipDraft(TODAY), kindCode: 'PARENT_OF', otherPartyId: OTHER };
    expect(toStartRelationshipRequest(draft, ME.id)).toEqual({ fromPartyId: ME.id, toPartyId: OTHER, kindCode: 'PARENT_OF', validFrom: TODAY, validTo: null });
    expect(toStartRelationshipRequest({ ...draft, side: 'to', validFrom: '' }, ME.id)).toMatchObject({ fromPartyId: OTHER, toPartyId: ME.id, validFrom: null });
    const loaded = [relationship({})];
    expect(findLoadedRelationshipOverlap(draft, ME.id, loaded, TODAY)).toBe(loaded[0]);
    expect(findLoadedRelationshipOverlap({ ...draft, side: 'to' }, ME.id, loaded, TODAY)).toBeNull();
    expect(findLoadedRelationshipOverlap(draft, ME.id, [relationship({ status: 'Ended' })], TODAY)).toBeNull();
  });
});

describe('referencia externa: borrador (US-MDM-012)', () => {
  it('todo obligatorio; el objeto decide el tipo; recorta la clave', () => {
    expect(Object.keys(validateReferenceDraft(emptyReferenceDraft()))).toEqual(['systemCode', 'systemInstance', 'externalObjectType', 'externalKey']);
    const draft = { target: 'e1', systemCode: ' ERP ', systemInstance: 'PRD', externalObjectType: 'BRANCH', externalKey: ' 1 ' };
    expect(toLinkRequest(draft, ME.id)).toEqual({ systemCode: 'ERP', systemInstance: 'PRD', externalObjectType: 'BRANCH', externalKey: '1', mdmObjectType: 'ESTABLISHMENT', mdmObjectId: 'e1' });
    expect(toLinkRequest({ ...draft, target: 'PARTY' }, ME.id)).toMatchObject({ mdmObjectType: 'PARTY', mdmObjectId: ME.id });
    expect(linkedCount([{ syncStatus: 'Linked' }, { syncStatus: 'Unlinked' }, { syncStatus: 'SyncFailed' }])).toBe(2);
  });
});
