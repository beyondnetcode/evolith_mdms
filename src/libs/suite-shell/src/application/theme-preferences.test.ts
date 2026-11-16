import { describe, expect, it } from 'vitest';
import { DEVICE_THEME_KEY, parseTheme, resolveEffective, userThemeKey } from '../domain/theme-preference.ts';
import { browserThemeStore } from '../infrastructure/browser-theme-store.ts';
import { readPreference, savePreference, type ThemeStore } from './theme-preferences.ts';

function inMemoryStore(initial: Record<string, string> = {}): ThemeStore & { readonly data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return { data, read: (key) => data.get(key) ?? null, write: (key, value) => void data.set(key, value) };
}

describe('preferencia de tema (anexo A1 §9.2)', () => {
  it('el valor por defecto es «sistema»', () => {
    expect(readPreference(inMemoryStore(), null)).toBe('system');
    expect(readPreference(inMemoryStore(), 'ana.perez')).toBe('system');
  });

  it('con sesión: usuario → dispositivo → sistema; sin sesión: dispositivo → sistema', () => {
    const store = inMemoryStore({ [DEVICE_THEME_KEY]: 'light', [userThemeKey('ana.perez')]: 'dark' });
    expect(readPreference(store, 'ana.perez')).toBe('dark');
    expect(readPreference(store, 'luis.rojas')).toBe('light');
    expect(readPreference(store, null)).toBe('light');
  });

  it('los valores que guardaron versiones anteriores (claro, oscuro, sistema) se siguen leyendo', () => {
    expect(parseTheme('claro')).toBe('light');
    expect(parseTheme('oscuro')).toBe('dark');
    expect(parseTheme('sistema')).toBe('system');
    expect(readPreference(inMemoryStore({ [userThemeKey('ana.perez')]: 'oscuro' }), 'ana.perez')).toBe('dark');
  });

  it('un valor guardado que no sea de los tres se descarta y se sigue con el siguiente', () => {
    const store = inMemoryStore({ [DEVICE_THEME_KEY]: 'dark', [userThemeKey('ana.perez')]: 'morado' });
    expect(readPreference(store, 'ana.perez')).toBe('dark');
    expect(readPreference(inMemoryStore({ [DEVICE_THEME_KEY]: '<script>' }), null)).toBe('system');
    expect(parseTheme(undefined)).toBeNull();
    expect(parseTheme(1)).toBeNull();
    expect(parseTheme('system')).toBe('system');
  });

  it('al elegir se escriben ambas claves, la del usuario solo con sesión', () => {
    const store = inMemoryStore();
    savePreference(store, 'ana.perez', 'dark');
    expect([...store.data]).toEqual([
      [DEVICE_THEME_KEY, 'dark'],
      [userThemeKey('ana.perez'), 'dark'],
    ]);
    const withoutSession = inMemoryStore();
    savePreference(withoutSession, null, 'light');
    expect([...withoutSession.data.keys()]).toEqual([DEVICE_THEME_KEY]);
  });

  it('el esquema efectivo: explícito manda; «sistema» sigue al dispositivo', () => {
    expect(resolveEffective('light', true)).toBe('light');
    expect(resolveEffective('dark', false)).toBe('dark');
    expect(resolveEffective('system', true)).toBe('dark');
    expect(resolveEffective('system', false)).toBe('light');
  });

  it('con el almacenamiento bloqueado el control sigue funcionando en memoria y no lanza', () => {
    const disabled = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('bloqueado', 'SecurityError');
      },
    });
    try {
      const store = browserThemeStore();
      expect(store.read(DEVICE_THEME_KEY)).toBeNull();
      expect(() => savePreference(store, null, 'dark')).not.toThrow();
      expect(readPreference(store, null)).toBe('dark');
    } finally {
      if (disabled !== undefined) Object.defineProperty(globalThis, 'localStorage', disabled);
    }
  });
});
