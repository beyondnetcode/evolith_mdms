import {
  normalizeCode,
  type AddIdentifierRequest,
  type CreatedResponse,
  type EndValidityRequest,
  type ReasonRequest,
  type RegisterPartyRequest,
  type RenamePartyRequest,
  type RoleInput,
  type RoleStatus,
  type WriteResult,
} from '@mdm/contracts';
import { addDays, overlaps } from './clock.ts';
import { checkReason, found, optionalText, requireDate, requireOrderedValidity, requireText, writeParty, type MockContext, type PartyPart } from './context.ts';
import { conflict, invalid, unprocessable } from './errors.ts';
import {
  assertIdentifierFree,
  assertRoleTypeActive,
  checkIdentifierShape,
  checkIdentifierValue,
  checkRoleType,
  hasCurrentFiscalIdentifier,
  isFiscalScheme,
  type CheckedIdentifier,
} from './identifier-rules.ts';
import type { MdmMockStore, PartyRecord } from './store.ts';
import { currentPrimary, isIdentifierCurrent, isRoleCurrent } from './views.ts';

interface CheckedRole {
  readonly roleTypeCode: string;
  readonly validFrom: string;
  readonly validTo: string | null;
}

function checkRoleShape(role: RoleInput, today: string, prefix: string): CheckedRole {
  const roleTypeCode = requireText(`${prefix}roleTypeCode`, role.roleTypeCode, 50, 'role_type_code');
  const validFrom = requireDate(`${prefix}validFrom`, role.validFrom, today);
  const validTo = role.validTo === null ? null : requireDate(`${prefix}validTo`, role.validTo, today);
  requireOrderedValidity(validFrom, validTo, `${prefix}validTo`);
  return { roleTypeCode, validFrom, validTo };
}

/** `INV-PTY-05`: otro rol del mismo tipo, no terminado, cuya vigencia se cruza. */
export function findOverlappingRole(roles: ReadonlyArray<CheckedRole & { readonly status?: RoleStatus }>, candidate: CheckedRole): boolean {
  return roles.some(
    (role) =>
      role.roleTypeCode === candidate.roleTypeCode &&
      role.status !== 'Terminated' &&
      overlaps({ from: role.validFrom, to: role.validTo }, { from: candidate.validFrom, to: candidate.validTo }),
  );
}

/**
 * Roles iniciales del alta (`409`): tipo activo (D-046), sin solapes entre ellos y `INTERNAL_COMPANY` con identificador
 * fiscal vigente.
 */
function assertInitialRoles(store: MdmMockStore, roles: readonly CheckedRole[], identifier: CheckedIdentifier, today: string): void {
  const fiscalCurrent = isFiscalScheme(identifier.schemeCode) && identifier.validFrom <= today;
  roles.forEach((role, index) => {
    const roleType = checkRoleType(store, role.roleTypeCode, 'ORGANIZATION');
    assertRoleTypeActive(roleType);
    if (roleType.requiresFiscalIdentifier && !fiscalCurrent) conflict('party.role.fiscal_identifier_required');
    if (findOverlappingRole(roles.slice(0, index), role)) conflict('party.role.overlap');
  });
}

/** P-02. */
export function registerParty(context: MockContext, request: RegisterPartyRequest): CreatedResponse {
  const today = context.clock.today();
  const code = normalizeCode(requireText('code', request.code, 100, 'code'));
  const legalName = requireText('legalName', request.legalName, 200, 'legal_name');
  const tradeName = optionalText('tradeName', request.tradeName, 200, 'trade_name');
  const identifier = checkIdentifierShape(request.primaryIdentifier, today, 'primaryIdentifier.');
  const roles = request.roles.map((role, index) => checkRoleShape(role, today, `roles[${index}].`));
  if (request.type === 'PERSON') unprocessable('party.person_not_supported');
  checkIdentifierValue(identifier, request.type);
  for (const role of roles) checkRoleType(context.store, role.roleTypeCode, request.type);
  if ([...context.store.parties.values()].some((party) => party.code === code)) conflict('party.code_not_unique');
  assertIdentifierFree(context, identifier);
  assertInitialRoles(context.store, roles, identifier, today);
  const now = context.clock.now();
  const party: PartyRecord = {
    id: context.store.newId(),
    type: request.type,
    code,
    legalName,
    tradeName,
    status: 'Active',
    version: 1,
    identifiers: [{ identifierId: context.store.newId(), ...identifier, isPrimary: true, validTo: null }],
    roles: roles.map((role) => ({ roleId: context.store.newId(), ...role, status: 'Active' })),
    establishments: [],
    createdAt: now,
    createdBy: context.actor,
    updatedAt: null,
    updatedBy: null,
  };
  context.store.parties.set(party.id, party);
  return { id: party.id, version: party.version };
}

