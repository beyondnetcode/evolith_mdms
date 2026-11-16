import type { ComponentPropsWithoutRef } from 'react';
import { Icon, type IconName } from './Icon.tsx';
import { joinClasses } from './join-classes.ts';

/**
 * Siete tonos de la etiqueta de estado (UI-SIL-001 §4.8, UI-01). Realizan las cuatro familias de color de estado
 * del anexo A1 §12 (R-14): atención, en curso, listo y cerrado. Regla rectora: LO NOMINAL CALLA Y LA EXCEPCIÓN HABLA.
 * Solo `block`, `attention`, `progress` e `info` llevan contenedor de color; el resto es icono más texto sin relleno
 * (`ready` y `quiet`) o contorno (`outline`). `info` (primary-container) existe solo para la paleta simple de la
 * bandeja de SIL (D-035, «Creado» en azul). Ningún tono usa `tertiary`, `brand` ni un relleno sólido.
 */
export type TagTone = 'block' | 'attention' | 'progress' | 'info' | 'outline' | 'ready' | 'quiet';

interface ToneStyle {
  /** Contenedor y texto: el par `on-*` accesible (P-UX-06). */
  readonly container: string;
  /** Color del icono, cuando difiere del texto. */
  readonly icon?: string;
  /** `true` si lleva fondo o borde: necesita relleno horizontal. */
  readonly boxed: boolean;
}

const TONES: Readonly<Record<TagTone, ToneStyle>> = {
  /** Impide avanzar. */
  block: { container: 'bg-error-container text-on-error-container', boxed: true },
  /** Pide actuar. */
  attention: { container: 'bg-warning-container text-on-warning-container', boxed: true },
  /** En marcha, sin incidencia. */
  progress: { container: 'bg-secondary-container text-on-secondary-container', boxed: true },
  /** Paleta simple de la bandeja (D-035): el expediente recién creado, en azul. */
  info: { container: 'bg-primary-container text-on-primary-container', boxed: true },
  /** Hecho por el sistema, sin más acción. */
  outline: { container: 'border border-outline text-on-surface', icon: 'text-on-surface-variant', boxed: true },
  /** Listo para la acción siguiente; lo nominal del semáforo. */
  ready: { container: 'text-on-surface', icon: 'text-success', boxed: false },
  /** Inicial, inexistente o sin evaluar. */
  quiet: { container: 'text-on-surface-variant', boxed: false },
};

export type TagSize = 'compact' | 'standard';

const SIZES: Readonly<Record<TagSize, { readonly box: string; readonly text: string; readonly icon: string; readonly padding: string }>> = {
  /** 24 dp: tabla y lista. */
  compact: { box: 'h-6 gap-1', text: 'text-label-medium', icon: 'size-4', padding: 'px-2' },
  /** 32 dp: ficha. */
  standard: { box: 'h-8 gap-2', text: 'text-label-large', icon: 'size-4.5', padding: 'px-3' },
};

interface TagProps extends ComponentPropsWithoutRef<'span'> {
  readonly tone: TagTone;
  readonly icon?: IconName;
  readonly size?: TagSize;
}

/**
 * Etiqueta de estado: composición con la anatomía de un chip de M3 pero no interactiva, sin capa de estado ni
 * foco. El significado va en el TEXTO; el icono es decorativo y el color nunca va solo (WCAG 1.4.1).
 */
export function Tag({ tone, icon, size = 'standard', className, children, ...rest }: TagProps) {
  const style = TONES[tone];
  const measure = SIZES[size];
  return (
    <span
      className={joinClasses(
        'inline-flex max-w-full items-center rounded-sm whitespace-nowrap',
        measure.box,
        measure.text,
        style.boxed && measure.padding,
        style.container,
        className,
      )}
      {...rest}
    >
      {icon !== undefined && <Icon name={icon} className={joinClasses(measure.icon, style.icon)} />}
      {children}
    </span>
  );
}
