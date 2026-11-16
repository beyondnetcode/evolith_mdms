import { MOCK_SESSION_KEY, createTestSession, type TestSessionOptions } from '@suite/mock';
import { expect, test as base, type Page } from '@playwright/test';

/**
 * AYUDANTE DE PRUEBAS E2E (anexo A1 §7.5, G-176): siembra la sesión de la suite en `sessionStorage`
 * antes de que la página cargue, como si ya se hubiera iniciado sesión, sin pasar por S-01. Sustituye
 * al antiguo selector de perfil simulado. La sesión no lleva credenciales. Se siembra una sola vez por
 * pestaña: si la prueba cierra la sesión, una recarga no la resucita.
 */
export async function seedSession(page: Page, options: TestSessionOptions): Promise<void> {
  const session = JSON.stringify(createTestSession(options));
  await page.addInitScript(
    ([key, value]) => {
      if (globalThis.sessionStorage.getItem('e2e.sembrada') !== null) return;
      globalThis.sessionStorage.setItem('e2e.sembrada', '1');
      if (key !== undefined && value !== undefined) globalThis.sessionStorage.setItem(key, value);
    },
    [MOCK_SESSION_KEY, session],
  );
}

interface Options {
  /** Sesión sembrada; por defecto, Customer Service de Callao. `null`: sin sesión. */
  readonly session: TestSessionOptions | null;
}

export const test = base.extend<Options>({
  session: [{ role: 'CUSTOMER_SERVICE' }, { option: true }],
  page: async ({ page, session }, provide) => {
    if (session !== null) await seedSession(page, session);
    await provide(page);
  },
});


/**
 * Elige un usuario de prueba en S-01 (R-03): la lista vive en un menú que se abre con «Usuarios de prueba»; elegir a
 * alguien rellena los campos y deja el foco en «Iniciar sesión».
 */
export async function chooseTestUser(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Usuarios de prueba' }).click();
  await page.getByRole('menuitem', { name: `Usar a ${name}` }).click();
}

export { expect };
