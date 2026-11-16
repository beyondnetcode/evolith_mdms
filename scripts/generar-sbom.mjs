#!/usr/bin/env node
/**
 * Genera el SBOM del build (ADR-0165 P-SEC-03, §2.4): inventario CycloneDX 1.5 de las dependencias de
 * producción del frontend, archivado junto al artefacto en `src/apps/sil-web/dist/sbom.cdx.json`.
 *
 * No usa `npm sbom`: con `overrides` que apuntan a una dependencia directa (`"react": "$react"`) omite en
 * silencio esos paquetes —medido aquí: salían 5 componentes sin `react`, `react-dom` ni `scheduler`—, y un
 * inventario incompleto es peor que ninguno. Se arma desde `npm ls --omit=dev --all`, que sí los ve, y se
 * completa con la integridad del `package-lock.json`. Sin dependencias nuevas.
 *
 * Uso: node scripts/generar-sbom.mjs      (requiere `npm ci` previo)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const src = resolve(raiz, 'src');
const dist = resolve(src, 'apps/sil-web/dist');

// Sin `shell`: con npm se reutiliza el ejecutable que lanzó el script; solo se cae a `npm` si se ejecuta suelto.
const lsArgs = ['ls', '--omit=dev', '--all', '--json'];
const [command, args] = process.env.npm_execpath ? [process.execPath, [process.env.npm_execpath, ...lsArgs]] : ['npm', lsArgs];
const tree = JSON.parse(execFileSync(command, args, { cwd: src, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
const lock = JSON.parse(readFileSync(resolve(src, 'package-lock.json'), 'utf8')).packages;

/** Aplana el árbol de `npm ls` a `nombre@versión`, sin repetidos. */
function collect(dependencies, found = new Map()) {
  for (const [name, node] of Object.entries(dependencies ?? {})) {
    if (node.version !== undefined) found.set(`${name}@${node.version}`, { name, version: node.version });
    collect(node.dependencies, found);
  }
  return found;
}
const packages = [...collect(tree.dependencies).values()].sort((a, b) => a.name.localeCompare(b.name));

const purl = ({ name, version }) => `pkg:npm/${name.startsWith('@') ? `%40${name.slice(1)}` : name}@${version}`;
const hashOf = (name) => {
  const integrity = lock[`node_modules/${name}`]?.integrity;
  const match = /^sha512-(.+)$/.exec(integrity ?? '');
  return match?.[1] === undefined ? [] : [{ alg: 'SHA-512', content: Buffer.from(match[1], 'base64').toString('hex') }];
};

const direct = Object.keys(tree.dependencies ?? {});
const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: { timestamp: new Date().toISOString(), component: { type: 'application', name: 'sil-web', version: tree.version ?? '0.0.0' } },
  components: packages.map((pkg) => ({
    type: 'library',
    name: pkg.name,
    version: pkg.version,
    purl: purl(pkg),
    scope: direct.includes(pkg.name) ? 'required' : 'optional',
    hashes: hashOf(pkg.name),
  })),
};

// El inventario no puede omitir lo que la aplicación declara: si falta una dependencia directa, el gate falla.
const declared = Object.keys(JSON.parse(readFileSync(resolve(src, 'package.json'), 'utf8')).dependencies ?? {});
const missing = declared.filter((name) => !packages.some((pkg) => pkg.name === name));
if (missing.length > 0) {
  console.error(`El SBOM no incluye dependencias declaradas: ${missing.join(', ')}`);
  process.exit(1);
}

mkdirSync(dist, { recursive: true });
writeFileSync(resolve(dist, 'sbom.cdx.json'), `${JSON.stringify(sbom, null, 2)}\n`, 'utf8');
console.log(`SBOM CycloneDX con ${packages.length} componentes en src/apps/sil-web/dist/sbom.cdx.json`);
