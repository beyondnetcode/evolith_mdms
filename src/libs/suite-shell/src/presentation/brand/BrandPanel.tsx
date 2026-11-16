import { SuiteLogo, BRAND_TEXTS } from '@suite/header';
import { SUITE_TEXTS } from '../suite-texts.ts';
import { BrandMotif } from './BrandMotif.tsx';

/**
 * Panel de marca de S-01 en `expanded` o mayor (R-01 del anexo A1 §12): el 40 % del ancho, a alto completo, en
 * `brand` SÓLIDO (idéntico en claro y en oscuro). Como máximo cuatro bloques de contenido: el logotipo apilado
 * negativo arriba, a su tamaño nativo y SIN ampliar (el activo provisional es un PNG de 103 × 120 px: se ve nítido
 * solo a 1×, G-194), el nombre «Suite», un descriptor literal y el lema oficial al pie; y un único motivo
 * decorativo (`BrandMotif`). Sin cajas ni retícula. Si Organización entrega una fotografía con derechos, irá en el pie
 * del panel en duotono de `brand`, nunca detrás del texto (G-198).
 */
export function BrandPanel() {
  return (
    <aside className="relative hidden shrink-0 flex-col justify-between self-start overflow-hidden bg-brand p-12 text-on-brand expanded:sticky expanded:top-0 expanded:flex expanded:h-dvh expanded:w-2/5">
      <BrandMotif />
      <div className="relative">
        <SuiteLogo shape="stacked" size="panel" surface="brand" informative />
      </div>
      <div className="relative flex flex-col gap-2">
        <p className="text-display-small-emphasized">{BRAND_TEXTS.suite}</p>
        <p className="text-title-medium text-on-brand-variant">{SUITE_TEXTS.signIn.panelDescriptor}</p>
      </div>
      <p className="relative text-body-medium text-on-brand-variant">{BRAND_TEXTS.motto}</p>
    </aside>
  );
}
