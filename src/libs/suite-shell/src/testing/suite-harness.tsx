import { WIDTHS, setWidth } from '@sil/ui/testing';
import { profileLabel, type NetworkSettings, type Site, type SuiteGateway, type SuiteSession, type SystemEntryProps, type SystemModule } from '@suite/contracts';
import { MOCK_SESSION_KEY, createTestSession } from '@suite/mock';
import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { SuiteFrame } from '../presentation/layout/SuiteFrame.tsx';
import { NotFoundPage } from '../presentation/pages/NotFoundPage.tsx';
import { NotificationsPage } from '../presentation/pages/NotificationsPage.tsx';
import { SignInPage } from '../presentation/pages/SignInPage.tsx';
import { SuiteHomePage } from '../presentation/pages/SuiteHomePage.tsx';
import { RequireSession, SuiteLayout } from '../presentation/routing/RequireSession.tsx';
import { SystemRoute } from '../presentation/routing/SystemRoute.tsx';
import { SuiteProviders } from '../suite-providers.tsx';

/*
 * ARNÉS DE PRUEBAS DE LA SUITE: la suite sola, sin montar MDM. Registra un sistema de prueba con la sigla
 * y los roles de MDM cuya entrada solo dice qué recibió: así se prueban el lanzador, las guardas y el paso
 * de perfil. Lo que cruza la frontera de verdad se prueba en el arnés de composición del anfitrión.
 */

const ROLE_LABELS: Readonly<Record<string, string>> = {
  ANALISTA_DATOS_MAESTROS: 'Analista de datos maestros',
  CONSULTOR: 'Consultor',
};

function TestEntry({ context }: SystemEntryProps) {
  return (
    <SuiteFrame withAccount>
      <h1>Sistema de prueba</h1>
      <p>Perfil vigente: {profileLabel(context.currentProfile, [TEST_SYSTEM])}</p>
    </SuiteFrame>
  );
}

/** Un sistema de prueba con la sigla, la raíz y los roles de MDM. */
export const TEST_SYSTEM: SystemModule = {
  code: 'MDM',
  roleLabel: (role) => ROLE_LABELS[role] ?? null,
  otherRoleLabel: () => null,
  routeRoots: ['mdm'],
  Entry: TestEntry,
};

export interface SuiteRenderOptions {
  readonly path?: string;
  /** Rol de SIL de la sesión sembrada (sede Callao). */
  readonly role?: string;
  readonly site?: Site;
  /** Usuario de prueba del catálogo del mock (`carlos.vega`): sustituye a `role` y `site`. */
  readonly user?: string;
  /** `profileId` de SIL con el que abre la sesión sembrada. */
  readonly currentSilProfile?: string;
  /** Una sesión ya construida, o `null` para probar sin sesión. */
  readonly session?: SuiteSession | null;
  readonly width?: number;
  /** Claves de `localStorage` ya guardadas (tema, lecturas de notificaciones); se limpia antes de cada prueba. */
  readonly localStorageSeed?: Readonly<Record<string, string>>;
  readonly settings?: Partial<NetworkSettings>;
  /** Sustituye partes del gateway de la suite (p. ej. una lista larga de notificaciones). */
  readonly decorateSuiteGateway?: (base: SuiteGateway) => SuiteGateway;
}

/** Siembra la sesión de la suite en `sessionStorage`, como si ya se hubiera iniciado sesión (anexo A1 §7.5). */
export function seedSuiteSession(options: Pick<SuiteRenderOptions, 'role' | 'site' | 'user' | 'currentSilProfile' | 'session'> = {}): SuiteSession | null {
  globalThis.sessionStorage.clear();
  const session =
    options.session === undefined
      ? createTestSession({
          ...(options.user === undefined ? { role: options.role ?? 'CUSTOMER_SERVICE', ...(options.site === undefined ? {} : { site: options.site }) } : { user: options.user }),
          ...(options.currentSilProfile === undefined ? {} : { currentSilProfile: options.currentSilProfile }),
        })
      : options.session;
  if (session !== null) globalThis.sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(session));
  return session;
}

/** Monta la suite sola, sin latencia y con una sesión sembrada (por defecto, en S-02). */
export function renderSuite(options: SuiteRenderOptions = {}) {
  setWidth(options.width ?? WIDTHS.expanded);
  seedSuiteSession(options);
  globalThis.localStorage.clear();
  for (const [key, value] of Object.entries(options.localStorageSeed ?? {})) globalThis.localStorage.setItem(key, value);
  document.documentElement.removeAttribute('data-theme');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const settings: NetworkSettings = { latencyMs: 0, mode: 'normal', suite: { umsDown: false, maintenance: false, expires: false }, ...options.settings };
  const user = userEvent.setup();
  const result = render(
    <SuiteProviders
      settings={settings}
      systems={[TEST_SYSTEM]}
      testing={{ queryClient, ...(options.decorateSuiteGateway === undefined ? {} : { decorateGateway: options.decorateSuiteGateway }) }}
    >
      <MemoryRouter initialEntries={[options.path ?? '/']}>
        <Routes>
          <Route path="acceso" element={<SignInPage />} />
          <Route element={<RequireSession />}>
            <Route element={<SuiteLayout />}>
              <Route index element={<SuiteHomePage />} />
            </Route>
            <Route path="notificaciones" element={<NotificationsPage />} />
            {TEST_SYSTEM.routeRoots.map((root) => (
              <Route key={root} path={`${root}/*`} element={<SystemRoute module={TEST_SYSTEM} />} />
            ))}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SuiteProviders>,
  );
  return { ...result, user };
}
