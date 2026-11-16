import { joinClasses, useDisclosure } from '@sil/ui';
import type { ReactNode } from 'react';
import { HEADER_TEXTS } from './header-texts.ts';
import { useHeaderTheme } from './HeaderThemeContext.tsx';
import { useSuiteHeader } from './SuiteHeaderContext.tsx';

/**
 * Avatar con las iniciales y menú de cuenta (anexo A1 §3): nombre completo y usuario sin acción, lo que
 * aporte el sistema montado (`children`, p. ej. el perfil de SIL), el grupo «Tema» (§9), las herramientas del
 * prototipo si las hay (`prototypeTools`, R-11) y la ÚNICA acción de sesión, «Cerrar sesión», siempre al final. `Escape` cierra y el foco vuelve al avatar.
 */
export function AccountMenu({ children, prototypeTools }: { readonly children?: ReactNode; readonly prototypeTools?: ReactNode }) {
  const { user, signOut } = useSuiteHeader();
  const { themeSelector } = useHeaderTheme();
  const { open: isOpen, toggle, pinContainer, pinButton, panelId, onKeyDown } = useDisclosure();

  return (
    <div ref={pinContainer} role="presentation" className="relative" onKeyDown={onKeyDown}>
      <button
        ref={pinButton}
        type="button"
        aria-label={`Cuenta de ${user.fullName}`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onClick={toggle}
        className="state-layer-icon inline-flex size-12 cursor-pointer items-center justify-center rounded-full"
      >
        <span
          aria-hidden="true"
          className="inline-flex size-10 items-center justify-center rounded-full bg-primary-container text-label-large text-on-primary-container"
        >
          {user.initials}
        </span>
      </button>
      {isOpen && (
        <div
          id={panelId}
          className={joinClasses(
            'absolute top-full right-0 z-40 mt-1 flex max-h-dvh w-80 max-w-screen flex-col overflow-y-auto rounded-xs bg-surface-container py-2 shadow-level-2',
          )}
        >
          <div className="px-4 py-2">
            <p className="text-title-small">{user.fullName}</p>
            <p className="text-body-small text-on-surface-variant">{user.id}</p>
          </div>
          {children}
          <div className="border-t border-outline-variant">{themeSelector}</div>
          {prototypeTools !== undefined && <div className="border-t border-outline-variant">{prototypeTools}</div>}
          <button
            type="button"
            onClick={signOut}
            className="state-layer flex h-12 w-full cursor-pointer items-center border-t border-outline-variant px-4 text-left text-label-large text-on-surface"
          >
            {HEADER_TEXTS.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
