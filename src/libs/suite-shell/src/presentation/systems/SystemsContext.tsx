import type { SystemDescriptor } from '@suite/contracts';
import { createContext, use } from 'react';

/**
 * Los sistemas que el anfitrión registra (D-026). La suite los conoce solo por su descriptor: la sigla y cómo
 * nombrar sus roles (el lanzador y las notificaciones dicen «Customer Service · Callao»), nunca su código.
 */
export const SystemsContext = createContext<readonly SystemDescriptor[]>([]);

export function useSystems(): readonly SystemDescriptor[] {
  return use(SystemsContext);
}
