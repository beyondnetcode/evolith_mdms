import { formatCivilDate } from '@sil/ui';
import type { FieldIssue } from '../../domain/field-rules.ts';

/**
 * Mensajes de validación por campo (UX-MDM-001 §6.3): dicen qué falta y cómo corregirlo. Propuesta sin validar con
 * usuarios (SU-MDM-15).
 */
export type FieldKind =
  | 'code'
  | 'legalName'
  | 'tradeName'
  | 'countryCode'
  | 'schemeCode'
  | 'value'
  | 'roleTypeCode'
  | 'date'
  | 'validTo'
  | 'expireDate'
  | 'terminationDate'
  | 'establishmentCode'
  | 'establishmentName'
  | 'kindCode'
  | 'taxEstablishmentCode'
  | 'addressLine1'
  | 'addressLine2'
  | 'ubigeo'
  | 'department'
  | 'province'
  | 'district'
  | 'postalCode'
  | 'addressCountry'
  | 'reference'
  | 'relationshipKind'
  | 'otherParty'
  | 'systemCode'
  | 'systemInstance'
  | 'externalObjectType'
  | 'externalKey';

/** Pista del formato de cada esquema del catálogo; lo desconocido, con el nombre del esquema. */
const SCHEME_HINT: Readonly<Record<string, string>> = {
  'PE-RUC': 'El RUC tiene 11 dígitos.',
  'PE-DNI': 'El DNI tiene 8 dígitos.',
  'PE-PARTIDA': 'La partida registral tiene 8 dígitos.',
  'CL-RUT': 'El RUT tiene 8 o 9 caracteres, sin puntos ni guion, y termina en un dígito o en K.',
};

export function schemeHint(schemeCode: string, schemeName: string): string {
  return SCHEME_HINT[schemeCode] ?? `Revisa el formato de ${schemeName}.`;
}

const REQUIRED: Readonly<Record<FieldKind, string>> = {
  code: 'Escribe un código.',
  legalName: 'Escribe la razón social.',
  tradeName: 'Escribe el nombre comercial.',
  countryCode: 'Elige el país del identificador.',
  schemeCode: 'Elige el tipo de identificador.',
  value: 'Escribe el número del identificador.',
  roleTypeCode: 'Elige el tipo de rol.',
  date: 'Escribe la fecha como dd/mm/aaaa, por ejemplo 24/10/2026.',
  validTo: 'Escribe la fecha como dd/mm/aaaa, por ejemplo 24/10/2026.',
  expireDate: 'Escribe la fecha como dd/mm/aaaa, por ejemplo 24/10/2026.',
  terminationDate: 'Escribe la fecha como dd/mm/aaaa, por ejemplo 24/10/2026.',
  establishmentCode: 'Escribe un código.',
  establishmentName: 'Escribe el nombre del establecimiento.',
  // Propuesta (no figura en UX-MDM-001 §6.3).
  kindCode: 'Elige el tipo de establecimiento.',
  taxEstablishmentCode: 'El anexo tiene 4 dígitos, por ejemplo 0001.',
  addressLine1: 'Escribe la dirección.',
  addressLine2: 'Escribe la dirección.',
  ubigeo: 'El ubigeo tiene 6 dígitos, por ejemplo 150101.',
  department: 'Escribe el departamento.',
  province: 'Escribe la provincia.',
  district: 'Escribe el distrito.',
  postalCode: 'Escribe el código postal.',
  // UX pide «Elige el país.» con un selector; el contrato no publica catálogo de países: es un campo de texto con el código ISO.
  addressCountry: 'Escribe el país con su código de 2 letras, por ejemplo PE.',
  reference: 'Escribe la referencia.',
  // Propuesta (UX-MDM-001 §6.3 solo da el de la otra organización y «Escribe el {…}.» de la referencia).
  relationshipKind: 'Elige el tipo de relación.',
  otherParty: 'Elige la otra organización.',
  systemCode: 'Escribe el sistema.',
  systemInstance: 'Escribe la instancia.',
  externalObjectType: 'Escribe el tipo de objeto.',
  externalKey: 'Escribe la clave.',
};

