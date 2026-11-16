import { IconButton, Icon, useDisclosure } from '@sil/ui';
import { ThemeSelector } from './ThemeSelector.tsx';
import { PREFERENCE_ICON, themeLabel } from './theme-texts.ts';
import { useTheme } from './ThemeContext.tsx';

/**
 * Botón de icono «Tema» de S-01, que no tiene menú de cuenta (anexo A1 §9.1): su icono refleja el valor
 * elegido, no el esquema efectivo; abre un menú que contiene solo el grupo. `Escape` cierra y devuelve
 * el foco al botón.
 */
export function ThemeButton({ onBrand = false }: { readonly onBrand?: boolean }) {
  const { preference } = useTheme();
  const { open: isOpen, toggle, pinContainer, pinButton, panelId, onKeyDown } = useDisclosure();
  return (
    <div ref={pinContainer} role="presentation" className="relative" onKeyDown={onKeyDown}>
      <IconButton
        ref={pinButton}
        aria-label={`Tema: ${themeLabel(preference)}`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onBrand={onBrand}
        onClick={toggle}
      >
        <Icon name={PREFERENCE_ICON[preference]} />
      </IconButton>
      {isOpen && (
        <div id={panelId} className="absolute top-full right-0 z-40 mt-1 w-72 max-w-screen rounded-xs bg-surface-container py-1 shadow-level-2">
          <ThemeSelector />
        </div>
      )}
    </div>
  );
}
