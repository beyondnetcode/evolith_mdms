import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * Notificaciones de la suite: sus datos de ejemplo ya no forman parte del catálogo activo del mock.
 * Vuelven al rehacer sus escenarios.
 */
const OUT_OF_SCOPE = [
  'libs/suite-shell/src/presentation/header/notifications.test.tsx',
  'libs/suite-mock/src/notifications.test.ts',
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Las entradas `/testing` van antes que su librería: el alias se resuelve por prefijo.
      '@mdm/app/testing': resolve(import.meta.dirname, 'libs/mdm-app/src/testing/index.ts'),
      '@mdm/app': resolve(import.meta.dirname, 'libs/mdm-app/src/index.ts'),
      '@mdm/contracts': resolve(import.meta.dirname, 'libs/mdm-contracts/src/index.ts'),
      '@mdm/mock': resolve(import.meta.dirname, 'libs/mdm-mock/src/index.ts'),
      '@sil/ui/testing': resolve(import.meta.dirname, 'libs/ui-sil/src/testing/index.ts'),
      '@sil/ui': resolve(import.meta.dirname, 'libs/ui-sil/src/index.ts'),
      '@sil/ui-tokens': resolve(import.meta.dirname, 'libs/ui-tokens/src/index.ts'),
      '@suite/contracts': resolve(import.meta.dirname, 'libs/suite-contracts/src/index.ts'),
      '@suite/header': resolve(import.meta.dirname, 'libs/suite-header/src/index.ts'),
      '@suite/mock': resolve(import.meta.dirname, 'libs/suite-mock/src/index.ts'),
      '@suite/shell': resolve(import.meta.dirname, 'libs/suite-shell/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: [resolve(import.meta.dirname, 'vitest.setup.ts')],
    include: ['apps/**/src/**/*.test.{ts,tsx}', 'libs/**/src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', ...OUT_OF_SCOPE],
    css: false,
    restoreMocks: true,
    // Las pruebas de pantalla completa con user-event tardan más de 5 s cuando la puerta corre lint, build y
    // pruebas en paralelo: con el tope por defecto fallaban por tiempo, no por comportamiento.
    testTimeout: 20_000,
  },
});
