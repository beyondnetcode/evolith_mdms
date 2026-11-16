/* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role -- patrón de menú del APG: ul con role menu y li con role none; no hay elemento nativo equivalente */
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Button, IconButton } from './Button.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { joinClasses } from './join-classes.ts';
import { useDisclosure } from './use-disclosure.ts';

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
  /** `casilla`: elemento de selección múltiple (menú «Columnas»); no cierra el menú al elegirlo. */
  readonly type?: 'action' | 'checkbox';
  readonly checked?: boolean;
  readonly disabled?: boolean;
  /** Un elemento deshabilitado siempre dice por qué (UX-SIL-001 §3.6). */
  readonly reason?: string;
  /** Segunda línea del elemento (p. ej. el perfil de un usuario de prueba); se anuncia como descripción, no como nombre. */
  readonly description?: string;
}

interface ActionMenuProps {
  /** Nombre accesible del botón de icono que lo abre: «Más acciones». */
  readonly label: string;
  readonly icon?: IconName;
  readonly items: readonly MenuItem[];
  /** Nombre del menú, si difiere del del botón: «Columnas». */
  readonly menuLabel?: string;
  /**
   * Texto visible: el disparador pasa a botón de texto de M3 con el icono delante («Exportar»). Sin él, es
   * un botón de icono con su tooltip.
   */
  readonly text?: string;
  /** Hay una acción en curso: el disparador no abre el menú y lo anuncia (`aria-busy`). */
  readonly busy?: boolean;
  readonly className?: string;
  /**
   * Abre el menú con un botón delineado de texto en lugar de un botón de icono (divulgación progresiva, p. ej.
   * «Usuarios de prueba»). Entonces `label` es el nombre del menú y el texto del botón es `triggerText`; el menú
   * se alinea al inicio del botón.
   */
  readonly triggerText?: string;
}

interface MenuTriggerProps {
  readonly pin: (node: HTMLButtonElement | null) => void;
  readonly label: string;
  readonly icon: IconName;
  readonly text: string | undefined;
  readonly triggerText: string | undefined;
  readonly busy: boolean;
  readonly open: boolean;
  readonly panelId: string;
  readonly onToggle: () => void;
}

/**
 * El botón que abre el menú: de icono (con tooltip); con `text`, de texto de M3 con el icono delante; con
 * `triggerText`, delineado con el texto y la flecha de despliegue detrás.
 */
function MenuTrigger({ pin, label, icon, text, triggerText, busy, open, panelId, onToggle }: MenuTriggerProps) {
  const common = {
    ref: pin,
    'aria-haspopup': 'menu' as const,
    'aria-expanded': open,
    'aria-controls': open ? panelId : undefined,
    'aria-busy': busy || undefined,
    'aria-disabled': busy || undefined,
    onClick: busy ? undefined : onToggle,
  };
  if (triggerText !== undefined) {
    // Divulgación progresiva («Usuarios de prueba»): botón delineado; su nombre es el texto visible.
    return (
      <Button variant="outlined" className="pr-4 pl-6" {...common}>
        {triggerText}
        <Icon name="expand_more" className="size-4.5" />
      </Button>
    );
  }
  if (text === undefined) {
    return (
      <IconButton aria-label={label} {...common}>
        <Icon name={icon} />
      </IconButton>
    );
  }
  // Botón de texto de M3 con icono delante (12 dp a la izquierda, 16 dp a la derecha): su nombre es el texto.
  return (
    <Button aria-label={label === text ? undefined : label} className="pr-4 pl-3" {...common}>
      <Icon name={icon} className="size-4.5" />
      {text}
    </Button>
  );
}

/**
 * Menú de M3 abierto desde un botón de icono (forma `extra-small`, elementos de 48 dp, elevación 2).
 * Patrón de menú del APG: el foco entra en el primer elemento; las flechas, Inicio y Fin se mueven;
 * `Escape` cierra y devuelve el foco al botón; `Tab` recorre sus elementos sin salir (P-UX-08). Si ningún elemento está disponible,
 * no hay menú que mostrar.
 */
