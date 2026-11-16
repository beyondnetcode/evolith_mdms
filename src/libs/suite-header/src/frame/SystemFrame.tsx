import { Icon, IconButton, ModalDialog, Tooltip, fabStyles, iconButtonStyles, joinClasses, useScrolled, useWindowSizeClass } from '@sil/ui';
import { isDesktop } from '@sil/ui-tokens';
import { isDestinationRoot } from '@suite/contracts';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavigationType, useLocation, useNavigate, useNavigationType } from 'react-router';
import { AccountMenu } from '../AccountMenu.tsx';
import { HelpButton } from '../HelpButton.tsx';
import { useLeaveGuard } from '../LeaveGuardContext.tsx';
import { BrandLink } from '../brand/BrandLink.tsx';
import { HEADER_TEXTS } from '../header-texts.ts';
import { NotificationsButton } from '../notifications/NotificationsButton.tsx';
import { SystemFrameContext, type SystemFrameControls } from './SystemFrameContext.tsx';
import { SystemNavigation, type SystemDestination, type SystemPrimaryAction } from './SystemNavigation.tsx';
import { FRAME_TEXTS } from './frame-texts.ts';

/** Datos de ingreso que la cabecera muestra como texto (US-SIL-004 escenario 6): la sede viene de UMS, sin cambiarla. */
export interface SignInDetails {
  readonly fullName: string;
  readonly roleLabel: string;
  readonly site: string;
}

export interface SystemFrameProps {
  /** Código corto del sistema montado («SIL», «MDM»): título de la barra y nombre de la navegación. */
  readonly systemName: string;
  readonly destinations: readonly SystemDestination[];
  /** Acción principal (FAB). Quien llama la omite si el perfil no puede ejecutarla. */
  readonly primaryAction?: SystemPrimaryAction | undefined;
  /** Nombre, rol y sede de ingreso: en la barra desde `medium` y en el menú de cuenta en `compact`. */
  readonly signIn?: SignInDetails | undefined;
  /** Ítems que el sistema añade al menú de cuenta antes de «Cerrar sesión» (p. ej. herramientas del prototipo, R-11). */
  readonly accountExtras?: ReactNode;
  /** Muestra la campana de la suite (por omisión, sí). */
  readonly notifications?: boolean;
  /** Pie del contenido, dentro de `<main>`. */
  readonly footer?: ReactNode;
  /**
   * Dónde aparece el FAB flotante de `compact`. Por omisión, en las pantallas de primer nivel (la dirección exacta de
   * un destino).
   */
  readonly showCompactFab?: (pathname: string) => boolean;
  /** Pantallas que en `compact` son un diálogo de pantalla completa con su propia barra: el marco no pinta la suya. */
  readonly hidesBarInCompact?: (pathname: string) => boolean;
  /**
   * Clave de pantalla: el foco pasa a `<main>` cuando cambia. Por omisión, la dirección completa; un sistema con
   * pestañas en la dirección la recorta para no robar el foco al cambiar de pestaña.
   */
  readonly screenKey?: (pathname: string) => string;
  readonly children: ReactNode;
}

const RAIL_ID = 'riel-navegacion';
const NEVER = (): boolean => false;
const WHOLE_PATH = (pathname: string): string => pathname;

/** Al cambiar de pantalla el foco pasa al contenido: en una SPA se quedaría en el enlace de la pantalla anterior. */
function useFocusOnScreenChange(key: string) {
  const navigationType = useNavigationType();
  const main = useRef<HTMLElement>(null);
  const first = useRef(navigationType === NavigationType.Pop);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    main.current?.focus({ preventScroll: true });
  }, [key]);
  return main;
}

/**
 * Marco común de un sistema de la suite (ADR-0245 D4.1, ADR-0110 §2.7, D-021, D-036): la cabecera común y la
 * navegación local que aporta cada sistema, adaptadas a la clase de tamaño de ventana de M3:
 * - `expanded` o mayor: cabecera de la suite + riel expandido PERMANENTE de 224 dp con el FAB extendido;
 * - `medium`: cabecera de la suite + riel contraído PERMANENTE de 96 dp con el FAB de icono;
 * - `compact`: barra con el menú, la marca y el sistema (o la cabecera de la pantalla); el riel abre como cajón
 *   modal (`<dialog>`: el resto queda inerte y el foco atrapado) y el FAB extendido va abajo a la derecha y se
 *   contrae a icono al desplazar (R-18). La barra pasa de `surface` a `surface-container` al desplazar (UI-04).
 * La barra de navegación inferior no se usa: M3 la reserva para tres a cinco destinos. El primer foco es el enlace
 * para saltar al contenido (WCAG 2.4.1).
 */
