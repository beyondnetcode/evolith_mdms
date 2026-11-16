import { normalizeCode, type Establishment, type EstablishmentInput, type EstablishmentStatusFilter, type OpenEstablishmentRequest } from '@mdm/contracts';
import { checkText, type FieldIssue } from './field-rules.ts';

/** Estado del establecimiento (UI-MDM-001 §2.3). «Principal» es un atributo aparte, no un estado. */
export type EstablishmentState = { readonly kind: 'active' } | { readonly kind: 'inactive' } | { readonly kind: 'closed'; readonly closedAt: string | null };

export function establishmentState(establishment: Pick<Establishment, 'isActive' | 'isClosed' | 'closedAt'>): EstablishmentState {
  if (establishment.isClosed) return { kind: 'closed', closedAt: establishment.closedAt };
  return establishment.isActive ? { kind: 'active' } : { kind: 'inactive' };
}

/** Órdenes por elemento (US-MDM-009 y 010). Uno cerrado no admite ninguna (`INV-PTY-10`). */
export type EstablishmentRowCommand = 'editEstablishment' | 'deactivateEstablishment' | 'reactivateEstablishment' | 'closeEstablishment';

export function establishmentRowCommands(establishment: Pick<Establishment, 'isActive' | 'isClosed'>): readonly EstablishmentRowCommand[] {
  if (establishment.isClosed) return [];
  return establishment.isActive
    ? ['editEstablishment', 'deactivateEstablishment', 'closeEstablishment']
    : ['editEstablishment', 'reactivateEstablishment', 'closeEstablishment'];
}

/** Filtro de la sección: `null` es «Todos» (P-16 sin `status`). */
export type EstablishmentFilter = EstablishmentStatusFilter | null;

/** Principal activo de la Party (`INV-PTY-09`), sin contar `exceptId` (el que se edita). */
export function findActivePrincipal(establishments: readonly Establishment[], exceptId: string | null): Establishment | undefined {
  return establishments.find((item) => item.id !== exceptId && item.isPrincipal && item.isActive && !item.isClosed);
}

// D-MDM-05 «Abrir o editar establecimiento» (US-MDM-009). Longitudes del OpenAPI (`EstablishmentInput`, `Address`).

export const ESTABLISHMENT_LIMITS = {
  code: 100,
  name: 200,
  line1: 200,
  line2: 200,
  department: 100,
  province: 100,
  district: 100,
  postalCode: 20,
  reference: 200,
} as const satisfies Partial<Record<keyof EstablishmentDraft, number>>;

/** Longitud máxima de un campo de texto del borrador, si la tiene. */
export function textLimit(field: keyof EstablishmentDraft): number | undefined {
  const limits: Readonly<Partial<Record<keyof EstablishmentDraft, number>>> = ESTABLISHMENT_LIMITS;
  return limits[field];
}

export interface EstablishmentDraft {
  readonly code: string;
  readonly kindCode: string;
  readonly name: string;
  readonly taxEstablishmentCode: string;
  readonly isPrincipal: boolean;
  readonly line1: string;
  readonly line2: string;
  readonly ubigeo: string;
  readonly department: string;
  readonly province: string;
  readonly district: string;
  readonly postalCode: string;
  readonly countryCode: string;
  readonly reference: string;
}

export type EstablishmentDraftField = keyof EstablishmentDraft;

/** En el orden del formulario: el resumen de errores los lista así. */
export const ESTABLISHMENT_DRAFT_FIELDS: readonly EstablishmentDraftField[] = [
  'code',
  'kindCode',
  'name',
  'taxEstablishmentCode',
  'isPrincipal',
  'line1',
  'line2',
  'ubigeo',
  'department',
  'province',
  'district',
  'postalCode',
  'countryCode',
  'reference',
];

export const PERU = 'PE';

export function emptyEstablishmentDraft(): EstablishmentDraft {
  return {
    code: '',
    kindCode: '',
    name: '',
    taxEstablishmentCode: '',
    isPrincipal: false,
    line1: '',
    line2: '',
    ubigeo: '',
    department: '',
    province: '',
    district: '',
    postalCode: '',
    countryCode: PERU,
    reference: '',
  };
}

/** Borrador para editar: lo nulo del contrato es texto vacío en el formulario. */
export function draftFromEstablishment(establishment: Establishment): EstablishmentDraft {
  const { address } = establishment;
  return {
    code: establishment.code,
    kindCode: establishment.kindCode,
    name: establishment.name,
    taxEstablishmentCode: establishment.taxEstablishmentCode ?? '',
    isPrincipal: establishment.isPrincipal,
    line1: address.line1,
    line2: address.line2 ?? '',
    ubigeo: address.ubigeo ?? '',
    department: address.department ?? '',
    province: address.province ?? '',
    district: address.district ?? '',
    postalCode: address.postalCode ?? '',
    countryCode: address.countryCode,
    reference: address.reference ?? '',
  };
}

