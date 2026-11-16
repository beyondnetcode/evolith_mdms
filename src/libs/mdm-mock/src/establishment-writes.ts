import { normalizeCode, type CreatedResponse, type EstablishmentInput, type OpenEstablishmentRequest, type ReasonRequest, type WriteResult } from '@mdm/contracts';
import { ESTABLISHMENT_KINDS } from './catalogs.ts';
import { assertActive, checkReason, found, optionalText, requireCountry, requireText, writeParty, type MockContext, type PartyPart } from './context.ts';
import { conflict, invalid, unprocessable } from './errors.ts';
import type { EstablishmentRecord, PartyRecord } from './store.ts';

function establishmentOf(party: PartyRecord, establishmentId: string): EstablishmentRecord {
  return found(party.establishments.find((establishment) => establishment.id === establishmentId));
}

/** Forma del cuerpo de P-18 y P-19 (`400`). */
function checkInput(input: EstablishmentInput): EstablishmentInput {
  const name = requireText('name', input.name, 200, 'name');
  if (input.taxEstablishmentCode !== null && !/^[0-9]{4}$/.test(input.taxEstablishmentCode)) {
    invalid('taxEstablishmentCode', 'validation.tax_establishment_code_invalid');
  }
  const line1 = requireText('address.line1', input.address.line1, 200, 'address_line1');
  const countryCode = requireCountry('address.countryCode', input.address.countryCode);
  if (input.address.ubigeo !== null && !/^[0-9]{6}$/.test(input.address.ubigeo)) invalid('address.ubigeo', 'validation.ubigeo_invalid');
  const line2 = optionalText('address.line2', input.address.line2, 200, 'address_line2');
  return { ...input, name, address: { ...input.address, line1, line2, countryCode } };
}

/** `422`: tipo del catálogo, activo y admitido en la primera entrega (sin `WAREHOUSE`, G-547). */
function checkKind(kindCode: string): void {
  const kind = ESTABLISHMENT_KINDS.find((item) => item.code === kindCode && item.isActive);
  if (kind === undefined) return unprocessable('establishment.kind_unknown');
  if (!kind.isSupported) unprocessable('establishment.kind_not_supported');
}

/** `INV-PTY-09`: como mucho un principal activo por Party. */
function assertPrincipalFree(party: PartyRecord, exceptId: string | null): void {
  const taken = party.establishments.some((item) => item.id !== exceptId && item.isPrincipal && item.isActive && !item.isClosed);
  if (taken) conflict('establishment.principal_exists');
}

/** P-18: exige la Party `Active`; `INV-PTY-08` (código único, aunque esté cerrado) e `INV-PTY-09`. */
export function openEstablishment(context: MockContext, partyId: string, request: OpenEstablishmentRequest, ifMatch: number): CreatedResponse {
  const code = normalizeCode(requireText('code', request.code, 100, 'code'));
  const input = checkInput(request);
  const id = context.store.newId();
  const { version } = writeParty(context, partyId, ifMatch, {
    validate: () => checkKind(input.kindCode),
    apply: (party) => {
      assertActive(party);
      if (party.establishments.some((item) => item.code === code)) conflict('establishment.code_not_unique');
      if (input.isPrincipal) assertPrincipalFree(party, null);
      party.establishments.push({ id, code, ...input, isActive: true, isClosed: false, closedAt: null, closedBy: null });
    },
  });
  return { id, version };
}

/** P-19: el código es inmutable. */
export function changeEstablishment(context: MockContext, part: PartyPart, request: EstablishmentInput, ifMatch: number): WriteResult {
  const input = checkInput(request);
  return writeParty(context, part.partyId, ifMatch, {
    locate: (party) => establishmentOf(party, part.id),
    validate: () => checkKind(input.kindCode),
    apply: (party) => {
      const establishment = establishmentOf(party, part.id);
      if (establishment.isClosed) conflict('establishment.closed');
      if (input.isPrincipal && establishment.isActive) assertPrincipalFree(party, establishment.id);
      Object.assign(establishment, input);
    },
  });
}

/** P-20 (reversible). */
export function deactivateEstablishment(context: MockContext, part: PartyPart, request: ReasonRequest, ifMatch: number): WriteResult {
  checkReason(request.reason);
  return writeParty(context, part.partyId, ifMatch, {
    locate: (party) => establishmentOf(party, part.id),
    apply: (party) => {
      const establishment = establishmentOf(party, part.id);
      if (establishment.isClosed) conflict('establishment.closed');
      if (!establishment.isActive) conflict('establishment.already_inactive');
      establishment.isActive = false;
    },
  });
}

/** P-21: exige la Party `Active`; reactivar un principal no puede dejar dos principales activos. */
export function reactivateEstablishment(context: MockContext, part: PartyPart, request: ReasonRequest, ifMatch: number): WriteResult {
  checkReason(request.reason);
  return writeParty(context, part.partyId, ifMatch, {
    locate: (party) => establishmentOf(party, part.id),
    apply: (party) => {
      const establishment = establishmentOf(party, part.id);
      assertActive(party);
      if (establishment.isClosed) conflict('establishment.closed');
      if (establishment.isActive) conflict('establishment.already_active');
      if (establishment.isPrincipal) assertPrincipalFree(party, establishment.id);
      establishment.isActive = true;
    },
  });
}

/** P-22: cierra (terminal, `INV-PTY-10`). El código no se reutiliza. */
export function closeEstablishment(context: MockContext, part: PartyPart, ifMatch: number): WriteResult {
  return writeParty(context, part.partyId, ifMatch, {
    locate: (party) => establishmentOf(party, part.id),
    apply: (party) => {
      const establishment = establishmentOf(party, part.id);
      if (establishment.isClosed) conflict('establishment.closed');
      Object.assign(establishment, { isClosed: true, isActive: false, closedAt: context.clock.now(), closedBy: context.actor });
    },
  });
}
