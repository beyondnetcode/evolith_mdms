import { normalizeIdentifierValue, type IdentifierScheme, type RegisterPartyRequest, type RoleInput } from '@mdm/contracts';
import { checkDate, checkIdentifierValue, checkText, isCivilDate, validitiesOverlap, type FieldIssue } from './field-rules.ts';

/**
 * Borrador del alta de organización (P-MDM-03, US-MDM-003): lo que la persona escribe, tal cual, para conservarlo
 * entre envíos y ante cualquier error (WCAG 3.3.7). Las fechas son `AAAA-MM-DD` o el texto escrito si aún no es
 * una fecha válida; `''` es «sin fecha».
 */
export interface RoleDraft {
  /** Clave estable de la fila (no se reutiliza al quitar filas): da nombre a sus campos. */
  readonly key: number;
  readonly roleTypeCode: string;
  readonly validFrom: string;
  readonly validTo: string;
}

export interface OrganizationDraft {
  readonly code: string;
  readonly legalName: string;
  readonly tradeName: string;
  readonly countryCode: string;
  readonly schemeCode: string;
  readonly value: string;
  readonly validFrom: string;
  readonly roles: readonly RoleDraft[];
}

export type RoleField = 'roleTypeCode' | 'validFrom' | 'validTo';
export type IdentifierField = 'countryCode' | 'schemeCode' | 'value' | 'validFrom';
/** Campos del formulario; los de cada rol inicial llevan la clave de su fila. */
export type OrganizationField = 'code' | 'legalName' | 'tradeName' | IdentifierField | `role-${number}-${RoleField}`;

export interface OrganizationIssue {
  readonly field: OrganizationField;
  readonly issue: FieldIssue;
}

export function roleField(key: number, field: RoleField): OrganizationField {
  return `role-${key}-${field}`;
}

/** Límites de P-02 (API-MDM-002 §5.1). */
export const CODE_MAX = 100;
export const NAME_MAX = 200;

export function emptyDraft(today: string): OrganizationDraft {
  return {
    code: '',
    legalName: '',
    tradeName: '',
    countryCode: 'PE',
    schemeCode: 'PE-RUC',
    value: '',
    validFrom: today,
    roles: [],
  };
}

function issue(field: OrganizationField, found: FieldIssue | null): OrganizationIssue[] {
  return found === null ? [] : [{ field, issue: found }];
}

function identifierIssues(draft: OrganizationDraft, schemes: readonly IdentifierScheme[]): OrganizationIssue[] {
  const scheme = schemes.find((item) => item.code === draft.schemeCode && item.countryCode === draft.countryCode);
  return [
    ...issue('countryCode', draft.countryCode === '' ? { kind: 'required' } : null),
    ...issue('schemeCode', scheme === undefined ? { kind: 'required' } : null),
    ...issue('value', checkIdentifierValue(draft.value, scheme)),
    ...issue('validFrom', checkDate(draft.validFrom, { required: false, notBefore: null })),
  ];
}

/** Vigencia efectiva de un rol del borrador (sin «desde», hoy), si sus fechas son válidas. */
function validityOf(role: RoleDraft, today: string): { readonly validFrom: string; readonly validTo: string | null } | null {
  const validFrom = role.validFrom === '' ? today : role.validFrom;
  if (!isCivilDate(validFrom) || (role.validTo !== '' && !isCivilDate(role.validTo))) return null;
  return { validFrom, validTo: role.validTo === '' ? null : role.validTo };
}

/** Primer rol anterior del mismo tipo cuya vigencia se cruza con la de `index` (`INV-PTY-05`). */
function overlapOf(roles: readonly RoleDraft[], index: number, today: string): FieldIssue | null {
  const role = roles[index];
  const validity = role === undefined ? null : validityOf(role, today);
  if (role === undefined || validity === null || role.roleTypeCode === '') return null;
  for (const other of roles.slice(0, index)) {
    const otherValidity = validityOf(other, today);
    if (other.roleTypeCode === role.roleTypeCode && otherValidity !== null && validitiesOverlap(otherValidity, validity)) {
      return {
        kind: 'overlap',
        roleTypeCode: other.roleTypeCode,
        ...otherValidity,
      };
    }
  }
  return null;
}

