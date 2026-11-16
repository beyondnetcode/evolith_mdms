import { DEFAULT_THEME, DEVICE_THEME_KEY, parseTheme, userThemeKey, type ThemePreference } from '../domain/theme-preference.ts';

/**
 * Puerto: dónde se guarda la preferencia. En el mock, `localStorage` por usuario y por dispositivo; lo real es el
 * perfil de UMS o del portal (G-184). En las pruebas, un almacén propio.
 */
export interface ThemeStore {
  read(key: string): string | null;
  write(key: string, value: string): void;
}

/**
 * Resolución (anexo A1 §9.2): con sesión, usuario → dispositivo → `sistema`; sin sesión, dispositivo →
 * `sistema`. Un valor que no sea de los tres se descarta y se sigue con el siguiente.
 */
export function readPreference(store: ThemeStore, userId: string | null): ThemePreference {
  const fromUser = userId === null ? null : parseTheme(store.read(userThemeKey(userId)));
  return fromUser ?? parseTheme(store.read(DEVICE_THEME_KEY)) ?? DEFAULT_THEME;
}

/** Al elegir se escriben ambas claves (la del usuario solo si hay sesión). */
export function savePreference(store: ThemeStore, userId: string | null, preference: ThemePreference): void {
  store.write(DEVICE_THEME_KEY, preference);
  if (userId !== null) store.write(userThemeKey(userId), preference);
}
