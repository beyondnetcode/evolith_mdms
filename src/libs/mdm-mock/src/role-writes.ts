import type { CreatedResponse, EndValidityRequest, ReasonRequest, RoleInput, WriteResult } from '@mdm/contracts';
import { assertActive, checkReason, found, requireDate, requireOrderedValidity, requireText, writeParty, type MockContext, type PartyPart } from './context.ts';
import { conflict, invalid } from './errors.ts';
import { assertRoleTypeActive, checkRoleType, hasCurrentFiscalIdentifier } from './identifier-rules.ts';
import { findOverlappingRole } from './party-writes.ts';
import type { PartyRecord, RoleRecord, RoleTypeRecord } from './store.ts';

function roleOf(party: PartyRecord, roleId: string): RoleRecord {
  return found(party.roles.find((role) => role.roleId === roleId));
}

/**
 * P-12: exige la Party `Active` y el tipo de rol activo (D-046); `INV-PTY-05` (solape) e `INV-PTY-06` (fiscal para
 * `INTERNAL_COMPANY`).
 */
export function assignRole(context: MockContext, partyId: string, request: RoleInput, ifMatch: number): CreatedResponse {
  const today = context.clock.today();
  const roleTypeCode = requireText('roleTypeCode', request.roleTypeCode, 50, 'role_type_code');
  const validFrom = requireDate('validFrom', request.validFrom, today);
  const validTo = request.validTo === null ? null : requireDate('validTo', request.validTo, today);
  requireOrderedValidity(validFrom, validTo);
  const candidate = { roleTypeCode, validFrom, validTo };
  const id = context.store.newId();
  let roleType: RoleTypeRecord | null = null;
  const { version } = writeParty(context, partyId, ifMatch, {
    validate: (party) => {
      roleType = checkRoleType(context.store, roleTypeCode, party.type);
    },
    apply: (party) => {
      assertActive(party);
      const type = found(roleType ?? undefined);
      assertRoleTypeActive(type);
      if (type.requiresFiscalIdentifier && !hasCurrentFiscalIdentifier(party, today)) conflict('party.role.fiscal_identifier_required');
      if (findOverlappingRole(party.roles, candidate)) conflict('party.role.overlap');
      party.roles.push({ roleId: id, ...candidate, status: 'Active' });
    },
  });
  return { id, version };
}

/** P-13. */
export function suspendRole(context: MockContext, part: PartyPart, request: ReasonRequest, ifMatch: number): WriteResult {
  checkReason(request.reason);
  return writeParty(context, part.partyId, ifMatch, {
    locate: (party) => roleOf(party, part.id),
    apply: (party) => {
      const role = roleOf(party, part.id);
      if (role.status === 'Terminated') conflict('party.role.terminated');
      if (role.status === 'Suspended') conflict('party.role.already_suspended');
      role.status = 'Suspended';
    },
  });
}

/** P-14: reactiva un rol suspendido; exige la Party `Active`. */
export function activateRole(context: MockContext, part: PartyPart, request: ReasonRequest, ifMatch: number): WriteResult {
  checkReason(request.reason);
  return writeParty(context, part.partyId, ifMatch, {
    locate: (party) => roleOf(party, part.id),
    apply: (party) => {
      const role = roleOf(party, part.id);
      assertActive(party);
      if (role.status === 'Terminated') conflict('party.role.terminated');
      if (role.status === 'Active') conflict('party.role.already_active');
      role.status = 'Active';
    },
  });
}

/** P-15: termina (terminal) con `validTo` entre su «desde» y su «hasta» vigente. */
export function terminateRole(context: MockContext, part: PartyPart, request: EndValidityRequest, ifMatch: number): WriteResult {
  const today = context.clock.today();
  const validTo = requireDate('validTo', request.validTo, today);
  checkReason(request.reason);
  return writeParty(context, part.partyId, ifMatch, {
    locate: (party) => {
      const role = roleOf(party, part.id);
      requireOrderedValidity(role.validFrom, validTo);
      if (role.validTo !== null && validTo > role.validTo) invalid('validTo', 'validation.valid_to_after_current_valid_to');
    },
    apply: (party) => {
      const role = roleOf(party, part.id);
      if (role.status === 'Terminated') conflict('party.role.terminated');
      role.status = 'Terminated';
      role.validTo = validTo;
    },
  });
}