const TOO_LONG: Readonly<Partial<Record<FieldKind, string>>> = {
  code: 'El código admite hasta 100 caracteres.',
  legalName: 'La razón social admite hasta 200 caracteres.',
  tradeName: 'El nombre comercial admite hasta 200 caracteres.',
  value: 'El identificador admite hasta 50 caracteres.',
  establishmentCode: 'El código admite hasta 100 caracteres.',
  establishmentName: 'El nombre admite hasta 200 caracteres.',
  addressLine1: 'La dirección admite hasta 200 caracteres.',
  addressLine2: 'La dirección admite hasta 200 caracteres.',
  department: 'El departamento admite hasta 100 caracteres.',
  province: 'La provincia admite hasta 100 caracteres.',
  district: 'El distrito admite hasta 100 caracteres.',
  postalCode: 'El código postal admite hasta 20 caracteres.',
  reference: 'La referencia admite hasta 200 caracteres.',
  systemCode: 'El sistema admite hasta 50 caracteres.',
  systemInstance: 'La instancia admite hasta 50 caracteres.',
  externalObjectType: 'El tipo de objeto admite hasta 50 caracteres.',
  externalKey: 'La clave admite hasta 100 caracteres.',
};

/** Formato fijo de cada campo que lo tiene (UX-MDM-001 §6.3; ubigeo y país, propuesta). */
const FORMAT: Readonly<Partial<Record<FieldKind, string>>> = {
  taxEstablishmentCode: 'El anexo tiene 4 dígitos, por ejemplo 0001.',
  ubigeo: 'El ubigeo tiene 6 dígitos, por ejemplo 150101.',
  addressCountry: 'Escribe el país con su código de 2 letras, por ejemplo PE.',
};

function beforeMessage(kind: FieldKind, from: string): string {
  const date = formatCivilDate(from);
  if (kind === 'expireDate') return `La fecha de vencimiento no puede ser anterior al ${date}.`;
  if (kind === 'terminationDate') return `La fecha de término no puede ser anterior al ${date}.`;
  return `La fecha de fin no puede ser anterior a la de inicio (${date}).`;
}

function overlapMessage(issue: Extract<FieldIssue, { kind: 'overlap' }>, roleNames: RoleNames): string {
  const until = issue.validTo === null ? 'sin fin' : formatCivilDate(issue.validTo);
  return `Se cruza con el rol ${roleNames[issue.roleTypeCode] ?? issue.roleTypeCode} del ${formatCivilDate(issue.validFrom)} al ${until}.`;
}

const DATE_FORMAT = 'Escribe la fecha como dd/mm/aaaa, por ejemplo 24/10/2026.';

/** Nombre visible de cada tipo de rol (C-02); sin catálogo, el código. */
export type RoleNames = Readonly<Record<string, string>>;

type DatedIssue = Extract<FieldIssue, { readonly kind: 'before' | 'out_of_range' | 'overlap' | 'pattern' | 'same_party' }>;
type PlainIssue = Exclude<FieldIssue, DatedIssue>;

function isDated(issue: FieldIssue): issue is DatedIssue {
  return issue.kind === 'before' || issue.kind === 'out_of_range' || issue.kind === 'overlap' || issue.kind === 'pattern' || issue.kind === 'same_party';
}

/** Problemas cuyo mensaje lleva datos (fechas, rol, esquema). */
function datedMessage(kind: FieldKind, issue: DatedIssue, roleNames: RoleNames): string {
  switch (issue.kind) {
    case 'pattern':
      return schemeHint(issue.schemeCode, issue.schemeName);
    case 'before':
      return beforeMessage(kind, issue.from);
    case 'out_of_range':
      return `La fecha de término debe estar entre el ${formatCivilDate(issue.from)} y el ${formatCivilDate(issue.to)}.`;
    case 'overlap':
      return overlapMessage(issue, roleNames);
    case 'same_party':
      return `Elige una organización distinta de ${issue.code}.`;
  }
}

function plainMessage(kind: FieldKind, issue: PlainIssue): string {
  switch (issue.kind) {
    case 'required':
      return REQUIRED[kind];
    case 'too_long':
      return TOO_LONG[kind] ?? 'El texto es demasiado largo.';
    case 'check_digit':
      return 'El RUC no es válido: revisa el último dígito.';
    case 'date_invalid':
      return DATE_FORMAT;
    case 'format':
      return FORMAT[kind] ?? 'Revisa el formato.';
    case 'taken':
      return 'Ya usaste este código en esta organización.';
    case 'not_applicable':
      // Propuesta (no figura en UX-MDM-001 §6.3): el contrato dice «Solo con countryCode PE».
      return 'El ubigeo solo se usa en direcciones de Perú (PE).';
  }
}

/** Texto del problema de un campo. */
export function fieldMessage(kind: FieldKind, issue: FieldIssue, roleNames: RoleNames = {}): string {
  return isDated(issue) ? datedMessage(kind, issue, roleNames) : plainMessage(kind, issue);
}
