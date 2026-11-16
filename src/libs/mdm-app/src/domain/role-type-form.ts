import {
  ROLE_TYPE_DESCRIPTION_MAX,
  ROLE_TYPE_NAME_MAX,
  isValidEdifact3035Code,
  isValidRoleTypeCode,
  normalizeEdifact3035Code,
  normalizeRoleTypeCode,
  type CreateRoleTypeRequest,
  type PartyRoleType,
  type PartyType,
  type RoleTypeInput,
} from '@mdm/contracts';

/**
 * Formulario de alta y edición de un tipo de rol (P-MDM-04, US-MDM-014, D-046). Las reglas anticipan las del contrato
 * (C-05, C-06); el servidor decide igualmente. Devuelven el problema, no el texto: el texto es de la presentación.
 */
export interface RoleTypeDraft {
  /** Solo en el alta: después el código es inmutable. */
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly unEdifact3035Code: string;
  readonly organization: boolean;
  readonly person: boolean;
  readonly requiresFiscalIdentifier: boolean;
}

/** Campos con error, en el orden del formulario (el del resumen de errores). */
export const ROLE_TYPE_FIELDS = ['code', 'name', 'description', 'unEdifact3035Code', 'allowedPartyTypes'] as const;
export type RoleTypeField = (typeof ROLE_TYPE_FIELDS)[number];

export type RoleTypeIssue =
  | { readonly kind: 'required' }
  | { readonly kind: 'too_long' }
  /** No cumple el patrón del código (`party_role_type.code_invalid`). */
  | { readonly kind: 'code_format' }
  /** Ya existe en el catálogo cargado, aunque esté desactivado (`party_role_type.code_duplicate`). */
  | { readonly kind: 'taken' }
  /** No son dos letras (`party_role_type.edifact_invalid`). */
  | { readonly kind: 'edifact_format' };

export type RoleTypeIssues = Partial<Record<RoleTypeField, RoleTypeIssue>>;

const DRAFT_KEYS = ['code', 'name', 'description', 'unEdifact3035Code', 'organization', 'person', 'requiresFiscalIdentifier'] as const;

/** Un tipo nuevo nace admitido para organizaciones, que es lo único que hoy se registra (G-534). */
export function emptyRoleTypeDraft(): RoleTypeDraft {
  return { code: '', name: '', description: '', unEdifact3035Code: '', organization: true, person: false, requiresFiscalIdentifier: false };
}

export function draftFromRoleType(type: PartyRoleType): RoleTypeDraft {
  return {
    code: type.code,
    name: type.name,
    description: type.description ?? '',
    unEdifact3035Code: type.unEdifact3035Code ?? '',
    organization: type.allowedPartyTypes.includes('ORGANIZATION'),
    person: type.allowedPartyTypes.includes('PERSON'),
    requiresFiscalIdentifier: type.requiresFiscalIdentifier,
  };
}

export function isRoleTypeDraftDirty(initial: RoleTypeDraft, draft: RoleTypeDraft): boolean {
  return DRAFT_KEYS.some((key) => initial[key] !== draft[key]);
}

export interface RoleTypeRules {
  readonly creating: boolean;
  /** Códigos del catálogo cargado, activos e inactivos: el código no se reutiliza. */
  readonly takenCodes: readonly string[];
}

function checkCode(code: string, rules: RoleTypeRules): RoleTypeIssue | undefined {
  if (!rules.creating) return undefined;
  const normalized = normalizeRoleTypeCode(code);
  if (normalized === '') return { kind: 'required' };
  if (!isValidRoleTypeCode(normalized)) return { kind: 'code_format' };
  return rules.takenCodes.includes(normalized) ? { kind: 'taken' } : undefined;
}

function checkName(name: string): RoleTypeIssue | undefined {
  const clean = name.trim();
  if (clean === '') return { kind: 'required' };
  return clean.length > ROLE_TYPE_NAME_MAX ? { kind: 'too_long' } : undefined;
}

export function validateRoleTypeDraft(draft: RoleTypeDraft, rules: RoleTypeRules): RoleTypeIssues {
  const edifact = normalizeEdifact3035Code(draft.unEdifact3035Code);
  const issues: Record<RoleTypeField, RoleTypeIssue | undefined> = {
    code: checkCode(draft.code, rules),
    name: checkName(draft.name),
    description: draft.description.trim().length > ROLE_TYPE_DESCRIPTION_MAX ? { kind: 'too_long' } : undefined,
    unEdifact3035Code: edifact !== null && !isValidEdifact3035Code(edifact) ? { kind: 'edifact_format' } : undefined,
    allowedPartyTypes: draft.organization || draft.person ? undefined : { kind: 'required' },
  };
  return Object.fromEntries(Object.entries(issues).filter(([, issue]) => issue !== undefined));
}

export function toRoleTypeInput(draft: RoleTypeDraft): RoleTypeInput {
  const allowed: PartyType[] = [];
  if (draft.organization) allowed.push('ORGANIZATION');
  if (draft.person) allowed.push('PERSON');
  const description = draft.description.trim();
  return {
    name: draft.name.trim(),
    description: description === '' ? null : description,
    unEdifact3035Code: normalizeEdifact3035Code(draft.unEdifact3035Code),
    allowedPartyTypes: allowed,
    requiresFiscalIdentifier: draft.requiresFiscalIdentifier,
  };
}

export function toCreateRoleTypeRequest(draft: RoleTypeDraft): CreateRoleTypeRequest {
  return { ...toRoleTypeInput(draft), code: normalizeRoleTypeCode(draft.code) };
}
