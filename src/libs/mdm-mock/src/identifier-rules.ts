import { RUC_SCHEME_CODE, isValidRuc, normalizeIdentifierValue, type IdentifierInput, type PartyType } from '@mdm/contracts';
import { IDENTIFIER_SCHEMES } from './catalogs.ts';
import { requireCountry, requireDate, requireText, type MockContext } from './context.ts';
import { conflict, unprocessable } from './errors.ts';
import type { MdmMockStore, PartyRecord, RoleTypeRecord } from './store.ts';
import { isIdentifierCurrent } from './views.ts';

/** Identificador ya comprobado en su forma (`400`): valor normalizado y fecha resuelta. */
export interface CheckedIdentifier {
  readonly countryCode: string;
  readonly schemeCode: string;
  readonly value: string;
  readonly validFrom: string;
}

/** Forma del identificador (`400`). `prefix` nombra el campo en `errors` (`primaryIdentifier.value`). */
export function checkIdentifierShape(input: IdentifierInput, today: string, prefix = ''): CheckedIdentifier {
  const countryCode = requireCountry(`${prefix}countryCode`, input.countryCode);
  const schemeCode = requireText(`${prefix}schemeCode`, input.schemeCode, 50, 'scheme_code');
  const value = normalizeIdentifierValue(requireText(`${prefix}value`, input.value, 50, 'identifier_value'));
  return { countryCode, schemeCode, value, validFrom: requireDate(`${prefix}validFrom`, input.validFrom, today) };
}

/** `INV-PTY-04` (`422`): esquema del catálogo, activo, del mismo país y admitido para el tipo; patrón; dígito del RUC. */
export function checkIdentifierValue(identifier: CheckedIdentifier, partyType: PartyType): void {
  const scheme = IDENTIFIER_SCHEMES.find((s) => s.code === identifier.schemeCode && s.isActive && s.countryCode === identifier.countryCode);
  if (scheme === undefined) return unprocessable('party.identifier.scheme_unknown');
  if (!scheme.allowedPartyTypes.includes(partyType)) return unprocessable('party.identifier.scheme_not_allowed');
  if (!new RegExp(scheme.pattern).test(identifier.value)) return unprocessable('party.identifier.invalid_format');
  if (scheme.code === RUC_SCHEME_CODE && !isValidRuc(identifier.value)) unprocessable('party.identifier.check_digit_invalid');
}

/** `INV-PTY-02` (`409`): el identificador no pertenece a ninguna Party, ni vencido, ni archivada ni fusionada. */
export function assertIdentifierFree(context: MockContext, identifier: CheckedIdentifier): void {
  for (const party of context.store.parties.values()) {
    const taken = party.identifiers.some(
      (existing) => existing.countryCode === identifier.countryCode && existing.schemeCode === identifier.schemeCode && existing.value === identifier.value,
    );
    if (taken) conflict('party.identifier.duplicate');
  }
}

export function isFiscalScheme(schemeCode: string): boolean {
  return IDENTIFIER_SCHEMES.some((scheme) => scheme.code === schemeCode && scheme.isFiscal);
}

/** ¿La Party tiene un identificador fiscal vigente hoy, sin contar `excludingId`? */
export function hasCurrentFiscalIdentifier(party: PartyRecord, today: string, excludingId?: string): boolean {
  return party.identifiers.some(
    (identifier) => identifier.identifierId !== excludingId && isFiscalScheme(identifier.schemeCode) && isIdentifierCurrent(identifier, today),
  );
}

/** `422`: tipo de rol del catálogo y admitido para el tipo de Party. Devuelve el tipo (activo o no). */
export function checkRoleType(store: MdmMockStore, roleTypeCode: string, partyType: PartyType): RoleTypeRecord {
  const roleType = store.roleTypes.get(roleTypeCode);
  if (roleType === undefined) return unprocessable('party.role.type_unknown');
  if (!roleType.allowedPartyTypes.includes(partyType)) return unprocessable('party.role.type_not_allowed');
  return roleType;
}

/**
 * `409` `party_role_type.inactive` (D-046): un tipo desactivado no se asigna a roles nuevos. Es `409` y no `422`
 * porque reactivar el tipo convierte la misma petición en éxito (contrato §6.1).
 */
export function assertRoleTypeActive(roleType: RoleTypeRecord): void {
  if (!roleType.isActive) conflict('party_role_type.inactive');
}
