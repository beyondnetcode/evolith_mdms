import {
  SuiteGatewayError,
  readStateKey,
  isVisibleForRole,
  parseReadState,
  parseRawSession,
  currentProfileOf,
  profilesOf,
  profilesInSite,
  sitesOf,
  normalizeTenantCode,
  serializeReadState,
  type NotificationFilter,
  type Notification,
  type NotificationPage,
  type MarkReadOutcome,
  type MarkAllReadOutcome,
  type SignInOutcome,
  type SuiteSession,
  type SystemCode,
  type SuiteGateway,
  type SystemCard,
  type NotificationsSimulation,
} from '@suite/contracts';
import { mockCatalog } from './catalog.ts';
import { INITIAL_UNREAD, applyFilter, newNotification, seedsByProfile, type NotificationSeed } from './notifications.ts';
import {
  MOCK_ACTIVITY_KEY,
  MOCK_SESSION_KEY,
  INACTIVITY_MS,
  SHORT_VALIDITY_MS,
  WORKDAY_VALIDITY_MS,
  createTestSession,
} from './test-session.ts';
import { findActiveTenant, signInTenants } from './tenants.ts';
import { TEST_PASSWORD, caseProfileId, findTestUserIn } from './test-users.ts';

/** Dónde guarda el mock la sesión: `sessionStorage` en el navegador, memoria si está bloqueado. */
export interface SessionStorageAdapter {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export function browserSessionStorage(): SessionStorageAdapter {
  const memory = new Map<string, string>();
  return {
    read: (key) => {
      try {
        return globalThis.sessionStorage.getItem(key);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    write: (key, value) => {
      try {
        globalThis.sessionStorage.setItem(key, value);
      } catch {
        // Almacenamiento bloqueado por el navegador: la sesión dura lo que dure la página.
        memory.set(key, value);
      }
    },
    remove: (key) => {
      memory.delete(key);
      try {
        globalThis.sessionStorage.removeItem(key);
      } catch {
        // Sin almacenamiento no hay nada que borrar.
      }
    },
  };
}

/** Dónde guarda el mock el estado de lectura de notificaciones: `localStorage`, memoria si está bloqueado. */
export function browserLocalStorage(): SessionStorageAdapter {
  const memory = new Map<string, string>();
  return {
    read: (key) => {
      try {
        return globalThis.localStorage.getItem(key);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    write: (key, value) => {
      try {
        globalThis.localStorage.setItem(key, value);
      } catch {
        // Almacenamiento bloqueado (modo privado): el estado de lectura dura lo que dure la página.
        memory.set(key, value);
      }
    },
    remove: (key) => {
      memory.delete(key);
      try {
        globalThis.localStorage.removeItem(key);
      } catch {
        // Sin almacenamiento no hay nada que borrar.
      }
    },
  };
}

/** `?sim=notif-*` (anexo A1 §10.7): el tipo vive en el contrato, porque lo lee el anfitrión. */
export type NotificationsMode = NotificationsSimulation;

/** A los cuántos ms de crear el gateway llega la notificación de `?sim=notif-nueva`. */
export const NEW_NOTIFICATION_ARRIVAL_MS = 15_000;
const SLOW_NOTIFICATIONS_LATENCY_MS = 1500;

export interface MockSuiteOptions {
  /** Latencia de las lecturas del lanzador; el inicio de sesión usa la mayor de esta y 250 ms. */
  readonly latencyMs: number;
  /** `?sim=lento`: el inicio de sesión tarda ~1,5 s. */
  readonly slow?: boolean;
  /** `?sim=vacio`: la sesión no concede ningún sistema en el lanzador. */
  readonly empty?: boolean;
  /** `?sim=error`: error de lectura del lanzador. */
  readonly loadError?: boolean;
  /** `?sim=ums-caido`: el inicio de sesión devuelve `ums-no-responde`. */
  readonly umsDown?: boolean;
  /** `?sim=mantenimiento`: la tarjeta de SIL pasa a `EN_MANTENIMIENTO`. */
  readonly maintenance?: boolean;
  /** `?sim=expira`: la sesión vence a los 20 s. */
  readonly expires?: boolean;
  readonly storage?: SessionStorageAdapter;
  /** Estado de lectura de las notificaciones; por defecto `localStorage` del navegador. */
  readonly localStorage?: SessionStorageAdapter;
  /** `?sim=notif-vacio|notif-error|notif-error-marcar|notif-nueva|notif-reiniciar`. */
  readonly notifications?: NotificationsMode;
  readonly now?: () => number;
}

const ATTEMPTS_TO_LOCK = 5;
const SLOW_SIGN_IN_LATENCY_MS = 1500;

const wait = (ms: number): Promise<void> => (ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms)));

function correlation(): string {
  return `SUITE-${globalThis.crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

/**
 * Gateway en memoria de la suite del prototipo (anexo A1 §7.1). Sustituye al portal real: sin
 * tokens, la sesión es un objeto inmutable validado al leerse. El contador de intentos fallidos
 * vive solo en la memoria de la pestaña (SU-29) y solo cuenta cuentas que existen, para que el
 * bloqueo no revele cuáles existen (ADR-0165 P-SEC-01).
 */
export function createMockSuiteGateway(options: MockSuiteOptions): SuiteGateway {
  const storage = options.storage ?? browserSessionStorage();
  const now = options.now ?? Date.now;
  const local = options.localStorage ?? browserLocalStorage();
  const createdAt = now();
  const reset = new Set<string>();
  const failed = new Map<string, number>();
  const validityMs = options.expires === true ? SHORT_VALIDITY_MS : WORKDAY_VALIDITY_MS;
  const inactivityMs = options.expires === true ? SHORT_VALIDITY_MS : INACTIVITY_MS;

  const save = (session: SuiteSession): void => {
    storage.write(MOCK_SESSION_KEY, JSON.stringify(session));
  };

  const currentSession = (): SuiteSession | null => {
    const session = parseRawSession(storage.read(MOCK_SESSION_KEY));
    if (session === null) return null;
    // `?sim=expira` acorta también las sesiones ya abiertas (p. ej. sembradas por una prueba): vencen a los 20 s de emitirse.
    const cap = Math.min(Date.parse(session.expiresAt), options.expires === true ? Date.parse(session.issuedAt) + SHORT_VALIDITY_MS : Infinity);
    const expired = cap <= now();
    const activity = Number(storage.read(MOCK_ACTIVITY_KEY));
    const inactive = activity > 0 && activity + inactivityMs <= now();
    if (expired || inactive) {
      storage.remove(MOCK_SESSION_KEY);
      return null;
    }
    return session;
  };

  /**
   * Qué responde el mock a un trío inquilino/usuario/clave, sin efectos más que el contador de fallos. La
   * cuenta solo existe dentro de su inquilino: fuera de él, o en un inquilino inactivo, es «credenciales».
   */
  const evaluate = (
    tenant: string,
    user: string,
    key: string,
  ): { readonly type: 'invalid-credentials' | 'locked' } | { readonly type: 'ok'; readonly id: string } => {
    const defined = findActiveTenant(tenant) === undefined ? undefined : findTestUserIn(tenant, user);
    if (defined === undefined) return { type: 'invalid-credentials' };
    const account = `${tenant}/${defined.id}`;
    if (defined.lockedFromSource || (failed.get(account) ?? 0) >= ATTEMPTS_TO_LOCK) return { type: 'locked' };
    if (key !== TEST_PASSWORD) {
      failed.set(account, (failed.get(account) ?? 0) + 1);
      return { type: 'invalid-credentials' };
    }
    failed.delete(account);
    return { type: 'ok', id: defined.id };
  };

  /** Lo que el usuario ya marcó como leído; `?sim=notif-reiniciar` lo borra la primera vez que se lee. */
  const readStateOf = (userId: string): Set<string> => {
    if (options.notifications === 'reiniciar' && !reset.has(userId)) {
      reset.add(userId);
      local.remove(readStateKey(userId));
    }
    return new Set(parseReadState(local.read(readStateKey(userId))));
  };

  /** Las notificaciones del usuario y del perfil vigente de SIL de la sesión, ya filtradas por rol (SU-40, SU-42). */
  const notificationsOf = (session: SuiteSession): readonly Notification[] => {
    if (options.notifications === 'vacio') return [];
    const profile = currentProfileOf(session, 'SIL');
    if (profile === null) return [];
    const nowMs = now();
    const seed = seedsByProfile(nowMs)[caseProfileId(profile.profileId)];
    // El servicio puede entregar todos los tipos: cada perfil solo ve los que su rol permite.
    const own: NotificationSeed[] = [...(seed?.notifications ?? [])];
    if (options.notifications === 'nueva' && profile.site === 'Callao' && seed !== undefined && nowMs >= createdAt + NEW_NOTIFICATION_ARRIVAL_MS) {
      own.push(newNotification(profile.role, createdAt + NEW_NOTIFICATION_ARRIVAL_MS));
    }
    const readIds = readStateOf(session.user.id);
    return own
      .filter((n) => isVisibleForRole(n.type, profile.role))
      .map((n): Notification => ({ ...n, read: readIds.has(n.id) || !INITIAL_UNREAD.has(n.id) }));
  };

  const waitForNotifications = (): Promise<void> => wait(options.slow === true ? SLOW_NOTIFICATIONS_LATENCY_MS : options.latencyMs);
  const failLoad = (): void => {
    if (options.notifications === 'error') throw new SuiteGatewayError(correlation());
  };

  return {
    // `?sim=ums-caido` no la afecta: en UMS es una lectura anónima en caché (`max-age=300`) que sobrevive al login.
    async listSignInTenants() {
      await wait(Math.min(options.latencyMs, 250));
      return signInTenants();
    },

    async signIn(tenant, user, key): Promise<SignInOutcome> {
      await wait(options.slow === true ? SLOW_SIGN_IN_LATENCY_MS : Math.min(options.latencyMs, 250));
      if (options.umsDown === true) return { type: 'ums-unavailable', correlation: correlation() };
      const verdict = evaluate(normalizeTenantCode(tenant), user, key);
      if (verdict.type !== 'ok') return verdict;
      const session = { ...createTestSession({ user: verdict.id, now: now(), validityMs }), sessionId: `mock-${globalThis.crypto.randomUUID().slice(0, 8)}` };
      storage.write(MOCK_ACTIVITY_KEY, String(now()));
      save(session);
      return { type: 'ok', session: session };
    },

    currentSession: currentSession,

    signOut(): void {
      storage.remove(MOCK_SESSION_KEY);
      storage.remove(MOCK_ACTIVITY_KEY);
    },

    async systemsOf(session): Promise<readonly SystemCard[]> {
      await wait(options.slow === true ? 2500 : options.latencyMs);
      if (options.loadError === true) throw new SuiteGatewayError(correlation());
      if (options.empty === true) return [];
      return mockCatalog(options.maintenance === true)
        .map((system) => ({ ...system, profiles: profilesOf(session, system.code) }))
        .filter((card) => card.profiles.length > 0)
        .toSorted((a, b) => a.name.localeCompare(b.name, 'es'));
    },

    chooseProfile(system: SystemCode, profileId: string): SuiteSession | null {
      const session = currentSession();
      if (!session?.profiles.some((p) => p.profileId === profileId && p.system === system)) return null;
      const next: SuiteSession = { ...session, currentProfileBySystem: { ...session.currentProfileBySystem, [system]: profileId } };
      save(next);
      return next;
    },

    chooseSite(site): SuiteSession | null {
      const session = currentSession();
      if (session === null || (site !== null && !sitesOf(session).includes(site))) return null;
      // En cada sistema cuyo perfil vigente no valga en la sede, el primero que sí (switch-profile de UMS).
      const current: Partial<Record<SystemCode, string>> = { ...session.currentProfileBySystem };
      for (const system of new Set(session.profiles.map((p) => p.system))) {
        const valid = profilesInSite(profilesOf(session, system), site);
        if (!valid.some((p) => p.profileId === currentProfileOf(session, system)?.profileId) && valid[0] !== undefined) current[system] = valid[0].profileId;
      }
      const next: SuiteSession = { ...session, currentSite: site, currentProfileBySystem: current };
      save(next);
      return next;
    },

    recordActivity(): void {
      storage.write(MOCK_ACTIVITY_KEY, String(now()));
    },

    async listNotifications(session, filter: NotificationFilter = {}): Promise<NotificationPage> {
      await waitForNotifications();
      failLoad();
      return applyFilter(notificationsOf(session), filter, now());
    },

    async countUnread(session): Promise<{ readonly unread: number }> {
      await wait(options.slow === true ? SLOW_NOTIFICATIONS_LATENCY_MS : Math.min(options.latencyMs, 100));
      failLoad();
      return { unread: applyFilter(notificationsOf(session), { limit: 1 }, now()).unread };
    },

    async markRead(session, id): Promise<MarkReadOutcome> {
      await wait(Math.min(options.latencyMs, 150));
      if (options.notifications === 'error-marcar') return { type: 'error', correlation: correlation() };
      const existing = notificationsOf(session).find((n) => n.id === id);
      if (existing === undefined) return { type: 'not-found' };
      const readIds = readStateOf(session.user.id);
      readIds.add(id);
      local.write(readStateKey(session.user.id), serializeReadState(readIds));
      return { type: 'ok', unread: applyFilter(notificationsOf(session), { limit: 1 }, now()).unread };
    },

    async markAllRead(session): Promise<MarkAllReadOutcome> {
      await wait(Math.min(options.latencyMs, 150));
      if (options.notifications === 'error-marcar') return { type: 'error', correlation: correlation() };
      // Todas las del perfil, no solo las filtradas ni las cargadas.
      const pending = notificationsOf(session).filter((n) => !n.read);
      const readIds = readStateOf(session.user.id);
      for (const n of pending) readIds.add(n.id);
      local.write(readStateKey(session.user.id), serializeReadState(readIds));
      return { type: 'ok', markedCount: pending.length, unread: 0 };
    },
  };
}
