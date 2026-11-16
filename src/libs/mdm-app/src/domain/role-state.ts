import type { PartyRole, RoleInput } from '@mdm/contracts';
import { checkDate, earlierDate, isCivilDate, laterDate, validitiesOverlap, type FieldIssue } from './field-rules.ts';

/**
 * Estado visible del rol (UI-MDM-001 §2.2): se deriva de `status` y de la vigencia, porque «la vigencia manda sobre
 * el estado». `isCurrent` lo calcula el servidor; aquí solo se distingue un rol futuro de uno vencido.
 */
export type RoleDisplayState =
  | { readonly kind: 'current' }
  | { readonly kind: 'future'; readonly startsOn: string }
  /** `endedOn` es `null` solo si el servidor lo da por no vigente sin un «hasta» pasado (incoherencia: se muestra sin fecha). */
  | { readonly kind: 'expired'; readonly endedOn: string | null }
  | { readonly kind: 'suspended' }
  | { readonly kind: 'terminated' };

type RoleState = Pick<PartyRole, 'status' | 'isCurrent' | 'validFrom' | 'validTo'>;

export function roleDisplayState(role: RoleState, today: string): RoleDisplayState {
  if (role.status === 'Terminated') return { kind: 'terminated' };
  if (role.status === 'Suspended') return { kind: 'suspended' };
  if (role.isCurrent) return { kind: 'current' };
  if (role.validFrom > today) return { kind: 'future', startsOn: role.validFrom };
  return { kind: 'expired', endedOn: role.validTo !== null && role.validTo < today ? role.validTo : null };
}

/**
 * Histórico: terminado o con su vigencia ya pasada. La sección Roles los oculta por defecto («Mostrar históricos»);
 * un rol suspendido o futuro no es histórico: todavía puede volver a estar vigente.
 */
export function isHistoricalRole(role: Pick<PartyRole, 'status' | 'validTo'>, today: string): boolean {
  return role.status === 'Terminated' || (role.validTo !== null && role.validTo < today);
}

const ORDER: Readonly<Record<RoleDisplayState['kind'], number>> = { current: 0, future: 1, suspended: 2, expired: 3, terminated: 4 };

/** Vigentes primero, después futuros, suspendidos, vencidos y terminados; dentro de cada grupo, el más reciente. */
export function compareRoles(today: string): (a: RoleState, b: RoleState) => number {
  return (a, b) => {
    const byState = ORDER[roleDisplayState(a, today).kind] - ORDER[roleDisplayState(b, today).kind];
    return byState !== 0 ? byState : b.validFrom.localeCompare(a.validFrom);
  };
}

/** Órdenes por fila (US-MDM-008). Un rol terminado no admite ninguna (terminal). */
export const ROLE_ROW_COMMANDS = ['suspendRole', 'activateRole', 'terminateRole'] as const;
export type RoleRowCommand = (typeof ROLE_ROW_COMMANDS)[number];

export function roleRowCommands(role: Pick<PartyRole, 'status'>): readonly RoleRowCommand[] {
  switch (role.status) {
    case 'Active':
      return ['suspendRole', 'terminateRole'];
    case 'Suspended':
      return ['activateRole', 'terminateRole'];
    case 'Terminated':
      return [];
  }
}

// D-MDM-04 «Asignar rol» (US-MDM-007).

export interface RoleDraft {
  readonly roleTypeCode: string;
  /** Vacío es hoy (P-12). */
  readonly validFrom: string;
  /** Vacío es indefinido. */
  readonly validTo: string;
}

export type RoleDraftField = keyof RoleDraft;
export const ROLE_DRAFT_FIELDS: readonly RoleDraftField[] = ['roleTypeCode', 'validFrom', 'validTo'];

export function emptyRoleDraft(today: string): RoleDraft {
  return { roleTypeCode: '', validFrom: today, validTo: '' };
}

