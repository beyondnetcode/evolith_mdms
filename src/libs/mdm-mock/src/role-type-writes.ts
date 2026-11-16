import {
  PARTY_TYPES,
  ROLE_TYPE_DESCRIPTION_MAX,
  ROLE_TYPE_NAME_MAX,
  isValidEdifact3035Code,
  isValidRoleTypeCode,
  normalizeEdifact3035Code,
  normalizeRoleTypeCode,
  type CreateRoleTypeRequest,
  type PartyRoleType,
  type PartyType,
  type ReasonRequest,
  type RoleTypeCreatedResponse,
  type RoleTypeFilter,
  type RoleTypeInput,
  type WriteResult,
} from '@mdm/contracts';
import { checkReason, found, optionalText, requireText, type MockContext } from './context.ts';
import { conflict, invalid, preconditionFailed, unprocessable } from './errors.ts';
import type { RoleTypeRecord } from './store.ts';

/*
 * Catálogo de tipos de rol (C-02 y C-05 a C-08, D-046). Cada tipo es su propio agregado, con su versión: escribirlo no
 * sube la versión de ninguna Party. El código es inmutable y no se reutiliza (no hay borrado: desactivar lo conserva).
 * Orden de evaluación del contrato (§2.2): `400` → `404` → `412` → `422` → `409`.
 */

/** Lo editable del tipo, ya comprobado en su forma (`400`). La regla del código UN/EDIFACT es `422`. */
interface CheckedInput {
  readonly name: string;
  readonly description: string | null;
  readonly unEdifact3035Code: string | null;
  readonly allowedPartyTypes: readonly PartyType[];
  readonly requiresFiscalIdentifier: boolean;
}

function checkInputShape(request: RoleTypeInput): CheckedInput {
  const name = requireText('name', request.name, ROLE_TYPE_NAME_MAX, 'name');
  const description = optionalText('description', request.description, ROLE_TYPE_DESCRIPTION_MAX, 'description');
  const allowed = new Set(request.allowedPartyTypes);
  if (allowed.size === 0) invalid('allowedPartyTypes', 'validation.allowed_party_types_required');
  if (allowed.size !== request.allowedPartyTypes.length) invalid('allowedPartyTypes', 'validation.allowed_party_types_duplicate');
  const edifact = request.unEdifact3035Code === null ? null : normalizeEdifact3035Code(request.unEdifact3035Code);
  return {
    name,
    description,
    unEdifact3035Code: edifact,
    // Orden canónico del contrato, sea cual sea el del cuerpo.
    allowedPartyTypes: PARTY_TYPES.filter((type) => allowed.has(type)),
    requiresFiscalIdentifier: request.requiresFiscalIdentifier,
  };
}

/** `422` `party_role_type.edifact_invalid`: dos letras mayúsculas. */
function checkEdifact(input: CheckedInput): void {
  if (input.unEdifact3035Code !== null && !isValidEdifact3035Code(input.unEdifact3035Code)) unprocessable('party_role_type.edifact_invalid');
}

export function toRoleType(record: RoleTypeRecord): PartyRoleType {
  return { ...record, allowedPartyTypes: [...record.allowedPartyTypes] };
}

/** C-02: el catálogo completo, filtrado por tipo de Party y por estado, ordenado por código. */
export function listRoleTypes(context: MockContext, filter: RoleTypeFilter): readonly PartyRoleType[] {
  return [...context.store.roleTypes.values()]
    .filter((type) => (filter.includeInactive || type.isActive) && (filter.partyType === null || type.allowedPartyTypes.includes(filter.partyType)))
    .toSorted((a, b) => a.code.localeCompare(b.code))
    .map(toRoleType);
}

/** C-05: alta. Sin `If-Match`: crea el agregado. */
export function createRoleType(context: MockContext, request: CreateRoleTypeRequest): RoleTypeCreatedResponse {
  const code = normalizeRoleTypeCode(requireText('code', request.code, 100, 'code'));
  const input = checkInputShape(request);
  if (!isValidRoleTypeCode(code)) unprocessable('party_role_type.code_invalid');
  checkEdifact(input);
  // No reutilizable: choca también con un tipo desactivado.
  if (context.store.roleTypes.has(code)) conflict('party_role_type.code_duplicate');
  context.store.roleTypes.set(code, {
    code,
    ...input,
    isActive: true,
    version: 1,
    createdAt: context.clock.now(),
    createdBy: context.actor,
    updatedAt: null,
    updatedBy: null,
  });
  return { code, version: 1 };
}

/** El tipo de la ruta (`404`) con su versión comprobada (`412`). */
function locate(context: MockContext, code: string, ifMatch: number): RoleTypeRecord {
  const record = found(context.store.roleTypes.get(code));
  if (record.version !== ifMatch) preconditionFailed();
  return record;
}

function touch(record: RoleTypeRecord, context: MockContext): WriteResult {
  record.version += 1;
  record.updatedAt = context.clock.now();
  record.updatedBy = context.actor;
  return { version: record.version };
}

/** C-06: cambia lo editable; el código no. Se admite también sobre un tipo desactivado. */
export function changeRoleType(context: MockContext, code: string, request: RoleTypeInput, ifMatch: number): WriteResult {
  const input = checkInputShape(request);
  const record = locate(context, code, ifMatch);
  checkEdifact(input);
  Object.assign(record, input);
  return touch(record, context);
}

/** C-07: desactiva. Los roles existentes de este tipo se conservan; no se asigna a roles nuevos. */
export function deactivateRoleType(context: MockContext, code: string, request: ReasonRequest, ifMatch: number): WriteResult {
  checkReason(request.reason);
  const record = locate(context, code, ifMatch);
  if (!record.isActive) conflict('party_role_type.already_inactive');
  record.isActive = false;
  return touch(record, context);
}

/** C-08: reactiva. */
export function activateRoleType(context: MockContext, code: string, request: ReasonRequest, ifMatch: number): WriteResult {
  checkReason(request.reason);
  const record = locate(context, code, ifMatch);
  if (record.isActive) conflict('party_role_type.already_active');
  record.isActive = true;
  return touch(record, context);
}
