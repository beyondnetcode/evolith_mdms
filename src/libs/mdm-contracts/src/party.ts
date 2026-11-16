import { array, boolean, civilDate, instant, integer, nullable, object, oneOf, text, uuid, type Parser } from './parse.ts';
import { PARTY_STATUSES, PARTY_TYPES, ROLE_STATUSES, MAX_PAGE_SIZE, type PartyStatus, type PartyType, type RoleStatus } from './vocabulary.ts';

/** Lecturas de Party (API-MDM-002 §5.2, `PartySummary`, `Party`, `PartyIdentifier`, `PartyRole`, `Establishment`). */

export interface PartyIdentifier {
  readonly identifierId: string;
  readonly countryCode: string;
  readonly schemeCode: string;
  readonly value: string;
  readonly isPrimary: boolean;
  readonly validFrom: string;
  readonly validTo: string | null;
  /** Vigente hoy (fecha de `America/Lima`, G-575). */
  readonly isCurrent: boolean;
}

export interface PartyRole {
  readonly roleId: string;
  readonly roleTypeCode: string;
  readonly status: RoleStatus;
  readonly validFrom: string;
  readonly validTo: string | null;
  /** `Active` y dentro de su vigencia hoy: la vigencia manda sobre el estado. */
  readonly isCurrent: boolean;
}

export interface Address {
  readonly line1: string;
  readonly line2: string | null;
  readonly ubigeo: string | null;
  readonly department: string | null;
  readonly province: string | null;
  readonly district: string | null;
  readonly postalCode: string | null;
  readonly countryCode: string;
  readonly reference: string | null;
}

export interface Establishment {
  readonly id: string;
  readonly partyId: string;
  readonly code: string;
  readonly kindCode: string;
  readonly name: string;
  readonly taxEstablishmentCode: string | null;
  readonly isPrincipal: boolean;
  /** Un establecimiento cerrado se publica con `false`. */
  readonly isActive: boolean;
  readonly isClosed: boolean;
  readonly closedAt: string | null;
  readonly closedBy: string | null;
  readonly address: Address;
}

export interface Audit {
  readonly createdAt: string;
  readonly createdBy: string;
  readonly updatedAt: string | null;
  readonly updatedBy: string | null;
}

export interface Party extends Audit {
  readonly id: string;
  readonly type: PartyType;
  readonly code: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly status: PartyStatus;
  /** Versión del agregado: es su `ETag` y la que exige `If-Match` en toda escritura sobre la Party y sus partes. */
  readonly version: number;
  readonly identifiers: readonly PartyIdentifier[];
  readonly roles: readonly PartyRole[];
  readonly establishments: readonly Establishment[];
}

export interface PartySummary {
  readonly id: string;
  readonly type: PartyType;
  readonly code: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly status: PartyStatus;
  readonly primaryIdentifier: PartyIdentifier | null;
  readonly currentRoleTypeCodes: readonly string[];
  readonly version: number;
  readonly updatedAt: string | null;
}

export interface PageInfo {
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
}

export interface PartyPage extends PageInfo {
  readonly items: readonly PartySummary[];
}

// Analizadores: la forma exacta del OpenAPI (longitudes, patrones y enumeraciones).

export const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
export const CATALOG_CODE_PATTERN = /^[A-Z0-9_-]+$/;

export const countryCode = text({ min: 2, max: 2, pattern: COUNTRY_CODE_PATTERN });
export const catalogCode = text({ min: 1, max: 50, pattern: CATALOG_CODE_PATTERN });
export const partyCode = text({ min: 1, max: 100 });
export const actor = text({ max: 200 });
export const version = integer(1);
const name200 = text({ max: 200 });
const optionalText = (max: number) => nullable(text({ max }));

export const parsePartyIdentifier: Parser<PartyIdentifier> = object<PartyIdentifier>({
  identifierId: uuid,
  countryCode,
  schemeCode: catalogCode,
  value: text({ min: 1, max: 50 }),
  isPrimary: boolean,
  validFrom: civilDate,
  validTo: nullable(civilDate),
  isCurrent: boolean,
});

export const parsePartyRole: Parser<PartyRole> = object<PartyRole>({
  roleId: uuid,
  roleTypeCode: catalogCode,
  status: oneOf(ROLE_STATUSES),
  validFrom: civilDate,
  validTo: nullable(civilDate),
  isCurrent: boolean,
});

export const parseAddress: Parser<Address> = object<Address>({
  line1: text({ min: 1, max: 200 }),
  line2: optionalText(200),
  ubigeo: nullable(text({ pattern: /^[0-9]{6}$/ })),
  department: optionalText(100),
  province: optionalText(100),
  district: optionalText(100),
  postalCode: optionalText(20),
  countryCode,
  reference: optionalText(200),
});

export const parseEstablishment: Parser<Establishment> = object<Establishment>({
  id: uuid,
  partyId: uuid,
  code: partyCode,
  kindCode: catalogCode,
  name: name200,
  taxEstablishmentCode: nullable(text({ pattern: /^[0-9]{4}$/ })),
  isPrincipal: boolean,
  isActive: boolean,
  isClosed: boolean,
  closedAt: nullable(instant),
  closedBy: nullable(actor),
  address: parseAddress,
});

export const auditShape = {
  createdAt: instant,
  createdBy: actor,
  updatedAt: nullable(instant),
  updatedBy: nullable(actor),
} as const;

const parsePartyFields = object<Party>({
  ...auditShape,
  id: uuid,
  type: oneOf(PARTY_TYPES),
  code: partyCode,
  legalName: text({ min: 1, max: 200 }),
  tradeName: optionalText(200),
  status: oneOf(PARTY_STATUSES),
  version,
  identifiers: array(parsePartyIdentifier),
  roles: array(parsePartyRole),
  establishments: array(parseEstablishment),
});

/** La ficha (P-03). Además de la forma, comprueba que cada establecimiento sea de esta Party. */
export const parseParty: Parser<Party> = (input, path) => {
  const result = parsePartyFields(input, path);
  if (!result.ok) return result;
  const foreign = result.value.establishments.findIndex((establishment) => establishment.partyId !== result.value.id);
  return foreign === -1 ? result : { ok: false, path: `${path}.establishments[${foreign}].partyId`, expected: 'el id de la Party' };
};

export const parsePartySummary: Parser<PartySummary> = object<PartySummary>({
  id: uuid,
  type: oneOf(PARTY_TYPES),
  code: partyCode,
  legalName: text({ min: 1, max: 200 }),
  tradeName: optionalText(200),
  status: oneOf(PARTY_STATUSES),
  primaryIdentifier: nullable(parsePartyIdentifier),
  currentRoleTypeCodes: array(catalogCode),
  version,
  updatedAt: nullable(instant),
});

export const pageInfoShape = {
  page: integer(1),
  pageSize: integer(1, MAX_PAGE_SIZE),
  totalCount: integer(0),
  totalPages: integer(0),
} as const;

/** Una página de P-01. Además de la forma, que no traiga más elementos que su tamaño de página. */
export function pageOf<T extends PageInfo & { readonly items: readonly unknown[] }>(parser: Parser<T>): Parser<T> {
  return (input, path) => {
    const result = parser(input, path);
    if (!result.ok) return result;
    return result.value.items.length <= result.value.pageSize ? result : { ok: false, path: `${path}.items`, expected: 'no más elementos que pageSize' };
  };
}

export const parsePartyPage: Parser<PartyPage> = pageOf(object<PartyPage>({ ...pageInfoShape, items: array(parsePartySummary) }));
