import {
  MAX_PAGE_SIZE,
  isTerminalPartyStatus,
  normalizeIdentifierValue,
  type Establishment,
  type EstablishmentStatusFilter,
  type ExternalReferencePage,
  type ExternalReferenceQuery,
  type IdentifierFilter,
  type PartyPage,
  type PartyQuery,
  type PartyRelationshipPage,
  type RelationshipQuery,
} from '@mdm/contracts';
import { findParty, type MockContext } from './context.ts';
import { badRequest, invalid } from './errors.ts';
import type { EstablishmentRecord, PartyRecord } from './store.ts';
import { isRoleCurrent, toEstablishment, toExternalReference, toRelationship, toSummary } from './views.ts';

function checkPaging(page: number, pageSize: number): void {
  if (!Number.isInteger(page) || page < 1) invalid('page', 'validation.page_invalid');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) invalid('pageSize', 'validation.page_size_invalid');
}

function paginate<T>(items: readonly T[], page: number, pageSize: number) {
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalCount: items.length,
    totalPages: Math.ceil(items.length / pageSize),
  };
}

function matchesIdentifier(party: PartyRecord, filter: IdentifierFilter): boolean {
  const value = normalizeIdentifierValue(filter.value);
  return party.identifiers.some((identifier) => identifier.countryCode === filter.countryCode && identifier.schemeCode === filter.schemeCode && identifier.value === value);
}

function matchesText(party: PartyRecord, search: string): boolean {
  const needle = search.toLocaleLowerCase('es');
  return [party.code, party.legalName, party.tradeName ?? ''].some((field) => field.toLocaleLowerCase('es').includes(needle));
}

/**
 * Filtro de estado de P-01: sin `status`, todas menos `Archived` y `Merged`, salvo en la búsqueda exacta por
 * identificador, que encuentra también las archivadas y fusionadas (`INV-PTY-02`).
 */
function matchesStatus(party: PartyRecord, query: PartyQuery): boolean {
  if (query.status !== null) return party.status === query.status;
  return query.identifier !== null || !isTerminalPartyStatus(party.status);
}

function matches(party: PartyRecord, query: PartyQuery, today: string): boolean {
  if (!matchesStatus(party, query)) return false;
  if (query.type !== null && party.type !== query.type) return false;
  if (query.identifier !== null && !matchesIdentifier(party, query.identifier)) return false;
  if (query.search !== null && !matchesText(party, query.search)) return false;
  return query.roleTypeCode === null || party.roles.some((role) => role.roleTypeCode === query.roleTypeCode && isRoleCurrent(role, today));
}

function sortKey(party: PartyRecord, query: PartyQuery): string {
  switch (query.sortBy) {
    case 'code':
      return party.code;
    case 'legalName':
      return party.legalName;
    case 'createdAt':
      return party.createdAt;
    case 'updatedAt':
      return party.updatedAt ?? party.createdAt;
  }
}

function checkIdentifierFilter(filter: IdentifierFilter | null): void {
  if (filter === null) return;
  const parts = [filter.countryCode, filter.schemeCode, filter.value].map((part) => part.trim());
  if (parts.some((part) => part === '')) badRequest('validation.identifier_filter_incomplete');
}

/** P-01. El desempate del orden es siempre por `id`. */
export function listParties(context: MockContext, query: PartyQuery): PartyPage {
  checkPaging(query.page, query.pageSize);
  checkIdentifierFilter(query.identifier);
  if (query.search !== null && query.search.trim().length > 200) invalid('search', 'validation.search_too_long');
  const today = context.clock.today();
  const direction = query.sortOrder === 'asc' ? 1 : -1;
  const found = [...context.store.parties.values()]
    .filter((party) => matches(party, { ...query, search: query.search?.trim() ?? null }, today))
    .toSorted((a, b) => direction * sortKey(a, query).localeCompare(sortKey(b, query), 'es') || a.id.localeCompare(b.id));
  return paginate(
    found.map((party) => toSummary(party, today)),
    query.page,
    query.pageSize,
  );
}

function matchesEstablishmentStatus(establishment: EstablishmentRecord, status: EstablishmentStatusFilter | null): boolean {
  switch (status) {
    case null:
      return true;
    case 'active':
      return establishment.isActive && !establishment.isClosed;
    case 'inactive':
      return !establishment.isActive && !establishment.isClosed;
    case 'closed':
      return establishment.isClosed;
  }
}

/** P-16. */
export function listEstablishments(context: MockContext, partyId: string, status: EstablishmentStatusFilter | null): readonly Establishment[] {
  const party = findParty(context, partyId);
  return party.establishments.filter((item) => matchesEstablishmentStatus(item, status)).map((item) => toEstablishment(item, party.id));
}

/** R-01. */
export function listRelationships(context: MockContext, query: RelationshipQuery): PartyRelationshipPage {
  checkPaging(query.page, query.pageSize);
  const today = context.clock.today();
  const items = [...context.store.relationships.values()]
    .map((relationship) => toRelationship(relationship, today))
    .filter((relationship) => query.partyId === null || relationship.fromPartyId === query.partyId || relationship.toPartyId === query.partyId)
    .filter((relationship) => query.kindCode === null || relationship.kindCode === query.kindCode)
    .filter((relationship) => !query.currentOnly || relationship.isCurrent);
  return paginate(items, query.page, query.pageSize);
}

/** X-01. */
export function listExternalReferences(context: MockContext, query: ExternalReferenceQuery): ExternalReferencePage {
  checkPaging(query.page, query.pageSize);
  const { mdmObject, externalKey: key } = query;
  const items = [...context.store.externalReferences.values()]
    .map(toExternalReference)
    .filter((reference) => query.partyId === null || reference.partyId === query.partyId)
    .filter((reference) => mdmObject === null || (reference.mdmObjectType === mdmObject.type && reference.mdmObjectId === mdmObject.id))
    .filter(
      (reference) =>
        key === null ||
        (reference.systemCode === key.systemCode &&
          reference.systemInstance === key.systemInstance &&
          reference.externalObjectType === key.externalObjectType &&
          reference.externalKey === key.externalKey),
    )
    .filter((reference) => query.syncStatus === null || reference.syncStatus === query.syncStatus);
  return paginate(items, query.page, query.pageSize);
}
