import type { MenuItem } from '@sil/ui';
import type { CommandAvailability, PartyCommand } from '../../../domain/party-policy.ts';
import { BLOCKED_TEXTS } from './texts.ts';

/** Disponibilidad de cada orden en la organización cargada (estado y rol). */
export type Availability = (command: PartyCommand) => CommandAvailability;

/**
 * Elementos del menú de una fila: las órdenes ocultas no se pintan; las bloqueadas por la organización suspendida
 * se pintan deshabilitadas con su motivo visible (`MenuItem.reason`, UI-MDM-001 §3.3). Sin elementos, no hay menú.
 */
export function rowMenuItems<C extends PartyCommand>(
  commands: readonly C[],
  availability: Availability,
  labels: Readonly<Record<C, string>>,
  onSelect: (command: C) => void,
): MenuItem[] {
  return commands.flatMap((command): MenuItem[] => {
    const state = availability(command);
    switch (state.kind) {
      case 'hidden':
        return [];
      case 'blocked':
        return [{ id: command, label: labels[command], onSelect: () => undefined, disabled: true, reason: BLOCKED_TEXTS[state.reason] }];
      case 'available':
        return [{ id: command, label: labels[command], onSelect: () => onSelect(command) }];
    }
  });
}

/** Un menú con solo elementos deshabilitados no ofrece nada: no se pinta. */
export function hasEnabledItem(items: readonly MenuItem[]): boolean {
  return items.some((item) => item.disabled !== true);
}