function roleIssues(roles: readonly RoleDraft[], today: string): OrganizationIssue[] {
  return roles.flatMap((role, index) => {
    const validFromIssue = checkDate(role.validFrom, {
      required: false,
      notBefore: null,
    });
    const from = role.validFrom === '' ? today : role.validFrom;
    const validToIssue = checkDate(role.validTo, {
      required: false,
      notBefore: validFromIssue === null ? from : null,
    });
    return [
      ...issue(roleField(role.key, 'roleTypeCode'), role.roleTypeCode === '' ? { kind: 'required' } : null),
      ...issue(roleField(role.key, 'validFrom'), validFromIssue),
      ...issue(roleField(role.key, 'validTo'), validToIssue ?? overlapOf(roles, index, today)),
    ];
  });
}

/** Todos los problemas del borrador, en el orden de los campos en pantalla (para el resumen de errores). */
export function validateOrganization(draft: OrganizationDraft, schemes: readonly IdentifierScheme[], today: string): readonly OrganizationIssue[] {
  return [
    ...issue('code', checkText(draft.code, { required: true, max: CODE_MAX })),
    ...issue('legalName', checkText(draft.legalName, { required: true, max: NAME_MAX })),
    ...issue('tradeName', checkText(draft.tradeName, { required: false, max: NAME_MAX })),
    ...identifierIssues(draft, schemes),
    ...roleIssues(draft.roles, today),
  ];
}

function optional(value: string): string | null {
  const clean = value.trim();
  return clean === '' ? null : clean;
}

function toRoleInput(role: RoleDraft): RoleInput {
  return {
    roleTypeCode: role.roleTypeCode,
    validFrom: optional(role.validFrom),
    validTo: optional(role.validTo),
  };
}

/** Cuerpo de P-02. El tipo no se pregunta: es `ORGANIZATION` (UX-MDM-001 §1, G-534). */
export function toRegisterRequest(draft: OrganizationDraft): RegisterPartyRequest {
  return {
    type: 'ORGANIZATION',
    code: draft.code.trim(),
    legalName: draft.legalName.trim(),
    tradeName: optional(draft.tradeName),
    primaryIdentifier: {
      countryCode: draft.countryCode,
      schemeCode: draft.schemeCode,
      value: normalizeIdentifierValue(draft.value),
      validFrom: optional(draft.validFrom),
    },
    roles: draft.roles.map(toRoleInput),
  };
}

/** ¿Escribió algo la persona? Decide si «Cancelar» pide confirmación. */
export function isDraftTouched(draft: OrganizationDraft, initial: OrganizationDraft): boolean {
  return (
    draft.code.trim() !== '' ||
    draft.legalName.trim() !== '' ||
    draft.tradeName.trim() !== '' ||
    draft.value.trim() !== initial.value.trim() ||
    draft.roles.length > 0
  );
}

const COUNTRY = /^[A-Z]{2}$/;
const CATALOG_CODE = /^[A-Z0-9_-]{1,50}$/;

/**
 * Identificador que llega de una búsqueda sin resultado (`?pais=&esquema=&valor=`, WCAG 3.3.7). La URL es
 * entrada no confiable: lo que no tiene la forma del contrato se descarta.
 */
export function prefilledIdentifier(params: URLSearchParams): Pick<OrganizationDraft, 'countryCode' | 'schemeCode' | 'value'> | null {
  const countryCode = params.get('pais') ?? '';
  const schemeCode = params.get('esquema') ?? '';
  const value = normalizeIdentifierValue(params.get('valor') ?? '').slice(0, 50);
  if (!COUNTRY.test(countryCode) || !CATALOG_CODE.test(schemeCode) || value === '') return null;
  return { countryCode, schemeCode, value };
}
