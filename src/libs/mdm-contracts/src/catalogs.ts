import { array, boolean, nullable, object, oneOf, text, type Parser } from './parse.ts';
import { auditShape, catalogCode, countryCode, version, type Audit } from './party.ts';
import { EDIFACT_3035_PATTERN } from './role-types.ts';
import { PARTY_TYPES, type PartyType } from './vocabulary.ts';

/**
 * Catálogos (C-01 a C-04). Se devuelven completos, sin paginar: `{ "items": [ … ] }`. Los tipos de rol son
 * administrables desde MDM (C-05 a C-08, D-046), con versión propia por tipo; el resto es de solo lectura (G-555).
 */

export interface IdentifierScheme {
  readonly code: string;
  readonly countryCode: string;
  readonly name: string;
  readonly issuingAuthority: string | null;
  /** Expresión regular que valida el valor normalizado. */
  readonly pattern: string;
  readonly isFiscal: boolean;
  readonly iso6523Icd: string | null;
  readonly allowedPartyTypes: readonly PartyType[];
  readonly isActive: boolean;
}

/**
 * Tipo de rol (D-046). El `code` es inmutable y no se reutiliza, ni el de un tipo desactivado. Un tipo desactivado no
 * se asigna a roles nuevos; los roles existentes se conservan.
 */
export interface PartyRoleType extends Audit {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  /** Código del calificador de parte UN/EDIFACT 3035 (dos letras), como código y no como estructura. */
  readonly unEdifact3035Code: string | null;
  readonly allowedPartyTypes: readonly PartyType[];
  readonly requiresFiscalIdentifier: boolean;
  readonly isActive: boolean;
  /** Versión propia del tipo: es su `ETag` y la que exige `If-Match` en C-06 a C-08. */
  readonly version: number;
}

export interface EstablishmentKind {
  readonly code: string;
  readonly name: string;
  /** `false` para `WAREHOUSE` en la primera entrega (G-547). */
  readonly isSupported: boolean;
  readonly isActive: boolean;
}

export interface RelationshipKind {
  readonly code: string;
  readonly name: string;
  /** Papel del extremo `from` («Matriz»). */
  readonly fromLabel: string;
  /** Papel del extremo `to` («Filial»). */
  readonly toLabel: string;
  readonly isActive: boolean;
}

export interface CatalogPage<T> {
  readonly items: readonly T[];
}

/** El patrón del esquema debe ser una expresión regular válida: si no, el catálogo no es utilizable. */
const regexSource: Parser<string> = (input, path) => {
  const result = text({ min: 1, max: 200 })(input, path);
  if (!result.ok) return result;
  try {
    new RegExp(result.value);
    return result;
  } catch {
    return { ok: false, path, expected: 'expresión regular válida' };
  }
};

const partyTypes = array(oneOf(PARTY_TYPES));

export const parseIdentifierScheme: Parser<IdentifierScheme> = object<IdentifierScheme>({
  code: catalogCode,
  countryCode,
  name: text({ max: 200 }),
  issuingAuthority: nullable(text({ max: 200 })),
  pattern: regexSource,
  isFiscal: boolean,
  iso6523Icd: nullable(text({ pattern: /^[0-9]{4}$/ })),
  allowedPartyTypes: partyTypes,
  isActive: boolean,
});

export const parsePartyRoleType: Parser<PartyRoleType> = object<PartyRoleType>({
  ...auditShape,
  code: catalogCode,
  name: text({ min: 1, max: 200 }),
  description: nullable(text({ max: 500 })),
  unEdifact3035Code: nullable(text({ pattern: EDIFACT_3035_PATTERN })),
  allowedPartyTypes: array(oneOf(PARTY_TYPES), PARTY_TYPES.length),
  requiresFiscalIdentifier: boolean,
  isActive: boolean,
  version,
});

export const parseEstablishmentKind: Parser<EstablishmentKind> = object<EstablishmentKind>({
  code: catalogCode,
  name: text({ max: 200 }),
  isSupported: boolean,
  isActive: boolean,
});

export const parseRelationshipKind: Parser<RelationshipKind> = object<RelationshipKind>({
  code: catalogCode,
  name: text({ max: 200 }),
  fromLabel: text({ max: 100 }),
  toLabel: text({ max: 100 }),
  isActive: boolean,
});

export function catalogOf<T>(parser: Parser<T>): Parser<CatalogPage<T>> {
  return object<CatalogPage<T>>({ items: array(parser) });
}
