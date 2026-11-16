/**
 * Preferencia de tema (anexo A1 §9): claro, oscuro o seguir al sistema (por defecto). Lo guardado es entrada
 * no confiable: se valida al leer y cualquier otro valor se descarta (ADR-0109 P-FE-06).
 */
export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type EffectiveTheme = Exclude<ThemePreference, 'system'>;

export const DEFAULT_THEME: ThemePreference = 'system';

/**
 * Valores que guardaron versiones anteriores del prototipo, en español: se siguen leyendo para no perder la
 * preferencia de quien ya eligió un tema. Lo que se escribe es siempre el valor actual.
 */
const LEGACY_PREFERENCES: Readonly<Record<string, ThemePreference>> = { claro: 'light', oscuro: 'dark', sistema: 'system' };

/** Clave del dispositivo: la última elegida en este equipo (la lee también `public/tema-inicial.js`). Se conserva: ya está guardada en dispositivos. */
export const DEVICE_THEME_KEY = 'suite.tema';

export function userThemeKey(userId: string): string {
  return `${DEVICE_THEME_KEY}.${userId}`;
}

function isPreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

export function parseTheme(value: unknown): ThemePreference | null {
  if (isPreference(value)) return value;
  return typeof value === 'string' ? (LEGACY_PREFERENCES[value] ?? null) : null;
}

export function resolveEffective(preference: ThemePreference, systemDark: boolean): EffectiveTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}
