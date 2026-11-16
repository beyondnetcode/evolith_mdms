import type { ThemeStore } from '../application/theme-preferences.ts';

/**
 * `localStorage` puede estar bloqueado (modo privado, políticas): el control sigue funcionando en
 * memoria y la preferencia no persiste, sin error visible (anexo A1 §9.2). `try/catch` con la rama
 * de memoria: no hay `catch` vacío.
 */
export function browserThemeStore(): ThemeStore {
  const memory = new Map<string, string>();
  return {
    read: (key) => {
      try {
        return globalThis.localStorage.getItem(key);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    write: (key, value) => {
      try {
        globalThis.localStorage.setItem(key, value);
      } catch {
        memory.set(key, value);
      }
    },
  };
}
