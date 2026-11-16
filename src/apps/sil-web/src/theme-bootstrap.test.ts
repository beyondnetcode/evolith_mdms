import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { THEME_COLOR } from '@sil/ui-tokens';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * El script de arranque (`public/tema-inicial.js`, anexo A1 §9.3) se ejecuta tal como lo carga el navegador:
 * síncrono, antes de pintar. Aquí se evalúa sobre jsdom con distintos estados del almacenamiento.
 */
const SCRIPT = readFileSync(resolve(import.meta.dirname, '../public/tema-inicial.js'), 'utf8');

function run(): void {
  // El archivo es del propio repositorio y es lo que el navegador ejecuta; no es entrada de la persona.
  (0, eval)(SCRIPT);
}

const colors = (): string[] => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => m.content);

beforeEach(() => {
  document.head.innerHTML = `
    <meta name="theme-color" content="${THEME_COLOR.light}" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="${THEME_COLOR.dark}" media="(prefers-color-scheme: dark)">`;
  document.documentElement.removeAttribute('data-theme');
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
});

describe('script de arranque del tema', () => {
  it('sin preferencia no escribe nada: decide el CSS con prefers-color-scheme', () => {
    run();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(colors()).toEqual([THEME_COLOR.light, THEME_COLOR.dark]);
  });

  it('«sistema» tampoco escribe nada', () => {
    globalThis.localStorage.setItem('suite.tema', 'system');
    run();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it.each(['light', 'dark'] as const)('con %s en el dispositivo escribe data-theme y iguala theme-color', (theme) => {
    globalThis.localStorage.setItem('suite.tema', theme);
    run();
    expect(document.documentElement.dataset.theme).toBe(theme);
    expect(colors()).toEqual([THEME_COLOR[theme], THEME_COLOR[theme]]);
  });

  it.each([
    ['claro', 'light'],
    ['oscuro', 'dark'],
  ] as const)('un valor guardado por versiones anteriores (%s) se sigue leyendo como %s', (legacy, theme) => {
    globalThis.localStorage.setItem('suite.tema', legacy);
    run();
    expect(document.documentElement.dataset.theme).toBe(theme);
  });

  it('con sesión, la preferencia del usuario manda sobre la del dispositivo (incluido «sistema»)', () => {
    globalThis.sessionStorage.setItem('suite.sesion.v1', JSON.stringify({ user: { id: 'ana.perez' } }));
    globalThis.localStorage.setItem('suite.tema', 'light');
    globalThis.localStorage.setItem('suite.tema.ana.perez', 'dark');
    run();
    expect(document.documentElement.dataset.theme).toBe('dark');
    document.documentElement.removeAttribute('data-theme');
    globalThis.localStorage.setItem('suite.tema.ana.perez', 'system');
    run();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('un valor desconocido, una sesión corrupta o el almacenamiento bloqueado no rompen ni escriben', () => {
    globalThis.localStorage.setItem('suite.tema', 'rojo');
    globalThis.sessionStorage.setItem('suite.sesion.v1', '{no es json');
    expect(run).not.toThrow();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);

    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('bloqueado', 'SecurityError');
      },
    });
    try {
      expect(run).not.toThrow();
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    } finally {
      if (original !== undefined) Object.defineProperty(window, 'localStorage', original);
    }
  });

  it('es un archivo del mismo origen cargado de forma síncrona antes de la hoja de estilos (compatible con una CSP estricta)', () => {
    const html = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/<script src="\/tema-inicial\.js"><\/script>/);
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/<script[^>]*\b(async|defer)\b[^>]*tema-inicial/);
    expect(html).not.toContain('theme-color');
  });
});