export function ActionMenu({ label, icon = 'more_vert', items, menuLabel, text, busy = false, className, triggerText }: ActionMenuProps) {
  const { open, toggle, close, pinContainer, pinButton, panelId, onKeyDown } = useDisclosure();
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])')?.focus();
  }, [open]);

  function move(event: KeyboardEvent<HTMLUListElement>): void {
    const assets = [...(list.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? [])];
    const index = assets.findIndex((element) => element === document.activeElement);
    const destination: Record<string, number> = {
      ArrowDown: (index + 1) % assets.length,
      ArrowUp: (index - 1 + assets.length) % assets.length,
      Home: 0,
      End: assets.length - 1,
    };
    const next = destination[event.key];
    if (next !== undefined) {
      event.preventDefault();
      assets[next]?.focus();
    } else if (event.key === 'Tab') {
      // El foco no sale del menú (ADR-0110 P-UX-08): `Tab` y `Mayús+Tab` recorren sus elementos en círculo.
      event.preventDefault();
      assets[(index + (event.shiftKey ? -1 : 1) + assets.length) % assets.length]?.focus();
    }
  }

  if (items.length === 0) return null;

  return (
    <div ref={pinContainer} role="presentation" className={joinClasses('relative', className)} onKeyDown={onKeyDown}>
      <MenuTrigger
        pin={pinButton}
        label={label}
        icon={icon}
        text={text}
        triggerText={triggerText}
        busy={busy}
        open={open}
        panelId={panelId}
        onToggle={toggle}
      />
      {open && (
        // El teclado se resuelve en cada elemento del menú; este manejador solo mueve el foco entre ellos.
        <ul
          ref={list}
          id={panelId}
          role="menu"
          aria-label={menuLabel ?? label}
          onKeyDown={move}
          className={joinClasses(
            'absolute top-full z-40 mt-1 min-w-56 rounded-xs bg-surface-container py-2 shadow-level-2',
            triggerText === undefined ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => {
            const checkbox = item.type === 'checkbox';
            const disabled = item.disabled === true;
            return (
              <li key={item.id} role="none">
                <button
                  type="button"
                  role={checkbox ? 'menuitemcheckbox' : 'menuitem'}
                  aria-checked={checkbox ? item.checked === true : undefined}
                  aria-disabled={disabled ? true : undefined}
                  aria-labelledby={item.description === undefined ? undefined : `${panelId}-${item.id}-nombre`}
                  aria-describedby={describedBy(panelId, item, disabled)}
                  tabIndex={-1}
                  onClick={() => {
                    if (disabled) return;
                    item.onSelect();
                    if (!checkbox) close();
                  }}
                  className="state-layer flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 text-left text-label-large text-on-surface aria-disabled:cursor-not-allowed aria-disabled:text-on-surface/38"
                >
                  {checkbox && <span className="flex size-5 items-center justify-center">{item.checked === true && <Icon name="check" className="size-5" />}</span>}
                  <span className="flex flex-col">
                    <span id={`${panelId}-${item.id}-nombre`}>{item.label}</span>
                    {item.description !== undefined && (
                      <span id={`${panelId}-${item.id}-descripcion`} className="text-body-small text-on-surface-variant">
                        {item.description}
                      </span>
                    )}
                    {disabled && item.reason !== undefined && (
                      <span id={`${panelId}-${item.id}-razon`} className="text-body-small text-on-surface-variant">
                        {item.reason}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Descripción y razón de un elemento, en `aria-describedby`. */
function describedBy(panelId: string, item: MenuItem, disabled: boolean): string | undefined {
  const ids = [
    item.description === undefined ? null : `${panelId}-${item.id}-descripcion`,
    disabled && item.reason !== undefined ? `${panelId}-${item.id}-razon` : null,
  ].filter((id) => id !== null);
  return ids.length === 0 ? undefined : ids.join(' ');
}

interface SelectionMenuProps<T extends string | number> {
  /** Nombre accesible del botón: «Filas por página». */
  readonly label: string;
  readonly options: readonly T[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly className?: string;
}

/**
 * Menú desplegable de una sola elección («Filas por página»): botón de texto con el valor y su menú de
 * opciones (`menuitemradio`). Mismo patrón de teclado que `ActionMenu`.
 */
export function SelectionMenu<T extends string | number>({ label, options, value, onChange, className }: SelectionMenuProps<T>) {
  const { open, toggle, close, pinContainer, pinButton, panelId, onKeyDown } = useDisclosure();
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [open]);

  function move(event: KeyboardEvent<HTMLUListElement>): void {
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
    const index = items.findIndex((element) => element === document.activeElement);
    const destination: Record<string, number> = {
      ArrowDown: (index + 1) % items.length,
      ArrowUp: (index - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    };
    const next = destination[event.key];
    if (next !== undefined) {
      event.preventDefault();
      items[next]?.focus();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      items[(index + (event.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
    }
  }

  return (
    <div ref={pinContainer} role="presentation" className={joinClasses('relative', className)} onKeyDown={onKeyDown}>
      <button
        ref={pinButton}
        type="button"
        aria-label={`${label}: ${value}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        className="state-layer target-48 inline-flex h-10 cursor-pointer items-center gap-1 rounded-xs px-3 text-body-medium text-on-surface tabular-nums"
      >
        {value}
        <Icon name="expand_more" className="size-5 text-on-surface-variant" />
      </button>
      {open && (
        // El teclado se resuelve en cada elemento; este manejador solo mueve el foco entre ellos.
        <ul
          ref={list}
          id={panelId}
          role="menu"
          aria-label={label}
          onKeyDown={move}
          className="absolute right-0 bottom-full z-40 mb-1 min-w-24 rounded-xs bg-surface-container py-2 shadow-level-2"
        >
          {options.map((option) => (
            <li key={option} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={option === value}
                tabIndex={-1}
                onClick={() => {
                  onChange(option);
                  close();
                }}
                className="state-layer flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 text-left text-label-large text-on-surface tabular-nums"
              >
                <span className="flex size-5 items-center justify-center">{option === value && <Icon name="check" className="size-5" />}</span>
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
