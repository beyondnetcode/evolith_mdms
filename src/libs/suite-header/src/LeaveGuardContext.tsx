import { createContext, use } from 'react';

/**
 * Contrato de «salida protegida» (anexo A1 §4): quien tiene cambios sin guardar (SIL) lo registra; la
 * cabecera lo consume antes de sacar a la persona de la pantalla (campana, «Ver todas», abrir una
 * notificación). Fuera de un sistema que lo registre, la acción se ejecuta ya.
 */
export interface LeaveGuard {
  /** Ejecuta `action` ya, o tras confirmar «Salir» si hay cambios sin guardar. */
  readonly request: (action: () => void) => void;
}

export const LeaveGuardContext = createContext<LeaveGuard | null>(null);

const IMMEDIATE: LeaveGuard = { request: (action) => action() };

export function useLeaveGuard(): LeaveGuard {
  return use(LeaveGuardContext) ?? IMMEDIATE;
}
