#!/usr/bin/env node
/**
 * Audita el presupuesto de bundle del frontend antes de cada release (ADR-0109 P-FE-09, §2.11).
 *
 * Suma, comprimido con gzip, lo que `dist/index.html` obliga a descargar antes de la primera pantalla
 * (script de entrada, `modulepreload` y hojas de estilo) y lo compara con `presupuesto-bundle.json`.
 * Las rutas cargadas con `lazy()` quedan fuera: no son parte de la carga inicial.
 *
 * Uso: node scripts/presupuesto-bundle.mjs [directorio-de-la-app]   (por defecto src/apps/sil-web)
 * Salida: 0 dentro del presupuesto; 1 si lo supera o falta el build.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const app = resolve(process.argv[2] ?? resolve(import.meta.dirname, '../src/apps/sil-web'));
const dist = resolve(app, 'dist');
const index = resolve(dist, 'index.html');
if (!existsSync(index)) {
  console.error(`No hay build en ${dist}: ejecuta antes \`npm run build\` en src/apps/sil-web.`);
  process.exit(1);
}
const budget = JSON.parse(readFileSync(resolve(app, 'presupuesto-bundle.json'), 'utf8'));
const html = readFileSync(index, 'utf8');

const refs = (pattern) => [...html.matchAll(pattern)].map((match) => match[1]).filter((ref) => ref.startsWith('/assets/'));
const js = [...new Set([...refs(/<script[^>]+src="([^"]+)"/g), ...refs(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)])];
const css = [...new Set(refs(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g))];

const gzipKB = (ref) => gzipSync(readFileSync(resolve(dist, ref.slice(1)))).length / 1024;
const total = (files) => files.reduce((sum, file) => sum + gzipKB(file), 0);

const rows = [
  ['JavaScript inicial', total(js), budget.jsInicialGzipKB],
  ['CSS inicial', total(css), budget.cssInicialGzipKB],
];
let failed = false;
for (const [name, used, limit] of rows) {
  const ok = used <= limit;
  if (!ok) failed = true;
  console.log(`${ok ? 'OK ' : 'X  '} ${name}: ${used.toFixed(1)} kB gzip de ${limit} kB`);
}
if (failed) console.error('Se superó el presupuesto de bundle: justifícalo en DECISIONS.md o corrígelo (P-FE-09).');
process.exit(failed ? 1 : 0);
