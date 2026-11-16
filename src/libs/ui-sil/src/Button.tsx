import type { ComponentPropsWithRef } from 'react';
import { Tooltip } from './Tooltip.tsx';
import { joinClasses } from './join-classes.ts';

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'text-inverse' | 'text-inherit';

const BASE =
  'state-layer target-48 inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full text-label-large whitespace-nowrap ' +
  'disabled:cursor-not-allowed disabled:bg-on-surface/12 disabled:text-on-surface/38 aria-disabled:cursor-not-allowed aria-disabled:text-on-surface/38';

const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  filled: 'bg-primary px-6 text-on-primary',
  tonal: 'bg-secondary-container px-6 text-on-secondary-container',
  outlined: 'border border-outline px-6 text-primary disabled:border-on-surface/12 disabled:bg-transparent',
  text: 'px-3 text-primary disabled:bg-transparent',
  /** Sobre `inverse-surface` (snackbar). */
  'text-inverse': 'px-3 text-inverse-primary focus-visible:outline-inverse-primary',
  /** Sobre un contenedor de color (aviso en línea): hereda el `on-*-container` del fondo. */
  'text-inherit': 'px-3 text-inherit disabled:bg-transparent',
};

/** Clases de botón de M3 (40 dp, forma `full`), para aplicarlas también a enlaces de navegación. */
export function buttonStyles(variant: ButtonVariant, className?: string): string {
  return joinClasses(BASE, VARIANTS[variant], className);
}

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  readonly variant?: ButtonVariant;
}

/** `relleno` solo para la acción primaria de la pantalla (Hick): una por vista. */
export function Button({ variant = 'text', type = 'button', className, ...rest }: ButtonProps) {
  return <button type={type} className={buttonStyles(variant, className)} {...rest} />;
}

const ICON =
  'state-layer-icon inline-flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed disabled:text-on-surface/38';
const STANDARD_ICON = 'text-on-surface-variant';
/** Sobre una superficie `brand` (anexo A1 §11.4): el icono y el anillo de foco usan `on-brand` (≥ 3:1). */
const ICON_ON_BRAND = 'text-on-brand focus-visible:outline-on-brand';
/** Sobre `inverse-surface` (snackbar): icono `inverse-on-surface` y anillo `inverse-primary` (≥ 4,5:1 sobre ese fondo). */
const ICON_INVERSE = 'text-inverse-on-surface focus-visible:outline-inverse-primary';

/** Clases del botón de icono: círculo de 40 dp dentro de un objetivo de 48 dp. */
export function iconButtonStyles(className?: string, onBrand = false, inverse = false): string {
  return joinClasses(ICON, inverse ? ICON_INVERSE : onBrand ? ICON_ON_BRAND : STANDARD_ICON, className);
}

interface IconButtonProps extends ComponentPropsWithRef<'button'> {
  /** Nombre accesible obligatorio: un botón de icono no tiene texto visible. */
  readonly 'aria-label': string;
  /** El botón va sobre una superficie `brand` (banda de marca de S-01): color de icono y de foco `on-brand`. */
  readonly onBrand?: boolean;
  /** El botón va sobre `inverse-surface` (snackbar). */
  readonly inverse?: boolean;
}

/** Botón de icono con su tooltip de M3 (aparece también con el foco del teclado, WCAG 1.4.13). */
export function IconButton({ type = 'button', className, onBrand = false, inverse = false, ...rest }: IconButtonProps) {
  return (
    <Tooltip text={rest['aria-label']}>
      <button type={type} className={iconButtonStyles(className, onBrand, inverse)} {...rest} />
    </Tooltip>
  );
}

/** FAB extendido (56 dp, forma `large`): la acción principal de la aplicación. */
export function fabStyles(className?: string): string {
  return joinClasses(
    'state-layer inline-flex h-14 cursor-pointer items-center justify-center gap-3 rounded-lg bg-primary-container px-4 text-label-large whitespace-nowrap text-on-primary-container shadow-level-3',
    className,
  );
}
