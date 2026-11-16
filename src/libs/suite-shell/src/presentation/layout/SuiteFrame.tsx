import { IconButton, Icon, joinClasses, useScrolled } from '@sil/ui';
import { FULL_SCOPE } from '@suite/contracts';
import type { ReactNode } from 'react';
import { BrandLink, NotificationsButton, HelpButton, AccountMenu, HEADER_TEXTS } from '@suite/header';
import { ThemeButton } from '../theme/ThemeButton.tsx';

interface Props {
  /** `false` en S-01: sin avatar, porque aún no hay persona (anexo A1 §1). */
  readonly withAccount: boolean;
  readonly children: ReactNode;
  readonly className?: string;
  /** La pantalla pinta su propia barra (la pantalla completa de notificaciones en `compact`). */
  readonly withoutHeader?: boolean;
  /** Botón «Volver» al inicio de la cabecera (la pantalla completa de notificaciones). */
  readonly back?: () => void;
}

/**
 * Marco común de las pantallas de la suite: enlace para saltar bloques, cabecera de la suite (marca,
 * «Notificaciones» (solo con el alcance completo), «Ayuda» y avatar, siempre en este orden; en S-01, sin persona, «Tema» y «Ayuda») y el
 * contenido principal (WCAG 2.4.1, 3.2.3 y 3.2.6).
 */
export function SuiteFrame({ withAccount, children, className, withoutHeader = false, back }: Props) {
  // UI-04: la cabecera pasa de `surface` a `surface-container` al desplazar el contenido (centinela, sin escuchar `scroll`).
  const { scrolled, sentinel } = useScrolled();
  return (
    <div className="relative flex min-h-dvh flex-col bg-surface text-on-surface">
      <div ref={sentinel} aria-hidden="true" className="pointer-events-none absolute top-0 left-0 h-px w-px" />
      <a
        href="#contenido"
        className="sr-only z-50 rounded-full bg-primary px-4 py-2 text-label-large text-on-primary focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {HEADER_TEXTS.skipLink}
      </a>
      {!withoutHeader && (
        <header
          data-scrolled={scrolled ? '' : undefined}
          className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-1 bg-surface px-4 transition-colors duration-(--md-sys-motion-duration-short4) ease-standard data-scrolled:bg-surface-container"
        >
          {back !== undefined && (
            <IconButton aria-label="Volver" onClick={back} className="-ml-3">
              <Icon name="arrow_back" />
            </IconButton>
          )}
          <BrandLink withText />
          <div className="flex-1" />
          {!withAccount && <ThemeButton />}
          {withAccount && FULL_SCOPE && <NotificationsButton />}
          <HelpButton />
          {withAccount && <AccountMenu />}
        </header>
      )}
      <main id="contenido" tabIndex={-1} className={joinClasses('flex min-w-0 flex-1 flex-col outline-none', className)}>
        {children}
      </main>
    </div>
  );
}
