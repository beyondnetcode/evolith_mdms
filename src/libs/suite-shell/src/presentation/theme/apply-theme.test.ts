import { THEME_COLOR } from '@sil/ui-tokens';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme } from './apply-theme.ts';

describe('aplicarTema (data-theme y theme-color)', () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="theme-color" content="${THEME_COLOR.light}" media="(prefers-color-scheme: light)">
      <meta name="theme-color" content="${THEME_COLOR.dark}" media="(prefers-color-scheme: dark)">`;
    document.documentElement.removeAttribute('data-theme');
  });

  const colors = (): string[] => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => m.content);

  it('un valor explícito escribe data-theme y iguala las dos etiquetas theme-color', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(colors()).toEqual([THEME_COLOR.dark, THEME_COLOR.dark]);
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(colors()).toEqual([THEME_COLOR.light, THEME_COLOR.light]);
  });

  it('«sistema» quita data-theme y cada etiqueta recupera su color por su media', () => {
    applyTheme('dark');
    applyTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(colors()).toEqual([THEME_COLOR.light, THEME_COLOR.dark]);
  });
});
