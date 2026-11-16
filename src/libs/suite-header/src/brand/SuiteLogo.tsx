import { Logo, type LogoShape, type LogoSize } from '@sil/ui';
import { use } from 'react';
import { HeaderThemeContext } from '../HeaderThemeContext.tsx';

interface Props {
  readonly shape: LogoShape;
  readonly size: LogoSize;
  /** `marca`: sobre una superficie `brand` (siempre la negativa). `superficie`: sobre `surface`, según el tema. */
  readonly surface: 'brand' | 'surface';
  readonly informative?: boolean;
  readonly className?: string;
}

/**
 * Logotipo según el fondo donde va: sobre `brand` y en el tema oscuro, la versión negativa;
 * sobre `surface` claro, la de color. El tema efectivo (también con «Seguir al sistema») lo da el
 * anfitrión; sin él (sobre `brand`), no hace falta.
 */
export function SuiteLogo({ shape, size, surface, informative = false, className }: Props) {
  const theme = use(HeaderThemeContext);
  const background = surface === 'brand' ? 'brand' : theme?.effectiveTheme === 'dark' ? 'dark' : 'light';
  return <Logo shape={shape} size={size} background={background} informative={informative} {...(className === undefined ? {} : { className })} />;
}
