import { MDM_ROLE_LABEL, type MdmGateway, type MdmRole } from '@mdm/contracts';
import { MdmMockStore } from '@mdm/mock';
import { SnackbarProvider } from '@sil/ui';
import { WIDTHS, setWidth } from '@sil/ui/testing';
import type { NetworkSettings, SuiteSession, SystemContext } from '@suite/contracts';
import { HeaderThemeContext, SuiteHeaderContext, type HeaderTheme, type SuiteHeader } from '@suite/header';
import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { MdmTestDataContext } from '../infrastructure/MockMdmGatewayProvider.tsx';
import MdmEntry from '../mdm-entry.tsx';
import { MDM_ROUTE_ROOTS } from '../presentation/mdm-roots.ts';

/*
 * ARNÉS DE PRUEBAS DE MDM: monta la entrada de MDM como lo haría el anfitrión, con un `SystemContext` de prueba
 * construido con los tipos del contrato (MDM no puede importar `@suite/mock`, D-026) y una cabecera común sin
 * notificaciones. Lo que cruza la frontera se prueba en el arnés de composición del anfitrión.
 */

/** Sesión de la suite con un único perfil de MDM en Callao. */
export function mdmTestSession(role: MdmRole = 'ANALISTA_DATOS_MAESTROS'): SuiteSession {
  const id = `prueba.${role.toLowerCase()}`;
  const profileId = `${id}:MDM:CALLAO`;
  return {
    version: 1,
    sessionId: `prueba-${id}`,
    user: { id, fullName: MDM_ROLE_LABEL[role], firstName: 'Persona', initials: 'PP' },
    tenant: { code: 'ORG', name: 'Organización S.A.' },
    issuedAt: '2026-10-24T08:00:00-05:00',
    expiresAt: '2026-10-24T16:00:00-05:00',
    profiles: [{ profileId, system: 'MDM', role, site: 'Callao' }],
    currentProfileBySystem: { MDM: profileId },
    currentSite: 'Callao',
  };
}

const TEST_SETTINGS: NetworkSettings = { latencyMs: 0, mode: 'normal', suite: { umsDown: false, maintenance: false, expires: false } };
const TEST_THEME: HeaderTheme = { effectiveTheme: 'light', themeSelector: null };

function testHeader(session: SuiteSession): SuiteHeader {
  return {
    user: session.user,
    signOut: () => undefined,
    notifications: {
      queryClient: new QueryClient(),
      queryRoot: ['prueba', 'notificaciones'],
      profile: null,
      unreadCount: 0,
      recent: [],
      list: () => Promise.resolve({ items: [], nextCursor: null, unread: 0 }),
      markRead: () => Promise.resolve({ type: 'ok', unread: 0 }),
      markAllRead: () => Promise.resolve({ type: 'ok', markedCount: 0, unread: 0 }),
      announce: () => undefined,
    },
  };
}

export interface MdmRenderOptions {
  readonly path?: string;
  readonly role?: MdmRole;
  readonly width?: number;
  readonly settings?: Partial<NetworkSettings>;
  readonly store?: MdmMockStore;
  /** Sustituye partes del gateway (p. ej. para forzar un fallo solo al listar). */
  readonly decorateGateway?: (base: MdmGateway) => MdmGateway;
}

function TestHost({ session, settings }: { readonly session: SuiteSession; readonly settings: NetworkSettings }) {
  const context = useMemo<SystemContext>(() => {
    const profile = session.profiles[0];
    if (profile === undefined) throw new Error('La sesión de prueba no concede MDM');
    // El anfitrión solo monta un sistema con un perfil que tiene sede de UMS (`GrantedProfile`, US-SIL-004).
    if (profile.site === null) throw new Error('El perfil de prueba de MDM no tiene sede');
    const currentProfile = { ...profile, site: profile.site };
    return { session, currentProfile, selectProfile: () => undefined, networkSettings: settings };
  }, [session, settings]);
  const header = useMemo(() => testHeader(session), [session]);
  return (
    <SuiteHeaderContext value={header}>
      <Routes>
        {MDM_ROUTE_ROOTS.map((root) => (
          <Route key={root} path={`${root}/*`} element={<MdmEntry context={context} />} />
        ))}
      </Routes>
    </SuiteHeaderContext>
  );
}

/** Monta MDM solo, con un almacén propio, sin latencia y con un perfil de prueba. */
export function renderMdm(options: MdmRenderOptions = {}) {
  setWidth(options.width ?? WIDTHS.expanded);
  const settings: NetworkSettings = { ...TEST_SETTINGS, ...options.settings };
  const store = options.store ?? new MdmMockStore();
  const user = userEvent.setup();
  const session = mdmTestSession(options.role);
  const result = render(
    <SnackbarProvider>
      <HeaderThemeContext value={TEST_THEME}>
        <MdmTestDataContext value={{ store, ...(options.decorateGateway === undefined ? {} : { decorateGateway: options.decorateGateway }) }}>
          <MemoryRouter initialEntries={[options.path ?? '/mdm/organizaciones']}>
            <TestHost session={session} settings={settings} />
          </MemoryRouter>
        </MdmTestDataContext>
      </HeaderThemeContext>
    </SnackbarProvider>,
  );
  return { ...result, user, store };
}
