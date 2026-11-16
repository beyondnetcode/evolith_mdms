/**
 * Ajustes de red y simulaciones del prototipo (`?sim=`), leídos una vez al arrancar. Los comparten la
 * suite y los sistemas que monta (SIL): el anfitrión los lee y los entrega en el `SystemContext`.
 * Los valores son los de la URL y se conservan en español (glosario de código web §5).
 */

/** Modo de red del mock de un sistema: estados de carga, vacío y error sin un servidor real. */
export type NetworkMode = 'normal' | 'vacio' | 'error' | 'nuevas' | 'antiguos';

/** `?sim=notif-*` (anexo A1 §10.7): una sola simulación de notificaciones a la vez. */
export type NotificationsSimulation = 'vacio' | 'error' | 'error-marcar' | 'nueva' | 'reiniciar';

/** Simulaciones propias de la suite (anexo A1 §7.5); el resto (`lento`, `vacio`, `error`) es de red. */
export interface SuiteSimulation {
  /** `?sim=ums-caido`: el inicio de sesión responde que UMS no contesta. */
  readonly umsDown: boolean;
  /** `?sim=mantenimiento`: la tarjeta de SIL pasa a «En mantenimiento». */
  readonly maintenance: boolean;
  /** `?sim=expira`: la sesión vence a los 20 s. */
  readonly expires: boolean;
  /** `?sim=notif-vacio|notif-error|notif-error-marcar|notif-nueva|notif-reiniciar` (anexo A1 §10.7). Sin simulación, ausente. */
  readonly notifications?: NotificationsSimulation;
}

export interface NetworkSettings {
  readonly latencyMs: number;
  readonly mode: NetworkMode;
  readonly suite: SuiteSimulation;
}

export const NO_SUITE_SIMULATION: SuiteSimulation = { umsDown: false, maintenance: false, expires: false };
const NORMAL: NetworkSettings = { latencyMs: 250, mode: 'normal', suite: NO_SUITE_SIMULATION };

/** Desde esta latencia el mock de la suite también alarga el inicio de sesión (`?sim=lento`). */
export const SLOW_LATENCY_MS = 2500;

/**
 * `?sim=lento|error|vacio|nuevas|antiguos|ums-caido|mantenimiento|expira|notif-*` permite ver los estados de carga, error,
 * vacío y los de la suite sin un servidor real. Se lee una vez al arrancar y solo admite valores
 * de una lista cerrada.
 */
export function readNetworkSettings(search: string): NetworkSettings {
  const value = new URLSearchParams(search).get('sim');
  switch (value) {
    case 'lento':
      return { ...NORMAL, latencyMs: SLOW_LATENCY_MS };
    case 'error':
      return { ...NORMAL, latencyMs: 300, mode: 'error' };
    case 'vacio':
      return { ...NORMAL, mode: 'vacio' };
    case 'nuevas':
      return { ...NORMAL, mode: 'nuevas' };
    case 'antiguos':
      return { ...NORMAL, mode: 'antiguos' };
    default:
      return { ...NORMAL, suite: suiteSimulation(value) };
  }
}

/** Simulaciones de la suite y de sus notificaciones: lista cerrada; lo desconocido no simula nada. */
function suiteSimulation(value: string | null): SuiteSimulation {
  switch (value) {
    case 'ums-caido':
      return { ...NO_SUITE_SIMULATION, umsDown: true };
    case 'mantenimiento':
      return { ...NO_SUITE_SIMULATION, maintenance: true };
    case 'expira':
      return { ...NO_SUITE_SIMULATION, expires: true };
    case 'notif-vacio':
      return { ...NO_SUITE_SIMULATION, notifications: 'vacio' };
    case 'notif-error':
      return { ...NO_SUITE_SIMULATION, notifications: 'error' };
    case 'notif-error-marcar':
      return { ...NO_SUITE_SIMULATION, notifications: 'error-marcar' };
    case 'notif-nueva':
      return { ...NO_SUITE_SIMULATION, notifications: 'nueva' };
    case 'notif-reiniciar':
      return { ...NO_SUITE_SIMULATION, notifications: 'reiniciar' };
    default:
      return NO_SUITE_SIMULATION;
  }
}
