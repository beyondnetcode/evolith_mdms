import { isTerminalPartyStatus, type PartyIdentifier, type PartyStatus } from '@mdm/contracts';
import type { MdmAction } from './permissions.ts';

/**
 * Qué se ofrece en la ficha según el estado de la organización y el rol (UX-MDM-001 §5.4, US-MDM-002 y 005). Solo
 * decide qué NO ofrecer: el servidor decide igualmente y la interfaz pinta su `409` o su `403`.
 */
export const PARTY_COMMANDS = [
  'rename',
  'suspend',
  'activate',
  'archive',
  'addIdentifier',
  'expireIdentifier',
  'assignRole',
  'suspendRole',
  'activateRole',
  'terminateRole',
  'openEstablishment',
  'editEstablishment',
  'deactivateEstablishment',
  'reactivateEstablishment',
  'closeEstablishment',
  'startRelationship',
  'endRelationship',
  'linkReference',
  'unlinkReference',
] as const;
export type PartyCommand = (typeof PARTY_COMMANDS)[number];

const PERMISSION: Readonly<Record<PartyCommand, MdmAction>> = {
  rename: 'organization.rename',
  suspend: 'organization.suspend',
  activate: 'organization.suspend',
  archive: 'organization.archive',
  addIdentifier: 'identifier.add',
  expireIdentifier: 'identifier.expire',
  // UX-MDM-001 §2.2: asignar, suspender y reactivar rol van juntos (P-12 a P-14); terminar, aparte (P-15).
  assignRole: 'role.assign',
  suspendRole: 'role.assign',
  activateRole: 'role.assign',
  terminateRole: 'role.terminate',
  // Abrir, editar, desactivar y reactivar van juntos (P-18 a P-21); cerrar, aparte (P-22).
  openEstablishment: 'establishment.maintain',
  editEstablishment: 'establishment.maintain',
  deactivateEstablishment: 'establishment.maintain',
  reactivateEstablishment: 'establishment.maintain',
  closeEstablishment: 'establishment.close',
  // Iniciar y terminar relación van juntos (R-02, R-04); vincular y desvincular, solo el integrador (X-02, X-04).
  startRelationship: 'relationship.maintain',
  endRelationship: 'relationship.maintain',
  linkReference: 'externalReference.maintain',
  unlinkReference: 'externalReference.maintain',
};

/** Estado en el que cada orden tiene sentido; `null`, en cualquiera que no sea terminal. */
const REQUIRED_STATUS: Readonly<Record<PartyCommand, PartyStatus | null>> = {
  rename: null,
  suspend: 'Active',
  activate: 'Suspended',
  archive: null,
  addIdentifier: null,
  expireIdentifier: null,
  assignRole: null,
  suspendRole: null,
  activateRole: null,
  terminateRole: null,
  openEstablishment: null,
  editEstablishment: null,
  deactivateEstablishment: null,
  reactivateEstablishment: null,
  closeEstablishment: null,
  // Relaciones y referencias no dependen de que la organización esté activa: el contrato (§6.2) solo las rechaza
  // con la organización archivada o fusionada (`party_relationship.party_not_active`, `external_reference.target_not_active`).
  startRelationship: null,
  endRelationship: null,
  linkReference: null,
  unlinkReference: null,
};

/**
 * Política de estado de la Party sobre sus partes (API-MDM-002 §6.2): con la organización `Suspended` no se asignan
 * ni reactivan roles, ni se abren ni reactivan establecimientos (`409` `party.not_active`). En la UI esas órdenes
 * quedan deshabilitadas con su explicación visible, no ocultas (UX-MDM-001 §5.4).
 */
const REQUIRES_ACTIVE_PARTY: ReadonlySet<PartyCommand> = new Set(['assignRole', 'activateRole', 'openEstablishment', 'reactivateEstablishment']);

/** Disponibilidad de una orden, como unión discriminada: se ofrece, no se ofrece o se ofrece deshabilitada. */
export type CommandAvailability = { readonly kind: 'available' } | { readonly kind: 'hidden' } | { readonly kind: 'blocked'; readonly reason: 'party_suspended' };

export function commandAvailability(command: PartyCommand, status: PartyStatus, can: (action: MdmAction) => boolean): CommandAvailability {
  if (isTerminalPartyStatus(status) || !can(PERMISSION[command]) || (REQUIRED_STATUS[command] ?? status) !== status) return { kind: 'hidden' };
  if (status === 'Suspended' && REQUIRES_ACTIVE_PARTY.has(command)) return { kind: 'blocked', reason: 'party_suspended' };
  return { kind: 'available' };
}

/**
 * Órdenes disponibles (ni ocultas ni bloqueadas). Una organización archivada o fusionada es de solo lectura total (`INV-PTY-11`): ninguna.
 * Las no concedidas se ocultan, no se deshabilitan, para no sugerir que existen (UX-MDM-001 §5.4).
 */
export function availableCommands(status: PartyStatus, can: (action: MdmAction) => boolean): ReadonlySet<PartyCommand> {
  return new Set(PARTY_COMMANDS.filter((command) => commandAvailability(command, status, can).kind === 'available'));
}

/** Vencido: su «hasta» ya pasó. Uno futuro (aún no vigente) no está vencido. */
export function isExpired(identifier: Pick<PartyIdentifier, 'validTo'>, today: string): boolean {
  return identifier.validTo !== null && identifier.validTo < today;
}

/** Primario vigente, si lo hay (`INV-PTY-03`). */
export function currentPrimary(identifiers: readonly PartyIdentifier[]): PartyIdentifier | undefined {
  return identifiers.find((identifier) => identifier.isPrimary && identifier.isCurrent);
}
