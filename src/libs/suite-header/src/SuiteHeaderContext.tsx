import type { MarkAllReadOutcome, MarkReadOutcome, Notification, NotificationFilter, NotificationPage, SuiteProfile, SuiteUser } from '@suite/contracts';
import type { QueryClient } from '@tanstack/react-query';
import { createContext, use } from 'react';

/**
 * Notificaciones de la cabecera (anexo A1 §10), tal como las entrega el anfitrión: la cuenta de la campana,
 * las recientes del último sondeo y las operaciones sobre el perfil vigente de la sesión. El anfitrión hace
 * el sondeo y tiene la única región en vivo; la cabecera pinta la campana, la hoja y la lista.
 */
export interface HeaderNotifications {
  /** Caché de servidor de las notificaciones: la de la suite, no la de un sistema montado. */
  readonly queryClient: QueryClient;
  /** Prefijo de las claves de consulta: cambia con la sesión y con el perfil vigente. */
  readonly queryRoot: readonly string[];
  /** Perfil del que son las notificaciones; `null` si la sesión no concede el sistema que las produce. */
  readonly profile: SuiteProfile | null;
  /** Cuenta de no leídas, o `null` si aún no se conoce (la campana conserva la última conocida si falla). */
  readonly unreadCount: number | null;
  /** Las más recientes según el último sondeo: para ofrecer «Mostrar {n} nuevas» sin mover la lista abierta. */
  readonly recent: readonly Notification[];
  readonly list: (filter: NotificationFilter) => Promise<NotificationPage>;
  readonly markRead: (id: string) => Promise<MarkReadOutcome>;
  readonly markAllRead: () => Promise<MarkAllReadOutcome>;
  /** Anuncia en la región en vivo del anfitrión (WCAG 4.1.3). */
  readonly announce: (text: string) => void;
}

/**
 * Lo que la cabecera común necesita del anfitrión (ADR-0245): la persona de la sesión, cerrar sesión y las
 * notificaciones. Lo implementa la suite; un sistema montado solo lo consume a través de la cabecera.
 */
export interface SuiteHeader {
  readonly user: SuiteUser;
  readonly signOut: () => void;
  readonly notifications: HeaderNotifications;
}

export const SuiteHeaderContext = createContext<SuiteHeader | null>(null);

export function useSuiteHeader(): SuiteHeader {
  const header = use(SuiteHeaderContext);
  if (header === null) throw new Error('useSuiteHeader requiere un SuiteHeaderContext con sesión');
  return header;
}

export function useHeaderNotifications(): HeaderNotifications {
  return useSuiteHeader().notifications;
}
