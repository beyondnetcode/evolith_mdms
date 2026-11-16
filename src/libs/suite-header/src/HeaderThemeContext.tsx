import { createContext, use, type ReactNode } from 'react';

export type HeaderEffectiveTheme = 'light' | 'dark';

/**
 * Lo que la cabecera necesita del tema, que es de la suite: el esquema efectivo (el logotipo cambia de
 * versión) y el control «Tema» ya montado, que el menú de cuenta coloca en su sitio (anexo A1 §9). La
 * cabecera no conoce dónde ni cómo se guarda la preferencia.
 */
export interface HeaderTheme {
  readonly effectiveTheme: HeaderEffectiveTheme;
  readonly themeSelector: ReactNode;
}

export const HeaderThemeContext = createContext<HeaderTheme | null>(null);

export function useHeaderTheme(): HeaderTheme {
  const theme = use(HeaderThemeContext);
  if (theme === null) throw new Error('useHeaderTheme requiere un HeaderThemeContext');
  return theme;
}
