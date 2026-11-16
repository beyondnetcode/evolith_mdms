/**
 * Cadena de tokens de SIL (ADR-0110 §2.2, P-UX-04: origen único):
 *
 *   tokens/*.json (DTCG) ── Style Dictionary ──▶ CSS Variables ──▶ bloque `@theme` de Tailwind v4
 *
 * Tres niveles, como manda el estándar:
 *   1. Global    `md.ref.*`   valores crudos (rampas de color, formas, sombras, curvas). Ningún componente
 *                             los consume: por eso no se emiten como variables CSS.
 *   2. Alias     `md.sys.*`   propósito de diseño; es la ÚNICA capa que consumen los componentes.
 *   3. Component `md.comp.*`  valores propios de un control (objetivo táctil, anillo de foco, diálogos).
 *
 * Lo único que no está escrito a mano es la rampa tonal: se genera desde la semilla con HCT
 * (`@material/material-color-utilities`, ADR-0110 §2.7) en `tokens/global/palette.generated.json`. Los roles de
 * color son alias de esa rampa (`tokens/alias/color.{light,dark}.json`) y el script comprueba que cada uno
 * coincide con el que calcula M3 (`MaterialDynamicColors`): si el mapeo se desvía, el build falla.
 *
 * Salidas versionadas (no editar a mano):
 *   src/colors.generated.css       roles de color: claro, oscuro por el sistema y oscuro explícito
 *   src/tokens.generated.css       resto de alias `md.sys.*` y de `md.comp.*` como variables en `:root`
 *   src/theme-map.generated.css    bloque `@theme inline` que da a Tailwind una utilidad por token
 *   src/theme-color.generated.ts   `theme-color` de la barra del navegador móvil
 *
 * Ejecutar: `npm run tokens:generate` (desde `src/`). Con `--check` no escribe: falla si algo está desfasado.
 *
 * `success` y `warning` no son roles de M3: colores personalizados PROVISIONALES. `warning` con los valores de
 * ADR-0228 §2.6 (`Borrador`, G-123). `success` con croma 36: DESVIACIÓN LOCAL PROVISIONAL de esos valores (UI-02,
 * G-231). La paleta de ADR-0228 tiene croma 50 (un verde neón); el rediseño aprobado (UI-SIL-001 §3.2) la regenera
 * con croma 36 y tono 142 (el anexo escribe «tono 145», pero sus ocho valores hexadecimales salen de 142), el mismo
 * croma que M3 da a la paleta primaria, y con los tonos canónicos de M3 para los cuatro roles (claro 40, 100, 90 y
 * 10; oscuro 80, 20, 30 y 90). Su rampa se genera aquí (`md.ref.palette.success`) y los alias la referencian. Se
 * sustituirá cuando ADR-0228 se acepte.
 * `brand` es el color de marca FIJO en ambos esquemas (anexo A1 §11.4, G-196).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import StyleDictionary from 'style-dictionary';
import { runnerImport } from 'vite';

const CHECK = process.argv.includes('--check');
const SEED = '#0f3e67';
const ROOT = resolve(import.meta.dirname, '..');
const TOKENS = resolve(ROOT, 'tokens');
const SRC = resolve(ROOT, 'src');
const TONES = [0, 4, 6, 10, 12, 17, 20, 22, 24, 25, 30, 35, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95, 96, 98, 99, 100];

// `@material/material-color-utilities` publica ESM sin extensiones y Node no lo resuelve de forma nativa:
// se carga con el ejecutor de módulos de Vite.
const { module: m } = await runnerImport('@material/material-color-utilities');
const { Hct, SchemeTonalSpot, MaterialDynamicColors, TonalPalette, argbFromHex, hexFromArgb } = m;

/** Rol M3 (nombre en MaterialDynamicColors) que el script verifica contra los alias de color. */
const ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant', 'surfaceDim', 'surfaceBright',
  'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer', 'surfaceContainerHigh', 'surfaceContainerHighest',
  'outline', 'outlineVariant', 'inverseSurface', 'inverseOnSurface', 'inversePrimary', 'scrim', 'shadow', 'surfaceTint',
];
const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

