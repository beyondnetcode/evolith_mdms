import type { NetworkSettings, SignInOutcome, Site, SuiteGateway, SuiteSession, SystemCode } from '@suite/contracts';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/*
 * La sesión de la suite. El gateway llega inyectado por la raíz de composición: en el prototipo es un MOCK
 * (anexo A1 de UX-SIL-001) y se sustituye por el portal real (G-124, G-176) sin tocar la presentación.
 */

interface Suite {
  readonly gateway: SuiteGateway;
  readonly settings: NetworkSettings;
  /** La sesión vigente, o `null`. Con la aplicación abierta sigue aquí aunque ya haya vencido: ver `expired`. */
  readonly session: SuiteSession | null;
  /** La sesión venció con la aplicación abierta: se muestra «Tu sesión terminó» sin vaciar la pantalla (SU-16). */
  readonly expired: boolean;
  readonly signIn: (tenant: string, user: string, password: string) => Promise<SignInOutcome>;
  readonly signOut: () => void;
  readonly chooseProfile: (system: SystemCode, profileId: string) => void;
  /** Cambia la sede de trabajo de S-02 (`null`: todas las sedes, D-030). */
  readonly chooseSite: (site: Site | null) => void;
}

const Context = createContext<Suite | null>(null);

/** Cada cuánto se comprueba si la sesión sigue vigente (tope de jornada o inactividad). */
const CHECK_INTERVAL_MS = 1000;
/** Con actividad frecuente solo se anota una vez por este intervalo. */
const ACTIVITY_RECORD_MS = 5000;

interface Props {
  readonly children: ReactNode;
  readonly gateway: SuiteGateway;
  readonly settings: NetworkSettings;
}

export function SuiteProvider({ children, gateway, settings }: Props) {
  const [session, setSession] = useState<SuiteSession | null>(() => gateway.currentSession());
  const [expired, setExpired] = useState(false);
  const hasCurrent = session !== null && !expired;

  // Vigencia y actividad: la sesión es un sistema externo (almacenamiento y reloj), así que se sincroniza con un efecto.
  const lastActivityRecord = useRef(0);
  useEffect(() => {
    if (!hasCurrent) return;
    const recordActivity = (): void => {
      const now = Date.now();
      if (now - lastActivityRecord.current < ACTIVITY_RECORD_MS) return;
      lastActivityRecord.current = now;
      gateway.recordActivity();
    };
    const check = setInterval(() => {
      if (gateway.currentSession() === null) setExpired(true);
    }, CHECK_INTERVAL_MS);
    globalThis.addEventListener('pointerdown', recordActivity);
    globalThis.addEventListener('keydown', recordActivity);
    return () => {
      clearInterval(check);
      globalThis.removeEventListener('pointerdown', recordActivity);
      globalThis.removeEventListener('keydown', recordActivity);
    };
  }, [gateway, hasCurrent]);

  const signIn = useCallback(
    async (tenant: string, user: string, password: string): Promise<SignInOutcome> => {
      const result = await gateway.signIn(tenant, user, password);
      if (result.type === 'ok') {
        setSession(result.session);
        setExpired(false);
      }
      return result;
    },
    [gateway],
  );

  const signOut = useCallback(() => {
    gateway.signOut();
    setSession(null);
    setExpired(false);
  }, [gateway]);

  const chooseProfile = useCallback(
    (system: SystemCode, profileId: string) => {
      const next = gateway.chooseProfile(system, profileId);
      if (next !== null) setSession(next);
    },
    [gateway],
  );

  const chooseSite = useCallback(
    (site: Site | null) => {
      const next = gateway.chooseSite(site);
      if (next !== null) setSession(next);
    },
    [gateway],
  );

  const value = useMemo<Suite>(
    () => ({ gateway, settings, session, expired, signIn, signOut, chooseProfile, chooseSite }),
    [gateway, settings, session, expired, signIn, signOut, chooseProfile, chooseSite],
  );
  return <Context value={value}>{children}</Context>;
}

export function useSuite(): Suite {
  const suite = use(Context);
  if (suite === null) throw new Error('useSuite requiere un SuiteProvider');
  return suite;
}

/** La sesión de una pantalla que solo existe con sesión (la guarda de rutas ya lo garantizó). */
export function useSuiteSession(): SuiteSession {
  const { session } = useSuite();
  if (session === null) throw new Error('Esta pantalla requiere una sesión de la suite');
  return session;
}