export function SystemFrame(props: SystemFrameProps) {
  const { systemName, destinations, primaryAction, footer, children } = props;
  const sizeClass = useWindowSizeClass();
  const compact = sizeClass === 'compact';
  const desktop = isDesktop(sizeClass);
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [pageHeader, setPageHeader] = useState(false);
  const { scrolled, sentinel } = useScrolled();
  const main = useFocusOnScreenChange((props.screenKey ?? WHOLE_PATH)(pathname));
  const hidesBar = compact && (props.hidesBarInCompact ?? NEVER)(pathname);
  const showFab = compact && primaryAction !== undefined && (props.showCompactFab ?? ((path: string) => isDestinationRoot(destinations, path)))(pathname);

  const controls = useMemo<SystemFrameControls>(
    () => ({ compactSlot: slot, registerCompactHeader: setPageHeader, openMenu: () => setMenuOpen(true) }),
    [slot],
  );

  return (
    <SystemFrameContext value={controls}>
      <div className="relative min-h-dvh bg-surface text-on-surface">
        <div ref={sentinel} aria-hidden="true" className="pointer-events-none absolute top-0 left-0 h-px w-px" />
        <a
          href="#contenido"
          className="sr-only z-50 rounded-full bg-primary px-4 py-2 text-label-large text-on-primary focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          {HEADER_TEXTS.skipLink}
        </a>

        {!hidesBar && (
          <TopBar
            {...props}
            compact={compact}
            withPageHeader={pageHeader}
            onSlot={setSlot}
            onMenu={() => setMenuOpen(true)}
            menuOpen={menuOpen}
            scrolled={scrolled}
          />
        )}

        <div className="flex items-start">
          {!compact && (
            <div id={RAIL_ID} className={joinClasses('sticky top-16 shrink-0', desktop ? 'w-56' : 'w-24')}>
              <SystemNavigation systemName={systemName} destinations={destinations} primaryAction={primaryAction} variant={desktop ? 'expanded' : 'collapsed'} />
            </div>
          )}
          <main ref={main} id="contenido" tabIndex={-1} className="min-w-0 flex-1 px-4 pt-2 pb-24 outline-none medium:px-6 expanded:pb-6">
            {children}
            {footer !== undefined && <footer className="mt-10 text-body-small text-on-surface-variant">{footer}</footer>}
          </main>
        </div>

        {compact && (
          <ModalDialog variant="rail" title={FRAME_TEXTS.navigation(systemName)} open={menuOpen} onClose={() => setMenuOpen(false)}>
            <IconButton aria-label={FRAME_TEXTS.closeMenu} onClick={() => setMenuOpen(false)} className="mb-1">
              <Icon name="close" />
            </IconButton>
            <SystemNavigation
              systemName={systemName}
              destinations={destinations}
              primaryAction={primaryAction}
              variant="expanded"
              withPortal
              onNavigate={() => setMenuOpen(false)}
            />
          </ModalDialog>
        )}

        {showFab && <CompactFab action={primaryAction} scrolled={scrolled} />}
      </div>
    </SystemFrameContext>
  );
}

/** R-18: el FAB extendido de `compact` se contrae a icono al desplazar; el nombre accesible no cambia. */
function CompactFab({ action, scrolled }: { readonly action: SystemPrimaryAction; readonly scrolled: boolean }) {
  return (
    <Link to={action.path} className={fabStyles(joinClasses('fixed right-4 bottom-4 z-30', scrolled && 'w-14 px-0'))}>
      <Icon name={action.icon} />
      <span className={scrolled ? 'sr-only' : undefined}>{action.label}</span>
    </Link>
  );
}

/** Marca de la barra (anexo A1 §11.6, M-05): isotipo + «Suite» desde `medium`, separador y el sistema. */
function BarBrand({ withText, systemName }: { readonly withText: boolean; readonly systemName: string }) {
  const navigate = useNavigate();
  const { request } = useLeaveGuard();
  return (
    <>
      <BrandLink
        withText={withText}
        onClick={(event) => {
          event.preventDefault();
          request(() => void navigate('/'));
        }}
      />
      {withText && <span aria-hidden="true" className="mx-2 h-6 border-s border-outline-variant" />}
      <span className="text-title-large">{systemName}</span>
    </>
  );
}

