import type { ComponentPropsWithoutRef } from 'react';
import { joinClasses } from '../join-classes.ts';
import { ASSETS, ASSET_SOURCE, type LogoShape, type ColorVersion } from './assets.tsx';

export type { LogoShape, ColorVersion } from './assets.tsx';

/** Fondo donde va el logotipo; decide la versión (anexo A1 §11.3). */
export type LogoBackground = 'light' | 'dark' | 'brand' | 'monochrome';

/**
 * Regla de elección de versión (anexo A1 §11.3): sobre `brand`, fotografía o tema oscuro, la negativa
 * blanca; a un solo color, la monocroma; en cualquier otro caso, la de color. La versión en color sobre
 * `surface` oscuro mide 1,68:1 y sobre `brand`, 1,00:1: está prohibida.
 */
export function versionForBackground(background: LogoBackground): ColorVersion {
  switch (background) {
    case 'brand':
    case 'dark':
      return 'negative';
    case 'monochrome':
      return 'mono';
    case 'light':
      return 'color';
  }
}

/**
 * Tamaños con nombre (anexo A1 §11.3). El activo provisional es un PNG de baja resolución: NINGÚN tamaño
 * supera su resolución nativa (isotipo 96 dp de alto, apilado 120 dp), para que no se vea borroso. Con el SVG
 * oficial se podrán ampliar los máximos.
 */
export type LogoSize = 'minimum' | 'bar' | 'panel';

const SIZE: Readonly<Record<LogoShape, Readonly<Record<LogoSize, string>>>> = {
  // Isotipo: 24 dp mínimo; 32 dp en la barra y la banda; 96 dp (1×) como máximo.
  isotype: { minimum: 'h-6', bar: 'h-8', panel: 'h-24' },
  // Apilado: 48 dp de alto mínimo; 120 dp (1×) como máximo.
  stacked: { minimum: 'h-12', bar: 'h-12', panel: 'h-30' },
};

interface LogoProps extends Omit<ComponentPropsWithoutRef<'span'>, 'children' | 'role' | 'aria-label' | 'aria-hidden'> {
  readonly shape: LogoShape;
  readonly background: LogoBackground;
  readonly size: LogoSize;
  /**
   * `true`: el logotipo comunica la marca por sí solo y lleva nombre accesible «Suite». `false` (por
   * defecto): decorativo, oculto a los lectores de pantalla.
   */
  readonly informative?: boolean;
}

/**
 * Logotipo detrás de una interfaz estable. Hoy dibuja la marca geométrica de `assets.tsx`.
 * El elemento lleva `data-source` para distinguir el marcador local de un activo oficial.
 */
export function Logo({ shape, background, size, informative = false, className, style, ...rest }: LogoProps) {
  const active = ASSETS[shape];
  const version = versionForBackground(background);
  const accessible = informative ? { role: 'img', 'aria-label': 'Suite' } : { 'aria-hidden': true as const };
  return (
    <span
      data-shape={shape}
      data-version={version}
      data-source={ASSET_SOURCE}
      className={joinClasses('inline-flex shrink-0', SIZE[shape][size], className)}
      style={{ aspectRatio: active.aspectRatio, ...style }}
      {...accessible}
      {...rest}
    >
      {active.drawing(version)}
    </span>
  );
}