/** Vigencia del borrador ya resuelta, o `null` si sus fechas aún no son válidas. */
function validityOf(draft: RoleDraft, today: string): { readonly validFrom: string; readonly validTo: string | null } | null {
  const validFrom = draft.validFrom === '' ? today : draft.validFrom;
  if (!isCivilDate(validFrom) || (draft.validTo !== '' && !isCivilDate(draft.validTo))) return null;
  return { validFrom, validTo: draft.validTo === '' ? null : draft.validTo };
}

/**
 * Rol cargado del mismo tipo, no terminado, cuya vigencia se cruza con la del borrador (`INV-PTY-05`). Es una ayuda:
 * lo decide el servidor, porque otra persona pudo asignar uno después de cargar la ficha (UX-MDM-001 §4.3).
 */
export function findLoadedOverlap(draft: RoleDraft, roles: readonly PartyRole[], today: string): PartyRole | null {
  const validity = validityOf(draft, today);
  if (validity === null || draft.roleTypeCode === '') return null;
  return roles.find((role) => role.roleTypeCode === draft.roleTypeCode && role.status !== 'Terminated' && validitiesOverlap(role, validity)) ?? null;
}

/** Problemas locales: tipo obligatorio, fechas válidas, «hasta» ≥ «desde» y solape con los roles cargados. */
export function validateRoleDraft(draft: RoleDraft, roles: readonly PartyRole[], today: string): Partial<Record<RoleDraftField, FieldIssue>> {
  const from = draft.validFrom === '' ? today : draft.validFrom;
  const validToIssue = checkDate(draft.validTo, { required: false, notBefore: isCivilDate(from) ? from : null });
  const overlap = findLoadedOverlap(draft, roles, today);
  const found: Array<readonly [RoleDraftField, FieldIssue | null]> = [
    ['roleTypeCode', draft.roleTypeCode === '' ? { kind: 'required' } : null],
    ['validFrom', checkDate(draft.validFrom, { required: false, notBefore: null })],
    [
      'validTo',
      validToIssue ??
        (overlap === null ? null : { kind: 'overlap', roleTypeCode: overlap.roleTypeCode, validFrom: overlap.validFrom, validTo: overlap.validTo }),
    ],
  ];
  return Object.fromEntries(found.filter(([, issue]) => issue !== null));
}

/** Cuerpo de P-12: lo vacío viaja como `null` (hoy e indefinido). */
export function toRoleInput(draft: RoleDraft): RoleInput {
  return {
    roleTypeCode: draft.roleTypeCode,
    validFrom: draft.validFrom === '' ? null : draft.validFrom,
    validTo: draft.validTo === '' ? null : draft.validTo,
  };
}

// D-MDM-10 «Terminar rol» (US-MDM-008).

/**
 * «Termina el» por defecto: hoy, acotado a la vigencia del rol (P-15 exige `validFrom ≤ validTo ≤ hasta vigente`):
 * un rol vencido termina en su «hasta» y uno futuro, en su «desde».
 */
export function defaultTerminationDate(role: Pick<PartyRole, 'validFrom' | 'validTo'>, today: string): string {
  const capped = role.validTo === null ? today : earlierDate(today, role.validTo);
  return laterDate(role.validFrom, capped);
}

/** «Termina el» (vacío es hoy): entre el «desde» del rol y su «hasta» vigente, si lo tiene. */
export function checkTerminationDate(value: string, role: Pick<PartyRole, 'validFrom' | 'validTo'>, today: string): FieldIssue | null {
  const issue = checkDate(value, { required: false, notBefore: null });
  if (issue !== null) return issue;
  const date = value === '' ? today : value;
  if (role.validTo === null) return date < role.validFrom ? { kind: 'before', from: role.validFrom } : null;
  return date < role.validFrom || date > role.validTo ? { kind: 'out_of_range', from: role.validFrom, to: role.validTo } : null;
}