/** P-04. */
export function renameParty(context: MockContext, partyId: string, request: RenamePartyRequest, ifMatch: number): WriteResult {
  const legalName = requireText('legalName', request.legalName, 200, 'legal_name');
  const tradeName = optionalText('tradeName', request.tradeName, 200, 'trade_name');
  return writeParty(context, partyId, ifMatch, {
    apply: (party) => {
      party.legalName = legalName;
      party.tradeName = tradeName;
    },
  });
}

/** P-05. */
export function suspendParty(context: MockContext, partyId: string, request: ReasonRequest, ifMatch: number): WriteResult {
  checkReason(request.reason);
  return writeParty(context, partyId, ifMatch, {
    apply: (party) => {
      if (party.status === 'Suspended') conflict('party.already_suspended');
      party.status = 'Suspended';
    },
  });
}

/** P-06. */
export function activateParty(context: MockContext, partyId: string, request: ReasonRequest, ifMatch: number): WriteResult {
  checkReason(request.reason);
  return writeParty(context, partyId, ifMatch, {
    apply: (party) => {
      if (party.status === 'Active') conflict('party.already_active');
      party.status = 'Active';
    },
  });
}

/** P-07: archiva. No termina roles ni cierra establecimientos (contrato §6.2, G-572). */
export function archiveParty(context: MockContext, partyId: string, ifMatch: number): WriteResult {
  return writeParty(context, partyId, ifMatch, {
    apply: (party) => {
      party.status = 'Archived';
    },
  });
}

/** P-09. */
export function addIdentifier(context: MockContext, partyId: string, request: AddIdentifierRequest, ifMatch: number): CreatedResponse {
  const today = context.clock.today();
  const identifier = checkIdentifierShape(request, today);
  if (request.replacesPrimary && !request.isPrimary) invalid('replacesPrimary', 'validation.replaces_primary_requires_primary');
  const id = context.store.newId();
  const { version } = writeParty(context, partyId, ifMatch, {
    validate: (party) => checkIdentifierValue(identifier, party.type),
    apply: (party) => {
      assertIdentifierFree(context, identifier);
      const previous = currentPrimary(party, today);
      if (request.isPrimary && previous !== undefined && !request.replacesPrimary) conflict('party.identifier.primary_exists');
      if (request.isPrimary && previous !== undefined) assertFiscalKept(party, previous.identifierId, identifier, today);
      // `INV-PTY-03`: el primario anterior vence el día previo al nuevo (G-570).
      if (request.isPrimary && previous !== undefined) previous.validTo = addDays(identifier.validFrom, -1);
      party.identifiers.push({ identifierId: id, ...identifier, isPrimary: request.isPrimary, validTo: null });
    },
  });
  return { id, version };
}

/** `INV-PTY-06`: vencer (o reemplazar) el último identificador fiscal vigente de una empresa del grupo es `409`. */
function assertFiscalKept(party: PartyRecord, leavingId: string, incoming: CheckedIdentifier | null, today: string): void {
  const leaving = party.identifiers.find((item) => item.identifierId === leavingId);
  if (leaving === undefined || !isFiscalScheme(leaving.schemeCode)) return;
  const internalCompany = party.roles.some((role) => role.roleTypeCode === 'INTERNAL_COMPANY' && isRoleCurrent(role, today));
  // Un sucesor fiscal mantiene la continuidad: el anterior vence el día previo a que empiece.
  const incomingFiscal = incoming !== null && isFiscalScheme(incoming.schemeCode);
  if (internalCompany && !incomingFiscal && !hasCurrentFiscalIdentifier(party, today, leavingId)) conflict('party.identifier.fiscal_required');
}

function assertExpirable(party: PartyRecord, identifierId: string, today: string): void {
  const identifier = party.identifiers.find((item) => item.identifierId === identifierId);
  if (identifier === undefined) return;
  if (identifier.validTo !== null && identifier.validTo < today) conflict('party.identifier.already_expired');
  if (identifier.isPrimary && isIdentifierCurrent(identifier, today)) conflict('party.identifier.primary_required');
  assertFiscalKept(party, identifierId, null, today);
}

/** P-10. */
export function expireIdentifier(context: MockContext, part: PartyPart, request: EndValidityRequest, ifMatch: number): WriteResult {
  const identifierId = part.id;
  const today = context.clock.today();
  const validTo = requireDate('validTo', request.validTo, today);
  checkReason(request.reason);
  return writeParty(context, part.partyId, ifMatch, {
    locate: (party) => {
      const identifier = found(party.identifiers.find((item) => item.identifierId === identifierId));
      requireOrderedValidity(identifier.validFrom, validTo);
    },
    apply: (party) => {
      assertExpirable(party, identifierId, today);
      const identifier = party.identifiers.find((item) => item.identifierId === identifierId);
      if (identifier !== undefined) identifier.validTo = validTo;
    },
  });
}
