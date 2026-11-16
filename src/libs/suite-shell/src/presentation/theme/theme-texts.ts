import type { IconName } from '@sil/ui';
import type { ThemePreference, EffectiveTheme } from '../../domain/theme-preference.ts';

/** Textos exactos del anexo A1 §9.1. */
export const THEME_OPTIONS: ReadonlyArray<{ readonly value: ThemePreference; readonly label: string; readonly icon: IconName }> = [
  { value: 'light', label: 'Claro', icon: 'light_mode' },
  { value: 'dark', label: 'Oscuro', icon: 'dark_mode' },
  { value: 'system', label: 'Seguir al sistema', icon: 'contrast' },
];

export const PREFERENCE_ICON: Readonly<Record<ThemePreference, IconName>> = {
  light: 'light_mode',
  dark: 'dark_mode',
  system: 'contrast',
};

export function themeLabel(preference: ThemePreference): string {
  return THEME_OPTIONS.find((o) => o.value === preference)?.label ?? '';
}

export function themeSupportText(preference: ThemePreference, effective: EffectiveTheme): string {
  switch (preference) {
    case 'system':
      return `Sigue el esquema de tu dispositivo (hoy: ${effective === 'dark' ? 'oscuro' : 'claro'}).`;
    case 'light':
      return 'Siempre claro.';
    case 'dark':
      return 'Siempre oscuro.';
  }
}
