import { defineConfig, devices } from '@playwright/test';

/**
 * `PW_CHANNEL=msedge` (o `chrome`) usa el navegador instalado en el equipo en vez del Chromium que
 * descarga Playwright: sirve donde no se pueden descargar navegadores. Sin la variable, nada cambia.
 */
const channel = process.env.PW_CHANNEL;
const browser = { ...devices['Desktop Chrome'], ...(channel === undefined || channel === '' ? {} : { channel }) };

/**
 * E2E de navegador (ADR-0109 §2.12): flujos y accesibilidad (axe) en los tres tamaños de
 * ventana que más cambian la interfaz. Levanta el servidor de desarrollo si no hay uno.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4200', trace: 'retain-on-failure', locale: 'es-PE', timezoneId: 'America/Lima' },
  projects: [
    { name: 'compact', use: { ...browser, viewport: { width: 412, height: 915 } } },
    { name: 'medium', use: { ...browser, viewport: { width: 768, height: 1024 } } },
    { name: 'expanded', use: { ...browser, viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npm run dev:sil-web',
    cwd: '../..',
    url: 'http://127.0.0.1:4200',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
