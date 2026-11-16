import { SnackbarProvider } from '@sil/ui';
import { WIDTHS, setWidth } from '@sil/ui/testing';
import type { SuiteSession } from '@suite/contracts';
import { QueryClient } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HeaderThemeContext, type HeaderTheme } from '../HeaderThemeContext.tsx';
import { LeaveGuardContext, type LeaveGuard } from '../LeaveGuardContext.tsx';
import { SuiteHeaderContext, type SuiteHeader } from '../SuiteHeaderContext.tsx';
import { SystemFrame, type SystemFrameProps } from './SystemFrame.tsx';
import { useSystemFrame } from './SystemFrameContext.tsx';

const USER: SuiteSession['user'] = { id: 'rosa.medina', fullName: 'Rosa Medina', firstName: 'Rosa', initials: 'RM' };

const HEADER: SuiteHeader = {
  user: USER,
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

const THEME: HeaderTheme = { effectiveTheme: 'light', themeSelector: null };

const BASE: Omit<SystemFrameProps, 'children'> = {
  systemName: 'MDM',
  destinations: [
    { path: '/mdm/organizaciones', label: 'Organizaciones', icon: 'group' },
    { path: '/mdm/personas', label: 'Personas', icon: 'person', matchPrefixes: ['/mdm/contactos'] },
  ],
  primaryAction: { path: '/mdm/organizaciones/nueva', label: 'Nueva organización', icon: 'add' },
  signIn: { fullName: 'Rosa Medina', roleLabel: 'Analista de datos maestros', site: 'Callao' },
  notifications: false,
};

/** Pantalla de prueba: su título es la dirección actual. */
function Screen() {
  const { pathname } = useLocation();
  return <h1>{`Pantalla ${pathname}`}</h1>;
}

/** Pantalla que pinta su propia cabecera en la barra de `compact`. */
function WithCompactHeader() {
  const register = useSystemFrame()?.registerCompactHeader;
  useEffect(() => {
    register?.(true);
    return () => register?.(false);
  }, [register]);
  return <h1>Con cabecera propia</h1>;
}

interface Options {
  readonly width?: number;
  readonly path?: string;
  readonly props?: Partial<SystemFrameProps>;
  readonly guard?: LeaveGuard;
  readonly content?: ReactNode;
}

function renderFrame({ width = WIDTHS.expanded, path = '/mdm/organizaciones', props = {}, guard, content = <Screen /> }: Options = {}) {
  setWidth(width);
  const user = userEvent.setup();
  const frame = (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<h1>Portal</h1>} />
        <Route
          path="*"
          element={
            <SystemFrame {...BASE} {...props}>
              {content}
            </SystemFrame>
          }
        />
      </Routes>
    </MemoryRouter>
  );
  render(
    <SnackbarProvider>
      <SuiteHeaderContext value={HEADER}>
        <HeaderThemeContext value={THEME}>{guard === undefined ? frame : <LeaveGuardContext value={guard}>{frame}</LeaveGuardContext>}</HeaderThemeContext>
      </SuiteHeaderContext>
    </SnackbarProvider>,
  );
  return { user };
}

