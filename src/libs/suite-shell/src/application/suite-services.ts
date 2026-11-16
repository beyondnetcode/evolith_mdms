import { createContext, use } from 'react';
import type { ThemeStore } from './theme-preferences.ts';

/** Usuario de prueba que S-01 ofrece con «Usar» (anexo A1 §2): sin la clave, que se pide aparte. */
export interface VisibleTestUser {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** El inquilino de la cuenta: S-01 solo ofrece las del inquilino elegido. */
  readonly tenant: string;
}

/**
 * Servicios de infraestructura que la presentación de la suite usa sin conocer su implementación: los
 * cablea la raíz de composición (`suite-providers.tsx`). Con el portal real, los usuarios de prueba desaparecen.
 */
export interface SuiteServices {
  readonly themeStore: ThemeStore;
  readonly testUsers: readonly VisibleTestUser[];
  /** La clave de prueba, ÚNICAMENTE para el botón «Usar»: nunca se muestra ni se registra. */
  readonly testPassword: () => string;
}

export const SuiteServicesContext = createContext<SuiteServices | null>(null);

export function useSuiteServices(): SuiteServices {
  const services = use(SuiteServicesContext);
  if (services === null) throw new Error('useSuiteServices requiere un SuiteServicesContext');
  return services;
}
