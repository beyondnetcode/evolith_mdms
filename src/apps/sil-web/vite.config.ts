import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { SECURITY_HEADERS } from './security-headers.ts';
// eslint-disable-next-line @nx/enforce-module-boundaries -- la configuración de Vite se carga en Node antes de que existan los alias del espacio de trabajo.
import { THEME_COLOR } from '../../libs/ui-tokens/src/theme-color.generated.ts';

const raizWorkspace = resolve(import.meta.dirname, '../..');

/**
 * Las etiquetas `theme-color` (barra del navegador móvil) las emite el generador de tokens, no se
 * escriben a mano en `index.html` (anexo A1 §9.3, ADR-0110 P-UX-04: origen único). Van al inicio del
 * <head>, antes del script de arranque del tema, que las lee.
 */
function themeColor(): Plugin {
  return {
    name: 'sil-theme-color',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { name: 'theme-color', content: THEME_COLOR.light, media: '(prefers-color-scheme: light)' }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'theme-color', content: THEME_COLOR.dark, media: '(prefers-color-scheme: dark)' }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), tailwindcss(), themeColor()],
  resolve: {
    alias: {
      // Las entradas `/testing` van antes que su librería: el alias se resuelve por prefijo.
      '@mdm/app/testing': resolve(raizWorkspace, 'libs/mdm-app/src/testing/index.ts'),
      '@mdm/app': resolve(raizWorkspace, 'libs/mdm-app/src/index.ts'),
      '@mdm/contracts': resolve(raizWorkspace, 'libs/mdm-contracts/src/index.ts'),
      '@mdm/mock': resolve(raizWorkspace, 'libs/mdm-mock/src/index.ts'),
      '@sil/ui/testing': resolve(raizWorkspace, 'libs/ui-sil/src/testing/index.ts'),
      '@sil/ui': resolve(raizWorkspace, 'libs/ui-sil/src/index.ts'),
      '@sil/ui-tokens': resolve(raizWorkspace, 'libs/ui-tokens/src/index.ts'),
      '@suite/contracts': resolve(raizWorkspace, 'libs/suite-contracts/src/index.ts'),
      '@suite/header': resolve(raizWorkspace, 'libs/suite-header/src/index.ts'),
      '@suite/mock': resolve(raizWorkspace, 'libs/suite-mock/src/index.ts'),
      '@suite/shell': resolve(raizWorkspace, 'libs/suite-shell/src/index.ts'),
    },
  },
  server: { host: '127.0.0.1', port: 4200, strictPort: true, fs: { allow: [raizWorkspace] } },
  // El preview sirve el build con las cabeceras de ADR-0165 §2.2: es donde se comprueba la CSP real (G-150).
  preview: { host: '127.0.0.1', port: 4300, strictPort: true, headers: { ...SECURITY_HEADERS } },
  // Sin mapas de fuente en producción: no se publica el código original (ADR-0165 P-SEC-05).
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false, target: 'es2023' },
});
