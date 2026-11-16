import type { Establishment, ExternalReference, Party, PartyIdentifier, PartyRelationship, PartyRole, PartySummary } from '@mdm/contracts';
import { isWithin } from './clock.ts';
import type { EstablishmentRecord, ExternalReferenceRecord, IdentifierRecord, PartyRecord, RelationshipRecord, RoleRecord } from './store.ts';

/*
 * Lecturas: copias nuevas de los registros con los campos que el servidor calcula al leer (`isCurrent`).
 * Nada de lo que sale comparte referencias con el almacén.
 */

export function isIdentifierCurrent(identifier: IdentifierRecord, today: string): boolean {
  return isWithin(identifier.validFrom, identifier.validTo, today);
}

/** La vigencia manda sobre el estado: un rol `Active` fuera de sus fechas no es vigente. */
export function isRoleCurrent(role: RoleRecord, today: string): boolean {
  return role.status === 'Active' && isWithin(role.validFrom, role.validTo, today);
}

export function isRelationshipCurrent(relationship: RelationshipRecord, today: string): boolean {
  return relationship.status === 'Active' && isWithin(relationship.validFrom, relationship.validTo, today);
}

export function toIdentifier(identifier: IdentifierRecord, today: string): PartyIdentifier {
  return { ...identifier, isCurrent: isIdentifierCurrent(identifier, today) };
}

export function toRole(role: RoleRecord, today: string): PartyRole {
  return { ...role, isCurrent: isRoleCurrent(role, today) };
}

export function toEstablishment(establishment: EstablishmentRecord, partyId: string): Establishment {
  return { ...establishment, partyId, address: { ...establishment.address } };
}

export function currentPrimary(party: PartyRecord, today: string): IdentifierRecord | undefined {
  return party.identifiers.find((identifier) => identifier.isPrimary && isIdentifierCurrent(identifier, today));
}

export function toParty(party: PartyRecord, today: string): Party {
  return {
    id: party.id,
    type: party.type,
    code: party.code,
    legalName: party.legalName,
    tradeName: party.tradeName,
    status: party.status,
    version: party.version,
    identifiers: party.identifiers.map((identifier) => toIdentifier(identifier, today)),
    roles: party.roles.map((role) => toRole(role, today)),
    establishments: party.establishments.map((establishment) => toEstablishment(establishment, party.id)),
    createdAt: party.createdAt,
    createdBy: party.createdBy,
    updatedAt: party.updatedAt,
    updatedBy: party.updatedBy,
  };
}

export function toSummary(party: PartyRecord, today: string): PartySummary {
  const primary = currentPrimary(party, today);
  const currentRoles = new Set(party.roles.filter((role) => isRoleCurrent(role, today)).map((role) => role.roleTypeCode));
  return {
    id: party.id,
    type: party.type,
    code: party.code,
    legalName: party.legalName,
    tradeName: party.tradeName,
    status: party.status,
    primaryIdentifier: primary === undefined ? null : toIdentifier(primary, today),
    currentRoleTypeCodes: [...currentRoles].toSorted(),
    version: party.version,
    updatedAt: party.updatedAt,
  };
}

export function toRelationship(relationship: RelationshipRecord, today: string): PartyRelationship {
  return { ...relationship, isCurrent: isRelationshipCurrent(relationship, today) };
}

export function toExternalReference(reference: ExternalReferenceRecord): ExternalReference {
  return { ...reference };
}
