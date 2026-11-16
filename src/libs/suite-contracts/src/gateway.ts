import { type SuiteSession, type SuiteProfile } from './session.ts';
import type { Site, SystemCode, CatalogSystem } from './systems.ts';
import type { SignInTenant } from './tenants.ts';
import type { NotificationFilter, NotificationPage, MarkReadOutcome, MarkAllReadOutcome } from './notifications.ts';

export type SignInOutcome =
  | { readonly type: 'ok'; readonly session: SuiteSession }
  | { readonly type: 'invalid-credentials' }
  | { readonly type: 'locked' }
  | { readonly type: 'ums-unavailable'; readonly correlation: string };

/** Lo que consume S-02 por sistema: el catálogo más los perfiles de la sesión en él. */
export interface SystemCard extends CatalogSystem {
  readonly profiles: readonly SuiteProfile[];
}

/** Falla de lectura del lanzador (red caída, error del servicio). Lleva la correlación para soporte. */
export class SuiteGatewayError extends Error {
  readonly correlation: string;
  constructor(correlation: string) {
    super('No se pudo leer la suite');
    this.name = 'SuiteGatewayError';
    this.correlation = correlation;
  }
}

/**
 * Interfaz que sustituye el portal de la suite (anexo A1, §7.1). El mock la implementa en
 * memoria; el portal real traerá cookie `HttpOnly` y UMS (ADR-0245 como referencia, G-124).
 */
export interface SuiteGateway {
  /**
   * Los inquilinos que S-01 ofrece, ordenados por nombre (D-029): en el portal real, `GET /api/v1/auth/tenants`
   * de UMS, anónimo. Lanza `SuiteGatewayError` si no se pueden leer.
   */
  listSignInTenants(): Promise<readonly SignInTenant[]>;
  /** Un inquilino que no existe o al que la persona no pertenece responde como credencial inválida (anti-enumeración). */
  signIn(tenant: string, user: string, key: string): Promise<SignInOutcome>;
  /** La sesión vigente o `null` si no hay o venció. */
  currentSession(): SuiteSession | null;
  signOut(): void;
  systemsOf(session: SuiteSession): Promise<readonly SystemCard[]>;
  chooseProfile(system: SystemCode, profileId: string): SuiteSession | null;
  /**
   * Cambia la sede de trabajo de S-02 (`null`: todas) y, en cada sistema cuyo perfil vigente no valga en ella, pasa
   * al primero que sí (en UMS, `switch-profile` por sistema, ADR-0156 §2.6). `null` si la sede no es de la sesión.
   */
  chooseSite(site: Site | null): SuiteSession | null;
  /** Anota la última actividad de la persona: alimenta la inactividad de la sesión (SU-30). */
  recordActivity(): void;

  /*
   * Notificaciones de la suite (anexo A1 §10.7). Todas actúan sobre el usuario y el perfil vigente de
   * SIL de la sesión. Las lecturas lanzan `SuiteGatewayError`; las escrituras devuelven uniones.
   */
  listNotifications(session: SuiteSession, filter?: NotificationFilter): Promise<NotificationPage>;
  /** Barata: alimenta la insignia de la campana. */
  countUnread(session: SuiteSession): Promise<{ readonly unread: number }>;
  /** Idempotente. */
  markRead(session: SuiteSession, id: string): Promise<MarkReadOutcome>;
  /** Marca todas las del perfil, no solo las filtradas ni las cargadas. */
  markAllRead(session: SuiteSession): Promise<MarkAllReadOutcome>;
}
