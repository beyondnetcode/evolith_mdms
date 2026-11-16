import type { ReactNode } from 'react';

/**
 * Marca geométrica, sin nombre de empresa. Se sustituye por el logotipo oficial cuando exista.
 */
export const LOGO_IS_PLACEHOLDER = true;

/** Origen del dibujo, para que las pruebas distingan el marcador local de un activo oficial. */
export const ASSET_SOURCE = 'marca-local' as const;

/** Versión cromática: en color, negativa blanca o monocroma. */
export type ColorVersion = 'color' | 'negative' | 'mono';

/** Forma: isotipo solo o apilada (el mismo dibujo, más alto). */
export type LogoShape = 'isotype' | 'stacked';

export interface LogoAsset {
  /** Proporción ancho / alto del dibujo, para reservar el espacio sin saltos de maquetación. */
  readonly aspectRatio: string;
  readonly drawing: (color: ColorVersion) => ReactNode;
}

function Mark({ color }: { readonly color: ColorVersion }) {
  const fill = color === 'color' ? 'var(--md-sys-color-brand)' : 'currentColor';
  return (
    <svg viewBox="0 0 64 64" className="size-full" aria-hidden="true" focusable="false">
      <rect x="8" y="8" width="48" height="48" rx="12" fill={fill} />
    </svg>
  );
}

export const ASSETS: Readonly<Record<LogoShape, LogoAsset>> = {
  isotype: { aspectRatio: '1 / 1', drawing: (color) => <Mark color={color} /> },
  stacked: { aspectRatio: '1 / 1', drawing: (color) => <Mark color={color} /> },
};
