import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Higiene de tokens (UI-SIL-001 §3.12, UI-16, UI-13; ADR-0110 P-UX-01 y P-UX-04): ningún componente lleva
 * un valor crudo de color o de forma, un peso fuera de la escala ni un espaciado fuera de la rejilla. La
 * prueba lee el código fuente (no las pruebas ni `ui-tokens`, que es donde viven los valores) y falla si
 * encuentra el patrón: es la puerta que impide que el sistema se erosione sin que nadie lo vea.
 */
const SRC = resolve(import.meta.dirname, '../../..');
const ROOTS = ['libs', 'apps/sil-web/src'];
const SKIPPED_FOLDERS = new Set(['node_modules', 'dist', 'testing', 'ui-tokens']);

function sources(folder: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_FOLDERS.has(entry.name)) found.push(...sources(join(folder, entry.name)));
    } else if (/\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(join(folder, entry.name));
    }
  }
  return found;
}

/** El código sin comentarios de línea completa ni de bloque: un comentario puede citar un valor sin usarlo. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
}

/**
 * Excepciones declaradas a la rejilla de 4 dp (UI-SIL-001 §3.7): la geometría del interruptor de M3 (pista de
 * 52 × 32 dp con un óvalo de 16 dp en reposo y de 24 dp activo) se construye con pasos de 2 dp.
 */
const GRID_EXCEPTIONS: ReadonlySet<string> = new Set(['libs/ui-sil/src/Switch.tsx']);

const FILES = ROOTS.flatMap((root) => sources(join(SRC, root)));

function offenders(pattern: RegExp, only = /\.(tsx?|css)$/, skip: ReadonlySet<string> = new Set()): string[] {
  return FILES.filter((file) => only.test(file) && !skip.has(relative(SRC, file))).flatMap((file) =>
    [...code(file).matchAll(pattern)].map((match) => `${relative(SRC, file)}: ${match[0]}`),
  );
}

describe('higiene de tokens en los componentes', () => {
  it('hay código que revisar', () => {
    expect(FILES.length).toBeGreaterThan(100);
  });

  it('ningún literal de color (#rrggbb, rgb(), hsl(), oklch()) fuera de ui-tokens', () => {
    expect(offenders(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g)).toEqual([]);
  });

  it('ningún valor arbitrario entre corchetes en las utilidades de color, forma, tamaño o espaciado', () => {
    const property =
      '(?:bg|text|border|ring|outline|fill|stroke|shadow|rounded|w|h|min-w|min-h|max-w|max-h|size|p[xytblr]?|m[xytblr]?|gap(?:-[xy])?|top|left|right|bottom|inset(?:-[xy])?|grid-cols|grid-rows|leading|tracking|duration|ease|z)';
    expect(offenders(new RegExp(`(?<![\\w-])${property}-\\[[^\\]]+\\]`, 'g'), /\.tsx$/)).toEqual([]);
  });

  it('solo existen los pesos 400 y 500, y el 500 sale de un token tipográfico, no de `font-*` (D-023, UI-05)', () => {
    expect(offenders(/(?<![\w-])font-(?:thin|extralight|light|medium|semibold|bold|extrabold|black)\b/g, /\.tsx$/)).toEqual([]);
    expect(offenders(/font-weight:\s*(?:[1-35-9]00|[0-9]{4})\b/g, /\.css$/)).toEqual([]);
  });

  it('`tertiary` está reservado y no se usa en ningún componente (UI-SIL-001 §3.2)', () => {
    expect(offenders(/(?<![\w-])(?:bg|text|border|fill|stroke)-(?:on-)?tertiary\b/g, /\.tsx$/)).toEqual([]);
  });

  it('ninguna etiqueta de estado pinta el relleno `primary` sólido ni `success-container` (UI-01)', () => {
    const label = FILES.filter((file) => /(?:StatusBadge|CreditTrafficLight|DeliveryBadge|Tag)\.tsx$/.test(file));
    expect(label.length).toBeGreaterThan(0);
    expect(label.flatMap((file) => [...code(file).matchAll(/(?<![\w-])bg-primary(?![\w-])|bg-success-container/g)].map((m) => `${file}: ${m[0]}`))).toEqual([]);
  });

  it('ninguna tarjeta mezcla relleno y borde a la vez (UI-06)', () => {
    const mixed = FILES.filter((file) => file.endsWith('.tsx')).flatMap((file) =>
      [...code(file).matchAll(/(?:className=|['"`])([^'"`\n]*)['"`]/g)]
        .map((match) => match[1] ?? '')
        .filter((classes) => /(?<![\w-])border(?:-outline-variant)?(?![\w-])/.test(classes) && /(?<![\w-])bg-surface-container(?:-low|-high|-highest)?(?![\w-])/.test(classes))
        .map((classes) => `${relative(SRC, file)}: ${classes}`),
    );
    expect(mixed).toEqual([]);
  });

  it('ningún sombreado fuera de `shadow-level-*` ni opacidad que imite un rol de fondo (UI-SIL-001 §3.6)', () => {
    expect(offenders(/(?<![\w-])shadow-(?!level-[0-5]\b|none\b)[a-z0-9]+/g, /\.tsx$/)).toEqual([]);
    expect(offenders(/(?<![\w-])hover:bg-on-surface\/\d+|focus-within:bg-on-surface\/\d+/g, /\.tsx$/)).toEqual([]);
  });

  it('el espaciado está en la rejilla de 4 dp: sin pasos de 2, 6, 10, 14 dp ni la altura de 52 dp (UI-13)', () => {
    expect(offenders(/(?<![\w-])(?:p[xytblr]?|m[xytblr]?|gap(?:-[xy])?|space-[xy])-(?:0\.5|1\.5|2\.5|3\.5)(?![\w.])/g, /\.tsx$/, GRID_EXCEPTIONS)).toEqual([]);
    expect(offenders(/(?<![\w-])h-13(?![\w.])/g, /\.tsx$/)).toEqual([]);
  });

  it('ninguna fila de tabla usa `state-layer`: su `::before` se vuelve una celda y desplaza las columnas (usa `row-state`)', () => {
    expect(offenders(/<tr\b[^>]*\bstate-layer\b/g, /\.tsx$/)).toEqual([]);
  });

  it('ninguna duración de movimiento escrita como literal en las utilidades de los componentes (UI-10)', () => {
    expect(offenders(/(?<![\w-])duration-\d+/g, /\.tsx$/)).toEqual([]);
  });
});

describe('la hoja de estilos de tokens (UI-10)', () => {
  const css = readFileSync(resolve(import.meta.dirname, 'theme.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('las duraciones y las opacidades de las capas de estado son variables, no literales', () => {
    const outsideTokens = css
      .split('\n')
      .filter((line) => !/^\s*--[\w-]+:/.test(line))
      .filter((line) => /(?<![\w-])\d+(?:\.\d+)?m?s\b(?!\))/.test(line) && !/^\s*@/.test(line));
    expect(outsideTokens).toEqual([]);
  });
});
