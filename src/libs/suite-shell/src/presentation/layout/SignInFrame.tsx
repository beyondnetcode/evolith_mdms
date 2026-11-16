import { useWindowSizeClass } from '@sil/ui';
import { isDesktop } from '@sil/ui-tokens';
import type { ReactNode } from 'react';
import { SuiteLogo, BRAND_TEXTS, HelpButton, HEADER_TEXTS } from '@suite/header';
import { BrandPanel } from '../brand/BrandPanel.tsx';
import { InstitutionalFooter } from '../brand/InstitutionalFooter.tsx';
import { ThemeButton } from '../theme/ThemeButton.tsx';

/**
 * Marco de S-01 (anexo A1 §2 y §11.6, M-03 y M-04). Sin persona no hay avatar ni menú de cuenta:
 * - `expanded` o mayor: panel de marca en `brand` a la izquierda, a alto completo, y a la derecha la barra
 *   transparente (solo «Tema» y «Ayuda») sobre el formulario;
 * - `medium` y `compact`: sin panel; una banda de `brand` de 64 dp con el isotipo negativo y «Suite»,
 *   con «Tema» y «Ayuda» en `on-brand` y su anillo de foco en `on-brand` (≥ 3:1).
 * El pie institucional cierra la columna del formulario.
 */
export function SignInFrame({ children }: { readonly children: ReactNode }) {
  const sizeClass = useWindowSizeClass();
  const onBrand = !isDesktop(sizeClass);
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface expanded:flex-row">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-full bg-primary px-4 py-2 text-label-large text-on-primary focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {HEADER_TEXTS.skipLink}
      </a>
      <BrandPanel />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-1 bg-brand px-4 text-on-brand expanded:bg-surface expanded:text-on-surface">
          <div className="flex items-center gap-3 expanded:hidden">
            <SuiteLogo shape="isotype" size="bar" surface="brand" />
            <span className="text-title-large">{BRAND_TEXTS.suite}</span>
          </div>
          <div className="flex-1" />
          <ThemeButton onBrand={onBrand} />
          <HelpButton onBrand={onBrand} />
        </header>
        <main id="contenido" tabIndex={-1} className="flex min-w-0 flex-1 flex-col px-4 pb-6 outline-none">
          {children}
          <InstitutionalFooter />
        </main>
      </div>
    </div>
  );
}
