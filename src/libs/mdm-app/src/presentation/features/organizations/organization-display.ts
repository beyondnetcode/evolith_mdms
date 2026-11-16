import type { PartySummary } from '@mdm/contracts';
import { ORGANIZATIONS_TEXTS as T } from './texts.ts';

/** Nombre visible de cada tipo de rol (C-02); sin catálogo, el código tal cual. */
export type RoleNames = Readonly<Record<string, string>>;

/** «PE-RUC 20100412447», o el texto de «sin primario vigente». */
export function primaryIdentifierText(party: PartySummary): string {
  const identifier = party.primaryIdentifier;
  return identifier === null ? T.noPrimary : `${identifier.schemeCode} ${identifier.value}`;
}

/** «Cliente, Proveedor», o el texto de «sin roles vigentes». */
export function rolesText(party: PartySummary, roleNames: RoleNames): string {
  if (party.currentRoleTypeCodes.length === 0) return T.noRoles;
  return party.currentRoleTypeCodes.map((code) => roleNames[code] ?? code).join(', ');
}
