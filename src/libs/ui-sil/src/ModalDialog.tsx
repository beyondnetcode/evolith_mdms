import { useEffect, useRef, type ReactNode } from 'react';
import { IconButton } from './Button.tsx';
import { Icon } from './Icon.tsx';
import { joinClasses } from './join-classes.ts';

export type DialogVariant = 'basic' | 'bottom-sheet' | 'rail' | 'side-sheet' | 'full-screen';

interface ModalDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly variant?: DialogVariant;
  readonly title: string;
  readonly children: ReactNode;
  /** Acciones al final (botones de texto), solo en la variante `basico` y `hoja-inferior`. */
  readonly actions?: ReactNode;
  readonly className?: string;
  /**
   * `false`: el clic en el fondo no lo cierra y `Escape` no lo descarta, sino que activa `onEscape`
   * (p. ej. «Tu sesión terminó», que no admite cancelarse): ADR-0110 P-UX-08 exige que `Escape` actúe.
   */
  readonly closable?: boolean;
  /** Lo que hace `Escape` cuando `closable` es `false`: la acción segura del diálogo. */
  readonly onEscape?: () => void;
  /** Línea de apoyo bajo el título, solo en las variantes con barra (`hoja-lateral` y `pantalla-completa`). */
  readonly subtitle?: ReactNode;
  /**
   * Al abrir, el foco va al título (que pasa a ser enfocable) y no al primer control: el patrón de una
   * hoja cuyo primer control sería un botón de cerrar (anexo A1 §10.6, ADR-0110 P-UX-08).
   */
  readonly focusTitle?: boolean;
}

const VARIANTS: Readonly<Record<DialogVariant, string>> = {
  basic: 'dialog-width field-container-high m-auto rounded-xl bg-surface-container-high p-6 shadow-level-3',
  'bottom-sheet': 'field-container-low m-0 mt-auto w-full max-w-none rounded-t-xl bg-surface-container-low p-6 shadow-level-1',
  rail: 'rail-width field-container-low m-0 mr-auto h-full max-h-none rounded-r-lg bg-surface-container-low p-3 shadow-level-1',
  /** Hoja lateral modal (especificación UI-SIL-001 §4.10, ADR-0147 §2.3): a la derecha, 400 dp como máximo, forma `large`. */
  'side-sheet':
    'sheet-width field-container-low m-0 ml-auto h-full max-h-none max-w-none rounded-l-lg bg-surface-container-low shadow-level-1 open:flex open:flex-col',
  /** `compact`: el diálogo ocupa toda la pantalla, con «Cerrar» al inicio de la barra. */
  'full-screen': 'm-0 h-full max-h-none w-full max-w-none rounded-none bg-surface open:flex open:flex-col',
};

const OVERLAPPING: readonly DialogVariant[] = ['side-sheet', 'full-screen'];

/**
 * Superposición modal con `<dialog>`: la plataforma atrapa el foco, vuelve a dejar inerte el
 * resto de la página, cierra con `Escape` y devuelve el foco al disparador (ADR-0110 P-UX-08).
 */
export function ModalDialog({ open, onClose, variant = 'basic', title, children, actions, className, closable = true, onEscape, subtitle, focusTitle = false }: ModalDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (open && !element.open) {
      if (typeof element.showModal === 'function') element.showModal();
      else element.setAttribute('open', '');
      // La plataforma enfoca el primer control; si el contenido marca uno con `data-autofocus`
      // (el campo principal), el foco va ahí.
      element.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && element.open) {
      if (typeof element.close === 'function') element.close();
      else element.removeAttribute('open');
    }
  }, [open]);

  return (
    // El clic sobre el fondo (el propio <dialog>) cierra; el teclado cierra con `Escape`, que resuelve
    // la plataforma, así que el clic no necesita un equivalente de teclado.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <dialog
      ref={dialog}
      aria-label={title}
      onClose={onClose}
      onCancel={(event) => {
        if (!closable) {
          event.preventDefault();
          onEscape?.();
        }
      }}
      onClick={(event) => {
        if (closable && event.target === event.currentTarget) onClose();
      }}
      className={joinClasses('enter-animation text-on-surface backdrop:bg-scrim/32', VARIANTS[variant], className)}
    >
      {variant === 'basic' ? <h2 className="mb-4 text-headline-small">{title}</h2> : null}
      {OVERLAPPING.includes(variant) && (
        <header className="flex min-h-16 shrink-0 items-center gap-1 px-2">
          <IconButton aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" />
          </IconButton>
          <div className="min-w-0 flex-1">
            <h2 tabIndex={focusTitle ? -1 : undefined} data-autofocus={focusTitle ? '' : undefined} className={joinClasses('text-title-large-emphasized', focusTitle && 'outline-none')}>
              {title}
            </h2>
            {subtitle !== undefined && <p className="text-body-small text-on-surface-variant">{subtitle}</p>}
          </div>
        </header>
      )}
      <div className={OVERLAPPING.includes(variant) ? 'min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-4' : undefined}>{children}</div>
      {actions !== undefined && (
        <div className={joinClasses('flex justify-end gap-2', OVERLAPPING.includes(variant) ? 'shrink-0 px-6 pb-6' : 'mt-6')}>{actions}</div>
      )}
    </dialog>
  );
}
