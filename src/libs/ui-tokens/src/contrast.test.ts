import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_COLOR } from './index.ts';

/**
 * Contraste WCAG 2.2 de los pares de roles en ambos esquemas (anexo A1 §9.4, G-185). Es la prueba
 * automática de los tokens: lee `colors.generated.css`, que es el origen único, y mide la
 * luminancia relativa de WCAG. No sustituye a axe sobre la interfaz: la complementa.
 */
const CSS = readFileSync(resolve(import.meta.dirname, 'colors.generated.css'), 'utf8');

type Scheme = 'light' | 'dark';

/** Los tres bloques del CSS generado: claro (`:root`), oscuro por el sistema y oscuro explícito. */
function roles(scheme: Scheme, source: 'system' | 'attribute' = 'attribute'): Map<string, string> {
  const start =
    scheme === 'light' ? CSS.indexOf(':root,') : source === 'system' ? CSS.indexOf('@media (prefers-color-scheme: dark)') : CSS.indexOf(":root[data-theme='dark']");
  const end = CSS.indexOf('\n}', start);
  const map = new Map<string, string>();
  for (const [, name, value] of CSS.slice(start, end).matchAll(/--md-sys-color-([a-z-]+):\s*(#[0-9a-f]{6});/g)) {
    if (name !== undefined && value !== undefined) map.set(name, value);
  }
  return map;
}

function luminance(hex: string): number {
  const channel = (since: number): number => {
    const value = Number.parseInt(hex.slice(since, since + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** [primer plano, fondo, mínimo]: 4,5 para texto (1.4.3) y 3 para componentes y estados (1.4.11). */
const PAIRS: ReadonlyArray<readonly [string, string, number]> = [
  ['on-surface', 'surface', 4.5],
  ['on-surface', 'surface-container', 4.5],
  ['on-surface', 'surface-container-high', 4.5],
  ['on-surface', 'surface-container-highest', 4.5],
  ['on-surface', 'surface-container-low', 4.5],
  ['on-surface-variant', 'surface', 4.5],
  ['on-surface-variant', 'surface-container', 4.5],
  ['on-surface-variant', 'surface-container-low', 4.5],
  ['on-surface-variant', 'surface-container-highest', 4.5],
  ['on-primary', 'primary', 4.5],
  ['on-primary-container', 'primary-container', 4.5],
  ['on-secondary-container', 'secondary-container', 4.5],
  ['on-tertiary-container', 'tertiary-container', 4.5],
  ['on-error', 'error', 4.5],
  ['on-error-container', 'error-container', 4.5],
  ['on-success-container', 'success-container', 4.5],
  ['on-warning-container', 'warning-container', 4.5],
  ['inverse-on-surface', 'inverse-surface', 4.5],
  ['inverse-primary', 'inverse-surface', 4.5],
  ['primary', 'surface', 4.5],
  ['primary', 'surface-container-low', 4.5],
  ['primary', 'surface-container', 4.5],
  ['primary', 'surface-container-high', 4.5],
  ['outline', 'surface', 3],
  ['outline', 'surface-container-low', 3],
  ['secondary', 'surface', 3],
  ['secondary', 'surface-container-low', 3],
  // UI-SIL-001 §3.3 (UI-16): pares nuevos o cambiados del rediseño. `success` es la desviación local provisional (UI-02, G-231).
  ['on-success', 'success', 4.5],
  ['success', 'surface', 4.5],
  ['success', 'success-container', 3],
  ['on-surface-variant', 'surface-container-high', 4.5],
  ['primary', 'surface-container-highest', 3],
  ['outline', 'surface-container-high', 3],
  ['outline', 'surface-container-highest', 3],
  ['secondary', 'surface-container-highest', 3],
  ['secondary', 'secondary-container', 3],
  // Texto principal y secundario: AAA (UI-SIL-001 §3.3).
  ['on-surface', 'surface', 7],
  ['on-surface-variant', 'surface', 7],
  // Color de marca fijo (anexo A1 §11.4 y §11.5, M-02): texto, anillo de foco y logotipo negativo sobre `brand`.
  ['on-brand', 'brand', 4.5],
  ['on-brand-variant', 'brand', 4.5],
];

describe.each(['light', 'dark'] as const)('contraste de los roles, esquema %s', (scheme) => {
  const map = roles(scheme);

  it('define todos los roles del par', () => {
    for (const [fg, bg] of PAIRS) {
      expect(map.has(fg), fg).toBe(true);
      expect(map.has(bg), bg).toBe(true);
    }
  });

  it.each(PAIRS)('%s sobre %s llega a %s:1', (fg, bg, min) => {
    const measured = contrast(map.get(fg) ?? '#000000', map.get(bg) ?? '#ffffff');
    expect(measured, `${fg}/${bg}: ${measured.toFixed(2)}`).toBeGreaterThanOrEqual(min);
  });
});

/**
 * Capas de estado de M3 (UI-SIL-001 §3.3, UI-16): el hover (8 %) y el foco o pulsado (10 %) pintan el color del
 * contenido sobre el fondo y pueden bajar el contraste del texto. Se mezcla como lo hace el navegador (alfa sobre
 * el fondo) y se mide el texto contra el resultado: ningún par baja de 4,5:1.
 */
function blend(foreground: string, background: string, alpha: number): string {
  const channel = (hex: string, since: number): number => Number.parseInt(hex.slice(since, since + 2), 16);
  const mixed = [1, 3, 5].map((since) => Math.round(channel(foreground, since) * alpha + channel(background, since) * (1 - alpha)));
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

const STATE_LAYER_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['on-primary', 'primary'],
  ['on-secondary-container', 'secondary-container'],
  ['on-primary-container', 'primary-container'],
  ['on-error-container', 'error-container'],
  ['on-success-container', 'success-container'],
  ['on-warning-container', 'warning-container'],
  ['primary', 'surface'],
  ['on-surface-variant', 'surface'],
];

describe.each(['light', 'dark'] as const)('capas de estado sobre el contenido, esquema %s', (scheme) => {
  const map = roles(scheme);

  it.each(STATE_LAYER_PAIRS)('%s sobre %s mantiene 4,5:1 con hover (8 %) y con foco o pulsado (10 %)', (fg, bg) => {
    const foreground = map.get(fg) ?? '#000000';
    const background = map.get(bg) ?? '#ffffff';
    for (const alpha of [0.08, 0.1]) {
      const measured = contrast(foreground, blend(foreground, background, alpha));
      expect(measured, `${fg}/${bg} con ${alpha * 100} %: ${measured.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('`outline-variant` es decorativo (UI-SIL-001 §3.3)', () => {
  it('no se usa como único límite de nada que deba verse: mide menos de 3:1 y ningún par lo exige', () => {
    expect(PAIRS.some(([fg, bg]) => fg === 'outline-variant' || bg === 'outline-variant')).toBe(false);
    expect(contrast(roles('light').get('outline-variant') ?? '#000000', roles('light').get('surface') ?? '#ffffff')).toBeLessThan(3);
  });
});

describe('`success` con croma 36: desviación local provisional de ADR-0228 (UI-02, G-231)', () => {
  const EXPECTED = {
    light: { success: '#406836', 'on-success': '#ffffff', 'success-container': '#c1efaf', 'on-success-container': '#012200' },
    dark: { success: '#a5d395', 'on-success': '#11380b', 'success-container': '#295020', 'on-success-container': '#c1efaf' },
  } as const;

  it.each(['light', 'dark'] as const)('emite los cuatro roles calculados con TonalPalette(145, 36), esquema %s', (scheme) => {
    for (const [role, hex] of Object.entries(EXPECTED[scheme])) expect(roles(scheme).get(role), role).toBe(hex);
  });

  it('el texto sobre el contenedor de éxito llega a 7:1 en ambos esquemas', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const map = roles(scheme);
      expect(contrast(map.get('on-success-container') ?? '#000000', map.get('success-container') ?? '#ffffff')).toBeGreaterThanOrEqual(7);
    }
  });

  it('queda marcado como provisional en el CSS generado', () => {
    expect(CSS).toMatch(/success[^\n]*PROVISIONAL|PROVISIONAL[^\n]*success/i);
  });
});

describe('el color de marca es fijo (anexo A1 §11.4, M-02)', () => {
  const GROUP = ['brand', 'on-brand', 'on-brand-variant'] as const;

  it('emite los mismos tres valores en el claro, en el oscuro por el sistema y en el oscuro explícito', () => {
    for (const role of GROUP) {
      const light = roles('light').get(role);
      expect(light, role).toMatch(/^#[0-9a-f]{6}$/);
      expect(roles('dark', 'system').get(role), role).toBe(light);
      expect(roles('dark').get(role), role).toBe(light);
    }
  });

  it('brand es la semilla de D-023 y no cambia primary: el esquema de M3 sigue anclado a la semilla', () => {
    expect(roles('light').get('brand')).toBe('#0f3e67');
    expect(roles('light').get('primary')).toBe('#36618e');
    expect(roles('dark').get('primary')).toBe('#a0cafd');
  });

  it('el isotipo negativo (on-brand) sobre la barra en oscuro llega a 3:1 (§11.5)', () => {
    const dark = roles('dark');
    expect(contrast(dark.get('on-brand') ?? '#000000', dark.get('surface') ?? '#ffffff')).toBeGreaterThanOrEqual(3);
  });

  it('el isotipo en color solo se mide en claro: sobre surface oscuro no llega a 3:1 y por eso se usa el negativo (§11.5)', () => {
    const flag = roles('light').get('brand') ?? '#000000';
    expect(contrast(flag, roles('light').get('surface') ?? '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrast(flag, roles('dark').get('surface') ?? '#000000')).toBeLessThan(3);
  });
});

describe('el oscuro por el sistema y el oscuro explícito son el mismo esquema', () => {
  it('declaran los mismos valores', () => {
    expect([...roles('dark', 'system')]).toEqual([...roles('dark', 'attribute')]);
  });
});

describe('theme-color sale del token surface (anexo A1 §9.3)', () => {
  it('coincide con surface en cada esquema', () => {
    expect(THEME_COLOR.light).toBe(roles('light').get('surface'));
    expect(THEME_COLOR.dark).toBe(roles('dark').get('surface'));
  });
});
