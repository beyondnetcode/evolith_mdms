import type { MouseEvent } from 'react';
import { Link } from 'react-router';
import { SuiteLogo } from './SuiteLogo.tsx';
import { BRAND_TEXTS } from './brand-texts.ts';

interface Props {
  /** Escribe «Suite» junto al isotipo (la barra de la suite y la de SIL desde `expanded`). */
  readonly withText: boolean;
  /** Para pedir confirmación si hay cambios sin guardar antes de salir de SIL. */
  readonly onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * Marca de la cabecera (anexo A1 §11.6, M-05): el isotipo de 32 dp antes del título «Suite», como
 * un enlace a S-02 con nombre accesible «Suite, inicio». El isotipo es decorativo: el nombre lo da
 * el enlace. La barra sigue en `surface`, así que en oscuro el isotipo es la versión negativa.
 */
export function BrandLink({ withText, onClick }: Props) {
  return (
    <Link
      to="/"
      aria-label={BRAND_TEXTS.homeLink}
      {...(onClick === undefined ? {} : { onClick })}
      className="state-layer -ml-1 flex min-h-12 min-w-0 shrink items-center gap-3 rounded-full px-1 pe-3 text-on-surface"
    >
      <SuiteLogo shape="isotype" size="bar" surface="surface" />
      {withText && <span className="truncate text-title-medium medium:text-title-large">{BRAND_TEXTS.suite}</span>}
    </Link>
  );
}
