import { HeaderThemeContext, type HeaderTheme } from '@suite/header';
import { createContext, use, useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { useSuiteServices } from '../../application/suite-services.ts';
import { readPreference, savePreference } from '../../application/theme-preferences.ts';
import { resolveEffective, type EffectiveTheme, type ThemePreference } from '../../domain/theme-preference.ts';
import { useSuite } from '../session/SuiteContext.tsx';
import { applyTheme } from './apply-theme.ts';
import { ThemeSelector } from './ThemeSelector.tsx';

interface Theme {
  /** Lo que la persona eligió: claro, oscuro o seguir al sistema. */
  readonly preference: ThemePreference;
  /** El esquema que se ve ahora (con `system`, el del dispositivo). */
  readonly effective: EffectiveTheme;
  readonly setPreference: (preference: ThemePreference) => void;
}

const Context = createContext<Theme | null>(null);

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Avisa a quienes leen la preferencia tras escribirla en esta pestaña (el evento `storage` solo llega a las demás). */
const listeners = new Set<() => void>();

function subscribePreference(notify: () => void): () => void {
  listeners.add(notify);
  // Sincronía entre pestañas (anexo A1 §9.2).
  globalThis.addEventListener('storage', notify);
  return () => {
    listeners.delete(notify);
    globalThis.removeEventListener('storage', notify);
  };
}

function darkQuery(): MediaQueryList | null {
  return typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(DARK_QUERY) : null;
}

/** Con `system`, un cambio del tema del sistema operativo se refleja en vivo, sin recargar. */
function subscribeSystem(notify: () => void): () => void {
  const query = darkQuery();
  query?.addEventListener('change', notify);
  return () => query?.removeEventListener('change', notify);
}


/**
 * Tema de la suite y de SIL (anexo A1 §9). Debe ir bajo `SuiteProvider`: la preferencia es por usuario
 * de la sesión. La preferencia es un sistema externo (`localStorage`) y el documento, otro: se leen con
 * `useSyncExternalStore` y se sincroniza el atributo con un efecto.
 */
export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const { session } = useSuite();
  const { themeStore: store } = useSuiteServices();
  const userId = session?.user.id ?? null;
  const preference = useSyncExternalStore(
    subscribePreference,
    () => readPreference(store, userId),
    (): ThemePreference => 'system',
  );
  const systemDark = useSyncExternalStore(
    subscribeSystem,
    () => darkQuery()?.matches ?? false,
    () => false,
  );

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      savePreference(store, userId, next);
      for (const notify of listeners) notify();
    },
    [store, userId],
  );

  const value = useMemo<Theme>(
    () => ({ preference, effective: resolveEffective(preference, systemDark), setPreference }),
    [preference, systemDark, setPreference],
  );
  // La cabecera común solo necesita el esquema efectivo y el control ya montado (ADR-0245).
  const header = useMemo<HeaderTheme>(
    () => ({ effectiveTheme: value.effective, themeSelector: <ThemeSelector /> }),
    [value.effective],
  );
  return (
    <Context value={value}>
      <HeaderThemeContext value={header}>{children}</HeaderThemeContext>
    </Context>
  );
}

export function useTheme(): Theme {
  const theme = use(Context);
  if (theme === null) throw new Error('useTheme requiere un ThemeProvider');
  return theme;
}
