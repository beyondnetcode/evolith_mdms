/**
 * Enumeraciones cerradas del contrato de Party (API-MDM-002, `components/schemas`). Los literales se conservan
 * tal cual los publica el contrato (D-025): `Active`, `ORGANIZATION`, `PE-RUC`.
 */

export const PARTY_TYPES = ['ORGANIZATION', 'PERSON'] as const;
export type PartyType = (typeof PARTY_TYPES)[number];

export const PARTY_STATUSES = ['Active', 'Suspended', 'Archived', 'Merged'] as const;
export type PartyStatus = (typeof PARTY_STATUSES)[number];

/** `Archived` y `Merged` son terminales: solo lectura (`INV-PTY-11`). */
export function isTerminalPartyStatus(status: PartyStatus): boolean {
  return status === 'Archived' || status === 'Merged';
}

/** Literales del rol tomados de DOM-MDM-002 §4.4 (SU-UI-MDM-05, G-585). */
export const ROLE_STATUSES = ['Active', 'Suspended', 'Terminated'] as const;
export type RoleStatus = (typeof ROLE_STATUSES)[number];

export const RELATIONSHIP_STATUSES = ['Active', 'Ended'] as const;
export type RelationshipStatus = (typeof RELATIONSHIP_STATUSES)[number];

export const SYNC_STATUSES = ['Linked', 'PendingSync', 'SyncFailed', 'Unlinked'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const MDM_OBJECT_TYPES = ['PARTY', 'ESTABLISHMENT'] as const;
export type MdmObjectType = (typeof MDM_OBJECT_TYPES)[number];

/** Filtro `status` de P-16. */
export const ESTABLISHMENT_STATUS_FILTERS = ['active', 'inactive', 'closed'] as const;
export type EstablishmentStatusFilter = (typeof ESTABLISHMENT_STATUS_FILTERS)[number];

/** `sortBy` de P-01. */
export const PARTY_SORT_FIELDS = ['code', 'legalName', 'createdAt', 'updatedAt'] as const;
export type PartySortField = (typeof PARTY_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/** Límites de `pageSize` de P-01 (§4 del contrato). */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
