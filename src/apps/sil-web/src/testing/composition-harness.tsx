import { MdmTestDataContext } from '@mdm/app/testing';
import { MdmMockStore } from '@mdm/mock';
import { WIDTHS, setWidth } from '@sil/ui/testing';
import { MOCK_SESSION_KEY, createTestSession } from '@suite/mock';
import { type SuiteSession, type Site, type SuiteGateway, type NetworkSettings } from '@suite/contracts';
import { SuiteProviders } from '@suite/shell';
import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../app/AppRoutes.tsx';
import { SYSTEM_REGISTRY } from '../system-registry.ts';

export { WIDTHS, setSystemScheme, setWidth } from '@sil/ui/testing';

interface Options {
  readonly path?: string;
  /** Rol de la sesión sembrada (sede Callao, la de los datos de ejemplo). */
  readonly role?: string;
  readonly site?: Site | null;
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
  /** Almacén del mock de MDM; por defecto, uno nuevo por prueba. */
  readonly mdmStore?: MdmMockStore;
  /** Sustituye partes del gateway de la suite (p. ej. una lista larga de notificaciones). */
  readonly decorateSuiteGateway?: (base: SuiteGateway) => SuiteGateway;
}

/**
 * ARNÉS DE COMPOSICIÓN: el anfitrión completo (suite + MDM montado por el registro) para las pruebas que
 * cruzan la frontera. Las de un solo lado usan el arnés de su librería.
 */

/**
 * AYUDANTE DE PRUEBAS: siembra la sesión de la suite en `sessionStorage`, como si ya se hubiera
 * iniciado sesión, sin pasar por S-01. Sustituye al antiguo simulador de perfil.
 */
export function seedSession(options: Pick<Options, 'role' | 'site' | 'user' | 'currentSilProfile' | 'session'> = {}): SuiteSession | null {
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

/** Monta la aplicación completa con un almacén propio, sin latencia y con una sesión de la suite sembrada. */
export function renderApp(element: ReactElement | null = null, options: Options = {}) {
  setWidth(options.width ?? WIDTHS.expanded);
  seedSession(options);
  // La preferencia de tema y las lecturas de notificaciones viven en `localStorage`: cada prueba parte limpia.
  globalThis.localStorage.clear();
  for (const [key, value] of Object.entries(options.localStorageSeed ?? {})) globalThis.localStorage.setItem(key, value);
  document.documentElement.removeAttribute('data-theme');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const settings: NetworkSettings = {
    latencyMs: 0,
    mode: 'normal',
    suite: { umsDown: false, maintenance: false, expires: false },
    ...options.settings,
  };
  const user = userEvent.setup();
  const result = render(
    <SuiteProviders
      settings={settings}
      systems={SYSTEM_REGISTRY}
      testing={{ queryClient, ...(options.decorateSuiteGateway === undefined ? {} : { decorateGateway: options.decorateSuiteGateway }) }}
    >
      <MdmTestDataContext value={{ store: options.mdmStore ?? new MdmMockStore() }}>
        <MemoryRouter initialEntries={[options.path ?? '/']}>{element ?? <AppRoutes />}</MemoryRouter>
      </MdmTestDataContext>
    </SuiteProviders>,
  );
  return { ...result, user };
}
