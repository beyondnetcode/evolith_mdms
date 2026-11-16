import { array, boolean, civilDate, integer, nullable, object, oneOf, text, uuid, type Parser } from './parse.ts';
import { auditShape, catalogCode, pageInfoShape, pageOf, version, type Audit, type PageInfo } from './party.ts';
import { MDM_OBJECT_TYPES, RELATIONSHIP_STATUSES, SYNC_STATUSES, type MdmObjectType, type RelationshipStatus, type SyncStatus } from './vocabulary.ts';

/** Relaciones entre Parties (R-01 a R-04) y referencias externas del ERP (X-01 a X-04). Cada una es su propio agregado. */

export interface PartyRelationship extends Audit {
  readonly id: string;
  readonly fromPartyId: string;
  readonly toPartyId: string;
  readonly kindCode: string;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly isCurrent: boolean;
  readonly status: RelationshipStatus;
  /** Versión propia: crear o terminar una relación no sube la versión de ninguna Party. */
  readonly version: number;
}

export interface PartyRelationshipPage extends PageInfo {
  readonly items: readonly PartyRelationship[];
}

export interface ExternalReference extends Audit {
  readonly id: string;
  readonly systemCode: string;
  readonly systemInstance: string;
  readonly externalObjectType: string;
  readonly externalKey: string;
  readonly mdmObjectType: MdmObjectType;
  readonly mdmObjectId: string;
  /** La Party, o la dueña del establecimiento. */
  readonly partyId: string;
  readonly syncStatus: SyncStatus;
  readonly lastSyncedVersion: number | null;
  readonly version: number;
}

export interface ExternalReferencePage extends PageInfo {
  readonly items: readonly ExternalReference[];
}

export const parsePartyRelationship: Parser<PartyRelationship> = object<PartyRelationship>({
  ...auditShape,
  id: uuid,
  fromPartyId: uuid,
  toPartyId: uuid,
  kindCode: catalogCode,
  validFrom: civilDate,
  validTo: nullable(civilDate),
  isCurrent: boolean,
  status: oneOf(RELATIONSHIP_STATUSES),
  version,
});

export const parsePartyRelationshipPage: Parser<PartyRelationshipPage> = pageOf(
  object<PartyRelationshipPage>({ ...pageInfoShape, items: array(parsePartyRelationship) }),
);

export const parseExternalReference: Parser<ExternalReference> = object<ExternalReference>({
  ...auditShape,
  id: uuid,
  systemCode: text({ min: 1, max: 50 }),
  systemInstance: text({ min: 1, max: 50 }),
  externalObjectType: text({ min: 1, max: 50 }),
  externalKey: text({ min: 1, max: 100 }),
  mdmObjectType: oneOf(MDM_OBJECT_TYPES),
  mdmObjectId: uuid,
  partyId: uuid,
  syncStatus: oneOf(SYNC_STATUSES),
  lastSyncedVersion: nullable(integer(1)),
  version,
});

export const parseExternalReferencePage: Parser<ExternalReferencePage> = pageOf(
  object<ExternalReferencePage>({ ...pageInfoShape, items: array(parseExternalReference) }),
);
