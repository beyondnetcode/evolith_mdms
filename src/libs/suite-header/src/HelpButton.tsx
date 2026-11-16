import { IconButton, Icon, useSnackbar } from '@sil/ui';
import { HEADER_TEXTS } from './header-texts.ts';

/** «Ayuda» siempre en la misma posición de la cabecera (WCAG 3.2.6). En el mock solo avisa (G-124). */
export function HelpButton({ onBrand = false }: { readonly onBrand?: boolean }) {
  const { show } = useSnackbar();
  return (
    <IconButton aria-label="Ayuda" onBrand={onBrand} onClick={() => show({ text: HEADER_TEXTS.help })}>
      <Icon name="help" />
    </IconButton>
  );
}
