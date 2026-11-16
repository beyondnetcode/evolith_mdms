import { isTerminalPartyStatus, type CreatedResponse, type EndValidityRequest, type LinkExternalReferenceRequest, type StartRelationshipRequest, type WriteResult } from '@mdm/contracts';
import { RELATIONSHIP_KINDS } from './catalogs.ts';
import { overlaps } from './clock.ts';
import { checkReason, found, optionalDate, requireDate, requireOrderedValidity, requireText, type MockContext } from './context.ts';
import { conflict, preconditionFailed, unprocessable } from './errors.ts';
import type { ExternalReferenceRecord, PartyRecord, RelationshipRecord } from './store.ts';

/*
 * Relaciones y referencias externas: cada una es su propio agregado, con su versión. Crearlas o terminarlas no
 * sube la versión de ninguna Party (API-MDM-002 §2.1).
 */

/** R-02: `INV-PTY-12` (sin autorreferencia ni solape del mismo tipo y sentido) e `INV-PTY-11`. */
export function startRelationship(context: MockContext, request: StartRelationshipRequest): CreatedResponse {
  const today = context.clock.today();
  const validFrom = requireDate('validFrom', request.validFrom, today);
  const validTo = optionalDate('validTo', request.validTo);
  requireOrderedValidity(validFrom, validTo);
  if (request.fromPartyId === request.toPartyId) unprocessable('party_relationship.self_reference');
  if (!RELATIONSHIP_KINDS.some((kind) => kind.code === request.kindCode && kind.isActive)) unprocessable('party_relationship.kind_unknown');
  const ends = [context.store.parties.get(request.fromPartyId), context.store.parties.get(request.toPartyId)];
  if (ends.some((party) => party === undefined)) unprocessable('party_relationship.party_not_found');
  if (ends.some((party) => party !== undefined && isTerminalPartyStatus(party.status))) conflict('party_relationship.party_not_active');
  const clash = [...context.store.relationships.values()].some(
    (existing) =>
      existing.status === 'Active' &&
      existing.kindCode === request.kindCode &&
      existing.fromPartyId === request.fromPartyId &&
      existing.toPartyId === request.toPartyId &&
      overlaps({ from: existing.validFrom, to: existing.validTo }, { from: validFrom, to: validTo }),
  );
  if (clash) conflict('party_relationship.overlap');
  const relationship: RelationshipRecord = {
    id: context.store.newId(),
    fromPartyId: request.fromPartyId,
    toPartyId: request.toPartyId,
    kindCode: request.kindCode,
    validFrom,
    validTo,
    status: 'Active',
    version: 1,
    createdAt: context.clock.now(),
    createdBy: context.actor,
    updatedAt: null,
    updatedBy: null,
  };
  context.store.relationships.set(relationship.id, relationship);
  return { id: relationship.id, version: 1 };
}

function touch(record: RelationshipRecord | ExternalReferenceRecord, context: MockContext): WriteResult {
  record.version += 1;
  record.updatedAt = context.clock.now();
  record.updatedBy = context.actor;
  return { version: record.version };
}

/** R-04. */
export function endRelationship(context: MockContext, relationshipId: string, request: EndValidityRequest, ifMatch: number): WriteResult {
  const validTo = requireDate('validTo', request.validTo, context.clock.today());
  checkReason(request.reason);
  const relationship = found(context.store.relationships.get(relationshipId));
  requireOrderedValidity(relationship.validFrom, validTo);
  if (relationship.version !== ifMatch) preconditionFailed();
  if (relationship.status === 'Ended') conflict('party_relationship.already_ended');
  relationship.status = 'Ended';
  relationship.validTo = validTo;
  return touch(relationship, context);
}

/** El dueño del objeto que se vincula: la Party o la Party del establecimiento. */
function targetOf(context: MockContext, request: LinkExternalReferenceRequest): { readonly party: PartyRecord; readonly closed: boolean } {
  for (const party of context.store.parties.values()) {
    if (request.mdmObjectType === 'PARTY' && party.id === request.mdmObjectId) return { party, closed: false };
    const establishment = party.establishments.find((item) => item.id === request.mdmObjectId);
    if (request.mdmObjectType === 'ESTABLISHMENT' && establishment !== undefined) return { party, closed: establishment.isClosed };
  }
  return unprocessable('external_reference.target_not_found');
}

/** X-02: `INV-PTY-13` (la clave externa apunta a un solo objeto, aunque esté desvinculada). */
export function linkExternalReference(context: MockContext, request: LinkExternalReferenceRequest): CreatedResponse {
  const systemCode = requireText('systemCode', request.systemCode, 50, 'system_code');
  const systemInstance = requireText('systemInstance', request.systemInstance, 50, 'system_instance');
  const externalObjectType = requireText('externalObjectType', request.externalObjectType, 50, 'external_object_type');
  const externalKey = requireText('externalKey', request.externalKey, 100, 'external_key');
  const target = targetOf(context, request);
  if (isTerminalPartyStatus(target.party.status) || target.closed) conflict('external_reference.target_not_active');
  const duplicate = [...context.store.externalReferences.values()].some(
    (existing) =>
      existing.systemCode === systemCode &&
      existing.systemInstance === systemInstance &&
      existing.externalObjectType === externalObjectType &&
      existing.externalKey === externalKey,
  );
  if (duplicate) conflict('external_reference.key_duplicate');
  const reference: ExternalReferenceRecord = {
    id: context.store.newId(),
    systemCode,
    systemInstance,
    externalObjectType,
    externalKey,
    mdmObjectType: request.mdmObjectType,
    mdmObjectId: request.mdmObjectId,
    partyId: target.party.id,
    syncStatus: 'Linked',
    lastSyncedVersion: null,
    version: 1,
    createdAt: context.clock.now(),
    createdBy: context.actor,
    updatedAt: null,
    updatedBy: null,
  };
  context.store.externalReferences.set(reference.id, reference);
  return { id: reference.id, version: 1 };
}

/** X-04: desvincula (terminal, borrado lógico). */
export function unlinkExternalReference(context: MockContext, externalReferenceId: string, ifMatch: number): WriteResult {
  const reference = found(context.store.externalReferences.get(externalReferenceId));
  if (reference.version !== ifMatch) preconditionFailed();
  if (reference.syncStatus === 'Unlinked') conflict('external_reference.already_unlinked');
  reference.syncStatus = 'Unlinked';
  return touch(reference, context);
}