// ---------------------------------------------------------------- 1. Rampa tonal (nivel Global)
const seedScheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(SEED)), false, 0);
const palettes = {
  primary: seedScheme.primaryPalette,
  secondary: seedScheme.secondaryPalette,
  tertiary: seedScheme.tertiaryPalette,
  error: seedScheme.errorPalette,
  neutral: seedScheme.neutralPalette,
  'neutral-variant': seedScheme.neutralVariantPalette,
  // Color personalizado `success` (UI-02, G-231): tono 142 y croma 36, provisional hasta que ADR-0228 se acepte.
  success: TonalPalette.fromHueAndChroma(142, 36),
};
const palette = {
  $description: `Rampas tonales generadas desde la semilla ${SEED} con HCT (variante TonalSpot, D-023); \`success\`, desde tono 142 y croma 36 (provisional, UI-02, G-231). No editar a mano: la regenera build-tokens.mjs.`,
};
for (const [name, tonal] of Object.entries(palettes)) {
  palette[name] = Object.fromEntries(TONES.map((tone) => [String(tone), { $value: hexFromArgb(tonal.tone(tone)), $type: 'color' }]));
}
const paletteFile = resolve(TOKENS, 'global/palette.generated.json');
const paletteJson = `${JSON.stringify({ md: { ref: { palette } } }, null, 2)}\n`;
const outputs = new Map([[paletteFile, paletteJson]]);
// Style Dictionary lee la rampa del disco: se escribe antes de construir (con --check, solo si cambió).
if (!CHECK) writeFileSync(paletteFile, paletteJson, 'utf8');

// ---------------------------------------------------------------- 2. Style Dictionary
const isSystem = (token) => token.path[1] === 'sys';
const isColor = (token) => isSystem(token) && token.path[2] === 'color';
const isPlainValue = (token) => (isSystem(token) && !isColor(token)) || token.path[1] === 'comp';

StyleDictionary.registerFormat({
  name: 'sil/css-declarations',
  format: ({ dictionary }) => dictionary.allTokens.map((token) => `  --${token.name}: ${token.$value};`).join('\n'),
});

/** Línea de `@theme inline` de cada token alias: una utilidad de Tailwind por token (ADR-0110 §2.2, punto 3). */
function themeLine(token) {
  const [, , group, ...rest] = token.path;
  const own = `var(--${token.name})`;
  const key = rest.join('-');
  if (group === 'color') return `  --color-${key}: ${own};`;
  if (group === 'shape') return `  --radius-${rest.slice(1).join('-')}: ${own};`;
  if (group === 'elevation') return `  --shadow-${key}: ${own};`;
  if (group === 'typeface') return `  --font-sans: ${own};`;
  if (group === 'window') return `  --breakpoint-${key}: ${token.$value};`; // un `@media` no admite var(): valor literal
  if (group === 'motion' && rest[0] === 'easing') return `  --ease-${rest.slice(1).join('-')}: ${own};`;
  if (group === 'typescale') {
    const [style, property] = rest;
    const suffix = { size: '', 'line-height': '--line-height', weight: '--font-weight', tracking: '--letter-spacing' }[property];
    return `  --text-${style}${suffix}: ${own};`;
  }
  return undefined; // duración y estado se consumen como variables, sin utilidad propia
}
StyleDictionary.registerFormat({
  name: 'sil/tailwind-theme',
  format: ({ dictionary }) =>
    dictionary.allTokens
      .map(themeLine)
      .filter((line) => line !== undefined)
      .join('\n'),
});

const list = (dir, pick) =>
  readdirSync(resolve(TOKENS, dir))
    .filter(pick)
    .map((file) => `${TOKENS}/${dir}/${file}`);

async function build(mode, files) {
  const dictionary = new StyleDictionary({
    usesDtcg: true,
    log: { warnings: 'warn', verbosity: 'default' },
    source: [
      ...list('global', (file) => file.endsWith('.json')),
      ...list('alias', (file) => !file.startsWith('color.') || file === `color.${mode}.json`),
      ...list('component', (file) => file.endsWith('.json')),
    ],
    platforms: { css: { transformGroup: 'css', files } },
  });
  const formatted = await dictionary.formatPlatform('css');
  return new Map(formatted.map(({ destination, output }) => [destination, output]));
}

