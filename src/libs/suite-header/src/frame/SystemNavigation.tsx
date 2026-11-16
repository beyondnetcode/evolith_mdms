import { Icon, Tooltip, fabStyles, joinClasses, type IconName } from '@sil/ui';
import { isDestinationActive, type NavDestination, type PrimaryAction } from '@suite/contracts';
import { Link, useLocation, useNavigate } from 'react-router';
import { useLeaveGuard } from '../LeaveGuardContext.tsx';
import { FRAME_TEXTS } from './frame-texts.ts';

/** Destino del riel con un icono de `@sil/ui`. */
export type SystemDestination = NavDestination<IconName>;
/** Acción principal del riel con un icono de `@sil/ui`. */
export type SystemPrimaryAction = PrimaryAction<IconName>;

/**
 * Un destino del riel (UI-SIL-001 §4.2). Contraído: de 80 dp de ancho, con el indicador de 56 × 32 dp (`full`) en
 * `secondary-container` bajo el icono de 24 dp y la etiqueta debajo en `label-medium`; el seleccionado se distingue
 * por el indicador y por el color de la etiqueta, no solo por color. Expandido (riel de 224 dp, D-036): fila de 56 dp
 * como mínimo con forma `full`, y el texto en varias líneas si no cabe en una, para que «Servicios planificados» no se
 * corte en el riel más angosto.
 */
function destinationStyles(expanded: boolean, active: boolean): string {
  if (!expanded) return 'group flex w-20 cursor-pointer flex-col items-center gap-1 py-1 text-label-medium outline-offset-0';
  return joinClasses(
    'state-layer flex min-h-14 cursor-pointer items-center gap-3 rounded-full px-4 py-2 text-label-large',
    active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant',
  );
}

interface ContentProps {
  readonly expanded: boolean;
  readonly active: boolean;
  readonly icon: IconName;
  readonly label: string;
}

function DestinationContent({ expanded, active, icon, label }: ContentProps) {
  if (expanded) {
    return (
      <>
        <Icon name={icon} />
        {label}
      </>
    );
  }
  return (
    <>
      <span
        className={joinClasses(
          'state-layer flex h-8 w-14 items-center justify-center rounded-full',
          active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant',
        )}
      >
        <Icon name={icon} />
      </span>
      <span className={joinClasses('text-center', active ? 'text-on-surface' : 'text-on-surface-variant')}>{label}</span>
    </>
  );
}

/**
 * FAB de la acción principal arriba del riel. En el riel contraído de 96 dp es de solo icono: conserva el nombre
 * accesible y un tooltip (que aparece también con el foco del teclado).
 */
function PrimaryActionLink({ action, expanded, onNavigate }: { readonly action: SystemPrimaryAction; readonly expanded: boolean; readonly onNavigate: (() => void) | undefined }) {
  const link = (
    <Link
      to={action.path}
      {...(onNavigate === undefined ? {} : { onClick: onNavigate })}
      {...(expanded ? {} : { 'aria-label': action.label })}
      className={fabStyles(expanded ? 'mb-3 self-start' : 'mb-3 w-14 px-0')}
    >
      <Icon name={action.icon} />
      {expanded && action.label}
    </Link>
  );
  return expanded ? link : <Tooltip text={action.label}>{link}</Tooltip>;
}

export interface SystemNavigationProps {
  readonly systemName: string;
  readonly destinations: readonly SystemDestination[];
  readonly primaryAction?: SystemPrimaryAction | undefined;
  /** `expanded`: riel de 224 dp con FAB extendido (D-036); `collapsed`: riel de 96 dp con FAB de icono. */
  readonly variant: 'expanded' | 'collapsed';
  /** Se llama al elegir un destino o la acción (p. ej. para cerrar el cajón de `compact`). */
  readonly onNavigate?: () => void;
  /**
   * «Ir al portal» como destino: en el cajón de `compact`, donde la cabecera no lleva el conmutador de sistemas
   * (ADR-0245 D4.1, anexo A1 §4). Desde `medium` el conmutador está en la cabecera. Respeta la salida protegida.
   */
  readonly withPortal?: boolean;
}

/**
 * Navegación local de un sistema (ADR-0245 D4.1): el FAB de la acción principal, si la hay, y los destinos. El
 * destino activo lleva indicador `secondary-container` y `aria-current="page"`; no se comunica solo con color.
 */
export function SystemNavigation({ systemName, destinations, primaryAction, variant, onNavigate, withPortal = false }: SystemNavigationProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { request } = useLeaveGuard();
  const isExpanded = variant === 'expanded';

  return (
    <nav aria-label={FRAME_TEXTS.navigation(systemName)} className={joinClasses('flex flex-col gap-3', isExpanded ? 'p-2' : 'items-center py-3')}>
      {primaryAction !== undefined && <PrimaryActionLink action={primaryAction} expanded={isExpanded} onNavigate={onNavigate} />}
      <ul className={joinClasses('flex flex-col gap-1', !isExpanded && 'items-center')}>
        {destinations.map((destination) => {
          const active = isDestinationActive(destination, pathname);
          return (
            <li key={destination.path}>
              <Link
                to={destination.path}
                {...(active ? { 'aria-current': 'page' as const } : {})}
                {...(onNavigate === undefined ? {} : { onClick: onNavigate })}
                className={destinationStyles(isExpanded, active)}
              >
                <DestinationContent expanded={isExpanded} active={active} icon={destination.icon} label={destination.label} />
              </Link>
            </li>
          );
        })}
        {withPortal && (
          <li>
            <Link
              to="/"
              onClick={(event) => {
                event.preventDefault();
                onNavigate?.();
                request(() => void navigate('/'));
              }}
              className={destinationStyles(isExpanded, false)}
            >
              <DestinationContent expanded={isExpanded} active={false} icon="apps" label={FRAME_TEXTS.portal} />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