const TAX_ESTABLISHMENT_CODE = /^[0-9]{4}$/;
const UBIGEO = /^[0-9]{6}$/;
const COUNTRY = /^[A-Z]{2}$/;

export interface EstablishmentRules {
  /** Al editar, el código es inmutable y no se valida. */
  readonly creating: boolean;
  /** Códigos ya usados en la Party, aunque estén cerrados (`INV-PTY-08`). */
  readonly takenCodes: readonly string[];
}

function optional(value: string, max: number): FieldIssue | null {
  return checkText(value, { required: false, max });
}

function codeIssue(draft: EstablishmentDraft, rules: EstablishmentRules): FieldIssue | null {
  if (!rules.creating) return null;
  const issue = checkText(draft.code, { required: true, max: ESTABLISHMENT_LIMITS.code });
  if (issue !== null) return issue;
  return rules.takenCodes.includes(normalizeCode(draft.code)) ? { kind: 'taken' } : null;
}

/** Anexo SUNAT: opcional, cuatro dígitos (G-576). */
function taxCodeIssue(value: string): FieldIssue | null {
  const clean = value.trim();
  return clean !== '' && !TAX_ESTABLISHMENT_CODE.test(clean) ? { kind: 'format' } : null;
}

/** Ubigeo: opcional, seis dígitos y solo con país `PE` (OpenAPI, `Address.ubigeo`). */
function ubigeoIssue(value: string, country: string): FieldIssue | null {
  const clean = value.trim();
  if (clean === '') return null;
  if (!UBIGEO.test(clean)) return { kind: 'format' };
  return country === PERU ? null : { kind: 'not_applicable' };
}

function countryIssue(country: string): FieldIssue | null {
  if (country === '') return { kind: 'required' };
  return COUNTRY.test(country) ? null : { kind: 'format' };
}

/** Problemas locales (UX-MDM-001 §6.3). El aviso de principal no es un error: no bloquea el envío. */
export function validateEstablishmentDraft(draft: EstablishmentDraft, rules: EstablishmentRules): Partial<Record<EstablishmentDraftField, FieldIssue>> {
  const country = normalizeCountry(draft.countryCode);
  const found: Array<readonly [EstablishmentDraftField, FieldIssue | null]> = [
    ['code', codeIssue(draft, rules)],
    ['kindCode', draft.kindCode === '' ? { kind: 'required' } : null],
    ['name', checkText(draft.name, { required: true, max: ESTABLISHMENT_LIMITS.name })],
    ['taxEstablishmentCode', taxCodeIssue(draft.taxEstablishmentCode)],
    ['line1', checkText(draft.line1, { required: true, max: ESTABLISHMENT_LIMITS.line1 })],
    ['line2', optional(draft.line2, ESTABLISHMENT_LIMITS.line2)],
    ['ubigeo', ubigeoIssue(draft.ubigeo, country)],
    ['department', optional(draft.department, ESTABLISHMENT_LIMITS.department)],
    ['province', optional(draft.province, ESTABLISHMENT_LIMITS.province)],
    ['district', optional(draft.district, ESTABLISHMENT_LIMITS.district)],
    ['postalCode', optional(draft.postalCode, ESTABLISHMENT_LIMITS.postalCode)],
    ['countryCode', countryIssue(country)],
    ['reference', optional(draft.reference, ESTABLISHMENT_LIMITS.reference)],
  ];
  return Object.fromEntries(found.filter(([, issue]) => issue !== null));
}

export function normalizeCountry(value: string): string {
  return value.trim().toUpperCase();
}

const orNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/** Cuerpo de P-19 (y base de P-18). */
export function toEstablishmentInput(draft: EstablishmentDraft): EstablishmentInput {
  return {
    kindCode: draft.kindCode,
    name: draft.name.trim(),
    taxEstablishmentCode: orNull(draft.taxEstablishmentCode),
    isPrincipal: draft.isPrincipal,
    address: {
      line1: draft.line1.trim(),
      line2: orNull(draft.line2),
      ubigeo: orNull(draft.ubigeo),
      department: orNull(draft.department),
      province: orNull(draft.province),
      district: orNull(draft.district),
      postalCode: orNull(draft.postalCode),
      countryCode: normalizeCountry(draft.countryCode),
      reference: orNull(draft.reference),
    },
  };
}

/** Cuerpo de P-18: el código viaja normalizado, como lo guarda el servidor. */
export function toOpenEstablishmentRequest(draft: EstablishmentDraft): OpenEstablishmentRequest {
  return { ...toEstablishmentInput(draft), code: normalizeCode(draft.code) };
}