const light = await build('light', [
  { destination: 'colors', format: 'sil/css-declarations', filter: isColor },
  { destination: 'tokens', format: 'sil/css-declarations', filter: isPlainValue },
  { destination: 'theme', format: 'sil/tailwind-theme', filter: isSystem },
]);
const dark = await build('dark', [{ destination: 'colors', format: 'sil/css-declarations', filter: isColor }]);

// ---------------------------------------------------------------- 3. Verificación contra M3
function declared(output) {
  return new Map([...output.matchAll(/--md-sys-color-([a-z-]+): (#[0-9a-f]{6});/g)].map(([, name, value]) => [name, value]));
}
for (const [mode, output] of [['light', light.get('colors')], ['dark', dark.get('colors')]]) {
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(SEED)), mode === 'dark', 0);
  const tokens = declared(output);
  for (const role of ROLES) {
    const expected = hexFromArgb(MaterialDynamicColors[role].getArgb(scheme));
    const actual = tokens.get(kebab(role));
    if (actual !== expected) throw new Error(`El rol ${kebab(role)} (${mode}) vale ${actual} y M3 calcula ${expected}: corrige tokens/alias/color.${mode}.json`);
  }
}

// ---------------------------------------------------------------- 4. Salidas
const indent = (text, spaces) => text.replace(/^/gm, ' '.repeat(spaces));
const generated = (what) =>
  `/*\n * GENERADO por libs/ui-tokens/scripts/build-tokens.mjs desde tokens/*.json con Style Dictionary. No editar a mano.\n * ${what}\n */\n`;

outputs.set(
  resolve(SRC, 'colors.generated.css'),
  generated(
    `Roles de color de M3 desde la semilla ${SEED} (D-023): claro, oscuro por el sistema y oscuro explícito.\n * success: PROVISIONAL, croma 36 (desviación local de ADR-0228 §2.6, UI-02, G-231). warning: provisional de ADR-0228 §2.6 (Borrador, G-123).\n * brand, on-brand y on-brand-variant: color de marca FIJO en ambos esquemas (anexo A1 §11.4, G-196).`,
  ) +
    `:root,\n:root[data-theme='light'] {\n  color-scheme: light;\n${light.get('colors')}\n}\n\n` +
    `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme='light']) {\n    color-scheme: dark;\n${indent(dark.get('colors'), 2)}\n  }\n}\n\n` +
    `:root[data-theme='dark'] {\n  color-scheme: dark;\n${dark.get('colors')}\n}\n`,
);
outputs.set(
  resolve(SRC, 'tokens.generated.css'),
  `${generated('Alias md.sys.* (salvo el color) y tokens de componente md.comp.*, como variables CSS. Los globales md.ref.* no se emiten: ningún componente los consume.')}:root {\n${light.get('tokens')}\n}\n`,
);
outputs.set(
  resolve(SRC, 'theme-map.generated.css'),
  `${generated('Mapa de los alias md.sys.* al espacio de nombres de Tailwind v4: cada token genera su utilidad (ADR-0110 §2.2).')}@theme inline {\n${light.get('theme')}\n}\n`,
);

const surface = (mode) => (mode === 'light' ? light : dark).get('colors').match(/--md-sys-color-surface: (#[0-9a-f]{6});/)?.[1];
outputs.set(
  resolve(SRC, 'theme-color.generated.ts'),
  `/*\n * GENERADO por libs/ui-tokens/scripts/build-tokens.mjs. No editar a mano.\n * Color de \`surface\` en cada esquema para \`<meta name="theme-color">\` (anexo A1 §9.3).\n */\nexport const THEME_COLOR = {\n  light: '${surface('light')}',\n  dark: '${surface('dark')}',\n} as const;\n`,
);

let stale = 0;
for (const [file, content] of outputs) {
  let current = '';
  try {
    current = readFileSync(file, 'utf8');
  } catch {
    // no existe todavía: se escribe
  }
  if (current === content) continue;
  stale += 1;
  if (CHECK) console.error(`Desfasado: ${file}`);
  else writeFileSync(file, content, 'utf8');
}
if (CHECK && stale > 0) {
  console.error('Los tokens generados no coinciden con tokens/*.json. Ejecuta `npm run tokens:generate`.');
  process.exit(1);
}
console.log(CHECK ? 'Tokens al día.' : `Tokens generados (${stale} archivo(s) actualizados).`);
