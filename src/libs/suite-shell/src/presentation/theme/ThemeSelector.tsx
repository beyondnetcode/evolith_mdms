import { Icon, joinClasses } from '@sil/ui';
import { useId } from 'react';
import { parseTheme } from '../../domain/theme-preference.ts';
import { themeSupportText, THEME_OPTIONS } from './theme-texts.ts';
import { useTheme } from './ThemeContext.tsx';

/**
 * Grupo «Tema» (anexo A1 §9.1): tres botones de opción de M3 —una entre pocas opciones visibles; los
 * segmentados están retirados en Expressive (G-137)— en un `fieldset` con leyenda. Son `radio` nativos:
 * flechas para moverse y `Espacio` selecciona. El efecto es inmediato, sin «Aplicar» ni snackbar: el
 * estado lo dice el propio grupo, que no se comunica solo con color (marca + icono + texto).
 */
export function ThemeSelector({ className }: { readonly className?: string }) {
  const { preference, effective, setPreference } = useTheme();
  const name = useId();
  const supportId = useId();
  return (
    <fieldset aria-describedby={supportId} className={joinClasses('flex flex-col px-2 py-2', className)}>
      <legend className="px-2 pb-1 text-label-large text-on-surface-variant">Tema</legend>
      {THEME_OPTIONS.map((option) => (
        <label
          key={option.value}
          className="state-layer flex min-h-12 cursor-pointer items-center gap-3 rounded-sm px-2 text-body-large text-on-surface has-checked:bg-secondary-container has-checked:text-on-secondary-container"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={preference === option.value}
            onChange={(event) => {
              const chosen = parseTheme(event.target.value);
              if (chosen !== null) setPreference(chosen);
            }}
            className="size-5 shrink-0 cursor-pointer accent-primary"
          />
          <Icon name={option.icon} />
          {option.label}
        </label>
      ))}
      <p id={supportId} className="px-2 pt-1 text-body-small text-on-surface-variant">
        {themeSupportText(preference, effective)}
      </p>
    </fieldset>
  );
}