describe('SystemFrame: marco común de un sistema (ADR-0245 D4.1)', () => {
  it('expanded: riel permanente de 224 dp con el FAB extendido arriba y los destinos, sin botón de menú (D-036)', () => {
    renderFrame();
    const rail = screen.getByRole('navigation', { name: 'Navegación de MDM' });
    expect(rail.parentElement?.className).toContain('w-56');
    const links = within(rail).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Nueva organización', 'Organizaciones', 'Personas']);
    expect(links[0]).toHaveAttribute('href', '/mdm/organizaciones/nueva');
    expect(within(rail).getByRole('link', { name: 'Organizaciones' })).toHaveAttribute('aria-current', 'page');
    expect(within(rail).getByRole('link', { name: 'Personas' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('button', { name: /menú de navegación/ })).not.toBeInTheDocument();
    expect(screen.getByText('Suite')).toBeInTheDocument();
  });

  it('medium: riel contraído de 96 dp con el FAB de solo icono, que conserva el nombre accesible', () => {
    renderFrame({ width: WIDTHS.medium });
    const rail = screen.getByRole('navigation', { name: 'Navegación de MDM' });
    expect(rail.parentElement?.className).toContain('w-24');
    const fab = within(rail).getByRole('link', { name: 'Nueva organización' });
    expect(fab).not.toHaveTextContent('Nueva organización');
    expect(screen.queryByRole('button', { name: /menú de navegación/ })).not.toBeInTheDocument();
  });

  it('el destino está activo en sus subrutas y en sus `matchPrefixes`', () => {
    renderFrame({ path: '/mdm/organizaciones/nueva' });
    const rail = screen.getByRole('navigation', { name: 'Navegación de MDM' });
    expect(within(rail).getByRole('link', { name: 'Organizaciones' })).toHaveAttribute('aria-current', 'page');
  });

  it('las raíces declaradas en `matchPrefixes` también activan el destino', () => {
    renderFrame({ path: '/mdm/contactos/7' });
    const rail = screen.getByRole('navigation', { name: 'Navegación de MDM' });
    expect(within(rail).getByRole('link', { name: 'Personas' })).toHaveAttribute('aria-current', 'page');
    expect(within(rail).getByRole('link', { name: 'Organizaciones' })).not.toHaveAttribute('aria-current');
  });

  it('sin acción principal no hay FAB en ningún tamaño', () => {
    renderFrame({ props: { primaryAction: undefined } });
    expect(screen.queryByRole('link', { name: 'Nueva organización' })).not.toBeInTheDocument();
  });

  it('desde medium la cabecera sigue el orden de la suite: conmutador, marca, sistema, perfil, ayuda y cuenta, sobre surface-container', () => {
    renderFrame({ width: WIDTHS.medium });
    const header = screen.getByRole('banner');
    expect(header.className).toContain('bg-surface-container');
    expect(header.className).not.toMatch(/shadow/);
    expect(within(header).getByText('MDM')).toBeInTheDocument();
    expect(within(header).getByText('Rosa Medina · Analista de datos maestros · Callao')).toBeInTheDocument();
    const order = [...header.querySelectorAll('a, button')].map((control) => control.getAttribute('aria-label') ?? control.textContent);
    expect(order).toEqual(['Ir al portal', 'Suite, inicio', 'Ayuda', 'Cuenta de Rosa Medina']);
  });

  it('la campana de la suite aparece salvo que el sistema la apague', () => {
    renderFrame({ props: { notifications: true } });
    expect(screen.getByRole('button', { name: /Notificaciones/ })).toBeInTheDocument();
  });

  it('el menú de cuenta recibe los ítems del sistema antes de «Cerrar sesión»', async () => {
    const { user } = renderFrame({ props: { accountExtras: <p>Herramientas de prueba</p> } });
    await user.click(screen.getByRole('button', { name: 'Cuenta de Rosa Medina' }));
    expect(screen.getByText('Herramientas de prueba')).toBeInTheDocument();
    const signOut = screen.getByRole('button', { name: 'Cerrar sesión' });
    expect(signOut.parentElement?.lastElementChild).toBe(signOut);
  });

  describe('compact', () => {
    it('sin riel visible: botón de menú, y el FAB flotante solo en la pantalla de primer nivel (R-18)', () => {
      renderFrame({ width: WIDTHS.compact });
      expect(screen.getByRole('button', { name: 'Abrir menú de navegación' })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('navigation', { name: 'Navegación de MDM' })).not.toBeInTheDocument();
      const fab = screen.getByRole('link', { name: 'Nueva organización' });
      expect(fab.className).toContain('fixed');
      expect(fab).toHaveTextContent('Nueva organización');
    });

    it('fuera de la pantalla de primer nivel no hay FAB flotante; el sistema puede elegir dónde', () => {
      renderFrame({ width: WIDTHS.compact, path: '/mdm/organizaciones/7' });
      expect(screen.queryByRole('link', { name: 'Nueva organización' })).not.toBeInTheDocument();
    });

    it('el sistema decide dónde va el FAB flotante y qué pantallas cubren la barra', () => {
      renderFrame({ width: WIDTHS.compact, path: '/mdm/organizaciones/7', props: { showCompactFab: () => true, hidesBarInCompact: (path) => path.endsWith('/7') } });
      expect(screen.getByRole('link', { name: 'Nueva organización' })).toBeInTheDocument();
      expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    });

    it('el cajón abre con los destinos, el FAB y «Ir al portal», y se cierra al elegir un destino', async () => {
      const { user } = renderFrame({ width: WIDTHS.compact });
      await user.click(screen.getByRole('button', { name: 'Abrir menú de navegación' }));
      const drawer = screen.getByRole('dialog', { name: 'Navegación de MDM' });
      const nav = within(drawer).getByRole('navigation', { name: 'Navegación de MDM' });
      expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Nueva organización', 'Organizaciones', 'Personas', 'Ir al portal']);
      await user.click(within(nav).getByRole('link', { name: 'Personas' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Pantalla /mdm/personas' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Navegación de MDM' })).not.toBeInTheDocument();
    });

    it('rol y sede van en el menú de cuenta', async () => {
      const { user } = renderFrame({ width: WIDTHS.compact });
      await user.click(screen.getByRole('button', { name: 'Cuenta de Rosa Medina' }));
      expect(screen.getByText('Rol:').parentElement).toHaveTextContent('Rol:Analista de datos maestros');
      expect(screen.getByText('Sede:').parentElement).toHaveTextContent('Sede:Callao');
    });

    it('una pantalla que registra su cabecera sustituye al menú y al nombre del sistema', () => {
      renderFrame({ width: WIDTHS.compact, content: <WithCompactHeader /> });
      expect(screen.queryByRole('button', { name: 'Abrir menú de navegación' })).not.toBeInTheDocument();
      expect(within(screen.getByRole('banner')).queryByText('MDM')).not.toBeInTheDocument();
    });

    describe('UI-04 y R-18 al desplazar', () => {
      afterEach(() => vi.unstubAllGlobals());

      it('la barra pasa a surface-container y el FAB se contrae a icono sin cambiar su nombre accesible', () => {
        let notify: ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined;
        class FakeObserver {
          constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
            notify = callback;
          }
          observe = vi.fn();
          disconnect = vi.fn();
        }
        vi.stubGlobal('IntersectionObserver', FakeObserver);
        renderFrame({ width: WIDTHS.compact });
        const bar = screen.getByRole('banner');
        expect(bar).not.toHaveAttribute('data-scrolled');
        act(() => notify?.([{ isIntersecting: false }]));
        expect(bar).toHaveAttribute('data-scrolled');
        const fab = screen.getByRole('link', { name: 'Nueva organización' });
        expect(fab.querySelector('.sr-only')).toHaveTextContent('Nueva organización');
      });
    });
  });

  it('el primer foco es el salto al contenido, que apunta a `<main>` enfocable por programa (WCAG 2.4.1)', async () => {
    const { user } = renderFrame();
    await user.tab();
    const skip = screen.getByRole('link', { name: 'Ir al contenido principal' });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute('href', '#contenido');
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'contenido');
    expect(main).toHaveAttribute('tabindex', '-1');
  });

  it('al cambiar de pantalla desde el riel el foco pasa a `<main>`', async () => {
    const { user } = renderFrame();
    await user.click(within(screen.getByRole('navigation', { name: 'Navegación de MDM' })).getByRole('link', { name: 'Personas' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Pantalla /mdm/personas' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('la clave de pantalla del sistema evita robar el foco al cambiar solo de pestaña', async () => {
    const { user } = renderFrame({ path: '/mdm/personas/1', props: { screenKey: (path) => path.split('/').slice(0, 3).join('/') } });
    const rail = screen.getByRole('navigation', { name: 'Navegación de MDM' });
    await user.click(within(rail).getByRole('link', { name: 'Personas' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Pantalla /mdm/personas' })).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveFocus();
  });

  it('salir al portal (conmutador o marca) pasa por la salida protegida del sistema', async () => {
    const request = vi.fn<LeaveGuard['request']>();
    const { user } = renderFrame({ guard: { request } });
    await user.click(screen.getByRole('link', { name: 'Ir al portal' }));
    await user.click(screen.getByRole('link', { name: 'Suite, inicio' }));
    expect(request).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('heading', { name: 'Portal' })).not.toBeInTheDocument();
    act(() => request.mock.calls[0]?.[0]());
    expect(screen.getByRole('heading', { name: 'Portal' })).toBeInTheDocument();
  });
});
