import type { Address } from './party.ts';
import type { MdmObjectType, PartySortField, PartyStatus, PartyType, SortOrder, SyncStatus } from './vocabulary.ts';

/**
 * Consultas y cuerpos de escritura (API-MDM-002 §4 y §5.3). Lo opcional del contrato se expresa con `null`
 * explícito: el cliente HTTP omite el campo o el parámetro cuando es `null`, y las claves de caché son estables.
 */

/** Búsqueda exacta por identificador: los tres datos juntos o ninguno (P-01). */
export interface IdentifierFilter {
  readonly countryCode: string;
  readonly schemeCode: string;
  readonly value: string;
}

/** P-01. */
export interface PartyQuery {
  readonly search: string | null;
  readonly roleTypeCode: string | null;
  /** Ausente: todos menos `Archived` y `Merged`. El contrato admite un solo valor. */
  readonly status: PartyStatus | null;
  readonly type: PartyType | null;
  readonly identifier: IdentifierFilter | null;
  readonly sortBy: PartySortField;
  readonly sortOrder: SortOrder;
  readonly page: number;
  readonly pageSize: number;
}

export interface IdentifierInput {
  readonly countryCode: string;
  readonly schemeCode: string;
  readonly value: string;
  /** Por defecto, hoy. */
  readonly validFrom: string | null;
}

export interface RoleInput {
  readonly roleTypeCode: string;
  /** Por defecto, hoy. */
  readonly validFrom: string | null;
  /** Inclusivo; `null` es indefinido. */
  readonly validTo: string | null;
}

/** P-02. */
export interface RegisterPartyRequest {
  readonly type: PartyType;
  readonly code: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly primaryIdentifier: IdentifierInput;
  readonly roles: readonly RoleInput[];
}

/** P-04. */
export interface RenamePartyRequest {
  readonly legalName: string;
  readonly tradeName: string | null;
}

/** Cuerpo opcional de las acciones (`suspend`, `activate`…). */
export interface ReasonRequest {
  readonly reason: string | null;
}

/** P-10, P-15 y R-04. */
export interface EndValidityRequest {
  /** Por defecto, hoy. */
  readonly validTo: string | null;
  readonly reason: string | null;
}

/** P-09. */
export interface AddIdentifierRequest extends IdentifierInput {
  readonly isPrimary: boolean;
  /** Solo con `isPrimary`: vence el primario vigente con `validTo = validFrom − 1 día` (G-570). */
  readonly replacesPrimary: boolean;
}

/** P-19 (y base de P-18). */
export interface EstablishmentInput {
  readonly kindCode: string;
  readonly name: string;
  readonly taxEstablishmentCode: string | null;
  readonly isPrincipal: boolean;
  readonly address: Address;
}

/** P-18. */
export interface OpenEstablishmentRequest extends EstablishmentInput {
  readonly code: string;
}

/** R-02. */
export interface StartRelationshipRequest {
  readonly fromPartyId: string;
  readonly toPartyId: string;
  readonly kindCode: string;
  readonly validFrom: string | null;
  readonly validTo: string | null;
}

/** R-01. */
export interface RelationshipQuery {
  /** En cualquiera de los dos extremos. */
  readonly partyId: string | null;
  readonly kindCode: string | null;
  readonly currentOnly: boolean;
  readonly page: number;
  readonly pageSize: number;
}

/** X-02. */
export interface LinkExternalReferenceRequest {
  readonly systemCode: string;
  readonly systemInstance: string;
  readonly externalObjectType: string;
  readonly externalKey: string;
  readonly mdmObjectType: MdmObjectType;
  readonly mdmObjectId: string;
}

/**
 * Clave externa completa de X-01 (`systemCode`, `systemInstance`, `externalObjectType`, `externalKey`): los cuatro
 * datos juntos o ninguno, porque la unicidad (`INV-PTY-13`) es sobre los cuatro. Sirve para «Ver a qué está
 * vinculada» tras un `409` `external_reference.key_duplicate` (UX-MDM-001 §5.6).
 */
export interface ExternalKeyFilter {
  readonly systemCode: string;
  readonly systemInstance: string;
  readonly externalObjectType: string;
  readonly externalKey: string;
}

/** X-01. */
export interface ExternalReferenceQuery {
  readonly partyId: string | null;
  readonly mdmObject: { readonly type: MdmObjectType; readonly id: string } | null;
  readonly externalKey: ExternalKeyFilter | null;
  readonly syncStatus: SyncStatus | null;
  readonly page: number;
  readonly pageSize: number;
}

/** Filtros de C-01. */
export interface IdentifierSchemeFilter {
  readonly countryCode: string | null;
  readonly partyType: PartyType | null;
  readonly includeInactive: boolean;
}

/** Filtros de C-02. */
export interface RoleTypeFilter {
  readonly partyType: PartyType | null;
  readonly includeInactive: boolean;
}

/** C-06 (y base de C-05): lo editable de un tipo de rol. */
export interface RoleTypeInput {
  readonly name: string;
  readonly description: string | null;
  /** Dos letras mayúsculas o `null`. */
  readonly unEdifact3035Code: string | null;
  /** Al menos uno, sin repetir. */
  readonly allowedPartyTypes: readonly PartyType[];
  readonly requiresFiscalIdentifier: boolean;
}

/** C-05: el código se normaliza en el servidor y es inmutable y no reutilizable. */
export interface CreateRoleTypeRequest extends RoleTypeInput {
  readonly code: string;
}