/** «Cambiar de sistema» en su forma degradada (anexo A1 §4, D4.5, G-520): un enlace que lleva a S-02. */
function PortalLink() {
  const navigate = useNavigate();
  const { request } = useLeaveGuard();
  return (
    <Tooltip text={FRAME_TEXTS.portal}>
      <Link
        to="/"
        aria-label={FRAME_TEXTS.portal}
        onClick={(event) => {
          event.preventDefault();
          request(() => void navigate('/'));
        }}
        className={iconButtonStyles()}
      >
        <Icon name="apps" />
      </Link>
    </Tooltip>
  );
}

/** Nombre, rol y sede como texto desde `medium`. */
function SignInIndicator({ signIn }: { readonly signIn: SignInDetails }) {
  return (
    <span className="hidden max-w-md truncate px-3 text-label-large text-on-surface-variant medium:inline">
      {`${signIn.fullName} · ${signIn.roleLabel} · ${signIn.site}`}
    </span>
  );
}

/** Rol y sede en el menú de cuenta, que ya muestra el nombre; solo en `compact`, donde no caben en la barra. */
function SignInInAccount({ signIn }: { readonly signIn: SignInDetails }) {
  return (
    <dl className="px-4 pb-2 text-body-small text-on-surface-variant medium:hidden">
      <div className="flex gap-1">
        <dt>{FRAME_TEXTS.role}</dt>
        <dd>{signIn.roleLabel}</dd>
      </div>
      <div className="flex gap-1">
        <dt>{FRAME_TEXTS.site}</dt>
        <dd>{signIn.site}</dd>
      </div>
    </dl>
  );
}

interface BarProps extends SystemFrameProps {
  readonly compact: boolean;
  /** La pantalla pinta su cabecera dentro de la barra (compact): el marco no repite el sistema ni el botón de menú. */
  readonly withPageHeader: boolean;
  readonly menuOpen: boolean;
  readonly scrolled: boolean;
  readonly onSlot: (node: HTMLElement | null) => void;
  readonly onMenu: () => void;
}

/**
 * Top app bar small de 64 dp. Desde `medium` es la cabecera de la suite (ADR-0245 D4.1), en este orden fijo:
 * conmutador de sistemas, marca, sistema actual, perfil y sede, [campana], ayuda y menú de usuario, sobre
 * `surface-container` y sin sombra. En `compact` sus extremos los pinta la pantalla si se registra (menú o «Volver»,
 * título y acciones) y la barra conserva «Ayuda» y la cuenta (WCAG 3.2.6); el conmutador va entonces en el cajón.
 * En `compact` el fondo cambia con el desplazamiento en 200 ms (UI-04); con movimiento reducido es instantáneo.
 */
function TopBar({ systemName, signIn, accountExtras, notifications = true, compact, withPageHeader, menuOpen, scrolled, onSlot, onMenu }: BarProps) {
  const showBrand = !(compact && withPageHeader);
  return (
    <header
      data-scrolled={compact && scrolled ? '' : undefined}
      className={joinClasses(
        'sticky top-0 z-30 flex h-16 items-center gap-1 px-4',
        compact
          ? 'bg-surface transition-colors duration-(--md-sys-motion-duration-short4) ease-standard data-scrolled:bg-surface-container'
          : 'bg-surface-container',
      )}
    >
      {compact && showBrand && (
        <IconButton aria-label={FRAME_TEXTS.openMenu} aria-expanded={menuOpen} onClick={onMenu}>
          <Icon name="menu" />
        </IconButton>
      )}
      {!compact && <PortalLink />}
      {showBrand && <BarBrand withText={!compact} systemName={systemName} />}
      <div ref={onSlot} className={compact && withPageHeader ? 'flex min-w-0 flex-1 items-center gap-1' : 'hidden'} />
      {showBrand && <div className="flex-1" />}
      <BarActions signIn={signIn} accountExtras={accountExtras} notifications={notifications} />
    </header>
  );
}

/** Extremo derecho de la barra: perfil y sede, [campana], ayuda y la cuenta, siempre al final. */
function BarActions({ signIn, accountExtras, notifications }: Pick<SystemFrameProps, 'signIn' | 'accountExtras'> & { readonly notifications: boolean }) {
  return (
    <>
      {signIn !== undefined && <SignInIndicator signIn={signIn} />}
      {notifications && <NotificationsButton />}
      <HelpButton />
      <AccountMenu {...(accountExtras === undefined || accountExtras === null ? {} : { prototypeTools: accountExtras })}>
        {signIn !== undefined && <SignInInAccount signIn={signIn} />}
      </AccountMenu>
    </>
  );
}
