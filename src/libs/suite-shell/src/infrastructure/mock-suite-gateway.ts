import { SLOW_LATENCY_MS, type NetworkSettings, type SuiteGateway } from '@suite/contracts';
import { createMockSuiteGateway, type SessionStorageAdapter } from '@suite/mock';

export interface SuiteGatewayOptions {
  /** Para pruebas: almacenamiento propio de la sesión. */
  readonly storage?: SessionStorageAdapter;
  /** Para pruebas: sustituye partes del gateway (p. ej. una lista larga de notificaciones). */
  readonly decorateGateway?: (base: SuiteGateway) => SuiteGateway;
}

/**
 * ÚNICO punto de la suite que conoce `@suite/mock`, junto con `test-users.ts`. La suite del prototipo es un
 * MOCK (anexo A1 de UX-SIL-001): se sustituye por el portal real (G-124, G-176) implementando `SuiteGateway`.
 */
export function createSuiteGateway(settings: NetworkSettings, options: SuiteGatewayOptions = {}): SuiteGateway {
  const base = createMockSuiteGateway({
    latencyMs: settings.latencyMs,
    slow: settings.latencyMs >= SLOW_LATENCY_MS,
    empty: settings.mode === 'vacio',
    loadError: settings.mode === 'error',
    umsDown: settings.suite.umsDown,
    maintenance: settings.suite.maintenance,
    expires: settings.suite.expires,
    ...(settings.suite.notifications === undefined ? {} : { notifications: settings.suite.notifications }),
    ...(options.storage === undefined ? {} : { storage: options.storage }),
  });
  return options.decorateGateway === undefined ? base : options.decorateGateway(base);
}
