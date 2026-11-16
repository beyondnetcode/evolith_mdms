import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { chooseTestUser, expect, test } from './fixtures.ts';

/**
 * MDM en el navegador (D-044, D-046; UX-MDM-001 y UI-MDM-001): el flujo principal de la analista de datos maestros
 * contra el mock, el mantenimiento de tipos de rol y axe en P-MDM-01, P-MDM-02 (sus siete secciones), P-MDM-03 y
 * P-MDM-04, en los tres tamaños de ventana del
 * `playwright.config.ts`, en claro y en oscuro. La herramienta automática no acredita conformidad (ADR-0110 §2.8):
 * detecta una parte de los defectos; el resto se prueba con teclado y lector de pantalla (G-140, G-569).
 */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const ORG_ID = 'b0000000-0000-4000-8000-000000000001';

async function violationsList(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

/** La entrada de un diálogo es un fundido: axe mide el contraste con la opacidad a medias. */
const waitForAnimations = (page: Page): Promise<unknown> =>
  page.evaluate(() =>
    Promise.all((document.querySelector('dialog[open]')?.getAnimations() ?? []).map((animation) => animation.finished.catch(() => undefined))),
  );

test.describe('flujo de la analista de datos maestros', () => {
  test.use({ session: null });

  test('entra, busca, abre ORG, asigna un rol y abre un establecimiento', async ({ page }) => {
    await page.goto('/mdm/organizaciones');
    await expect(page.getByRole('heading', { level: 1, name: 'Inicia sesión' })).toBeVisible();
    await chooseTestUser(page, 'Rosa Medina');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Organizaciones' })).toBeVisible();

    // Las celdas quedan bajo su encabezado: una capa de estado mal aplicada a la fila desplazaba las columnas.
    // En `compact` la lista es de tarjetas, sin tabla.
    const table = page.getByRole('table');
    if (await table.isVisible()) {
      const codeHeader = await table.getByRole('columnheader', { name: /^Código/ }).boundingBox();
      const firstCode = await table.getByRole('row').nth(1).getByRole('cell').first().boundingBox();
      expect(Math.round(firstCode?.x ?? -1)).toBe(Math.round(codeHeader?.x ?? -2));
    }

    const search = page.getByRole('searchbox', { name: 'Buscar por código, razón social o nombre comercial' });
    await search.fill('organizacion');
    await search.press('Enter');
    await page.getByRole('link', { name: 'ORG', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'ORG' })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/mdm/organizaciones/${ORG_ID}`));

    await page.getByRole('tab', { name: 'Roles (1)' }).click();
    await page.getByRole('button', { name: 'Asignar rol' }).click();
    const dialog = page.getByRole('dialog', { name: 'Asignar rol' });
    await expect(dialog.getByRole('combobox', { name: 'Tipo de rol (obligatorio)' })).toBeFocused();
    await dialog.getByRole('combobox', { name: 'Tipo de rol (obligatorio)' }).selectOption({ label: 'Cliente (CUSTOMER)' });
    await dialog.getByRole('button', { name: 'Asignar' }).click();
    await expect(page.getByText('Rol asignado.')).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('tab', { name: 'Roles (2)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Asignar rol' })).toBeFocused();

    await page.getByRole('tab', { name: 'Establecimientos (2)' }).click();
    await expect(page.getByText('PIURA · Sede Piura').first()).toBeVisible();
    const list = page.getByRole('list', { name: 'Establecimientos de ORG' });
    if (await list.isVisible()) {
      // `expanded` o más: lista-detalle; el detalle es una región con nombre.
      await list.getByRole('button', { name: /PIURA · Sede Piura/ }).click();
      const detail = page.getByRole('region', { name: 'Establecimiento PIURA' });
      await expect(detail.getByText('Av. Sánchez Cerro 0000, Piura, Piura, Piura, PE')).toBeVisible();
      await expect(detail.getByText('ERP / PRD-100 / BRANCH / 1000-02')).toBeVisible();
    } else {
      // `compact` y `medium`: tarjetas con el detalle dentro.
      const card = page.getByRole('listitem').filter({ hasText: 'PIURA · Sede Piura' });
      await expect(card.getByText('Av. Sánchez Cerro 0000, Piura, Piura, Piura, PE')).toBeVisible();
      await expect(card.getByText('ERP / PRD-100 / BRANCH / 1000-02')).toBeVisible();
    }
    await expect(page.getByText('Pendiente de sincronizar').first()).toBeVisible();
  });
});

/** Abre un destino del riel de MDM; en `compact` el riel es un cajón que se abre desde el menú. */
async function openDestination(page: Page, compact: boolean, name: string): Promise<void> {
  if (compact) await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
  await page.getByRole('navigation', { name: 'Navegación de MDM' }).getByRole('link', { name }).click();
}

test.describe('tipos de rol (US-MDM-014, D-046)', () => {
  test.use({ session: { user: 'rosa.medina' } });

  test('Rosa Medina abre «Tipos de rol», da de alta uno y lo ve en «Asignar rol»', async ({ page }, info) => {
    const compact = info.project.name === 'compact';
    await page.goto('/mdm/organizaciones');
    await expect(page.getByRole('heading', { level: 1, name: 'Organizaciones' })).toBeVisible();
    await openDestination(page, compact, 'Tipos de rol');
    await expect(page.getByRole('heading', { level: 1, name: 'Tipos de rol' })).toBeVisible();
    await expect(page.getByText('CONSIGNEE', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Nuevo tipo de rol' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo tipo de rol' });
    const code = dialog.getByRole('textbox', { name: 'Código (obligatorio)' });
    await expect(code).toBeFocused();
    await code.fill('operador portuario');
    await dialog.getByRole('textbox', { name: 'Nombre (obligatorio)' }).fill('Operador portuario');
    await expect(code).toHaveValue('OPERADOR_PORTUARIO');
    await dialog.getByRole('textbox', { name: 'Código UN/EDIFACT 3035 (opcional)' }).fill('pw');
    await dialog.getByRole('button', { name: 'Crear' }).click();
    await expect(page.getByText('Tipo de rol OPERADOR_PORTUARIO creado.')).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('OPERADOR_PORTUARIO', { exact: true })).toBeVisible();

    // Navegación dentro de la aplicación: el almacén del mock vive en la pestaña y una recarga lo reinicia.
    await openDestination(page, compact, 'Organizaciones');
    const search = page.getByRole('searchbox', { name: 'Buscar por código, razón social o nombre comercial' });
    await search.fill('organizacion');
    await search.press('Enter');
    await page.getByRole('link', { name: 'ORG', exact: true }).click();
    await page.getByRole('tab', { name: 'Roles (1)' }).click();
    await page.getByRole('button', { name: 'Asignar rol' }).click();
    const assign = page.getByRole('dialog', { name: 'Asignar rol' });
    const type = assign.getByRole('combobox', { name: 'Tipo de rol (obligatorio)' });
    await expect(type.getByRole('option', { name: 'Operador portuario (OPERADOR_PORTUARIO)' })).toBeAttached();
    await type.selectOption({ label: 'Operador portuario (OPERADOR_PORTUARIO)' });
    await assign.getByRole('button', { name: 'Asignar' }).click();
    await expect(page.getByText('Rol asignado.')).toBeVisible();
    await expect(page.getByText('Operador portuario (OPERADOR_PORTUARIO)').first()).toBeVisible();
  });
});

test.describe('marco común: MDM tiene el mismo riel que SIL (ADR-0245 D4.1, G-584)', () => {
  test.describe('analista de datos maestros', () => {
    test.use({ session: { user: 'rosa.medina' } });

    test('riel con «Organizaciones» activo y el FAB «Nueva organización»', async ({ page }, info) => {
      await page.goto('/mdm/organizaciones');
      await expect(page.getByRole('heading', { level: 1, name: 'Organizaciones' })).toBeVisible();
      if (info.project.name === 'compact') {
        // En compact el FAB flota abajo a la derecha y el riel abre como cajón desde el menú.
        await expect(page.getByRole('link', { name: 'Nueva organización' })).toBeVisible();
        await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
      }
      const rail = page.getByRole('navigation', { name: 'Navegación de MDM' });
      await expect(rail.getByRole('link', { name: 'Organizaciones' })).toHaveAttribute('aria-current', 'page');
      const fab = rail.getByRole('link', { name: 'Nueva organización' });
      await expect(fab).toBeVisible();
      await fab.click();
      await expect(page.getByRole('heading', { level: 1, name: 'Nueva organización' })).toBeVisible();
    });
  });

  test.describe('consultor', () => {
    test.use({ session: { user: 'carlos.vega' } });

    test('ve el riel con «Organizaciones» pero no el FAB', async ({ page }, info) => {
      await page.goto('/mdm/organizaciones');
      await expect(page.getByText('ACME PERÚ S.A.C.').first()).toBeVisible();
      if (info.project.name === 'compact') await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
      const rail = page.getByRole('navigation', { name: 'Navegación de MDM' });
      await expect(rail.getByRole('link', { name: 'Organizaciones' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Nueva organización' })).toHaveCount(0);
    });
  });
});

interface View {
  readonly name: string;
  readonly path: string;
  readonly ready: (page: Page) => Locator;
}

const fichaPath = (section: string): string => `/mdm/organizaciones/${ORG_ID}?seccion=${section}`;

const VIEWS: readonly View[] = [
  { name: 'P-MDM-01 Organizaciones', path: '/mdm/organizaciones', ready: (p) => p.getByText('ACME PERÚ S.A.C.').first() },
  { name: 'P-MDM-02 Datos generales', path: fichaPath('datos'), ready: (p) => p.getByText('Razón social') },
  { name: 'P-MDM-02 Roles', path: fichaPath('roles'), ready: (p) => p.getByText('Empresa del grupo (INTERNAL_COMPANY)').first() },
  { name: 'P-MDM-02 Establecimientos', path: fichaPath('establecimientos'), ready: (p) => p.getByText('CALLAO · Sede Callao').first() },
  { name: 'P-MDM-02 Relaciones', path: fichaPath('relaciones'), ready: (p) => p.getByRole('link', { name: 'NAVIERA-PACIFICO · NAVIERA DEL PACÍFICO S.A.C.' }) },
  { name: 'P-MDM-02 Referencias externas', path: fichaPath('referencias'), ready: (p) => p.getByText('Pendiente de sincronizar').first() },
  { name: 'P-MDM-02 Historial', path: fichaPath('historial'), ready: (p) => p.getByRole('list', { name: 'Historial de ORG' }) },
  { name: 'P-MDM-03 Nueva organización', path: '/mdm/organizaciones/nueva', ready: (p) => p.getByRole('heading', { level: 1, name: 'Nueva organización' }) },
  { name: 'P-MDM-04 Tipos de rol', path: '/mdm/tipos-de-rol', ready: (p) => p.getByText('CONSIGNEE', { exact: true }) },
];

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`MDM: axe, esquema ${scheme}`, () => {
    test.use({ colorScheme: scheme, session: { user: 'rosa.medina' } });

    for (const view of VIEWS) {
      test(`${view.name} sin violaciones WCAG 2.2 AA`, async ({ page }) => {
        await page.goto(view.path);
        await expect(view.ready(page)).toBeVisible();
        await page.waitForLoadState('networkidle');
        expect(await violationsList(page)).toEqual([]);
      });
    }

    test('P-MDM-04 con «Nuevo tipo de rol» abierto y un error de campo sin violaciones', async ({ page }) => {
      await page.goto('/mdm/tipos-de-rol');
      await expect(page.getByText('CONSIGNEE', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Nuevo tipo de rol' }).click();
      const dialog = page.getByRole('dialog', { name: 'Nuevo tipo de rol' });
      await dialog.getByRole('button', { name: 'Crear' }).click();
      await expect(dialog.getByRole('link', { name: 'Escribe un código.' })).toBeVisible();
      await waitForAnimations(page);
      expect(await violationsList(page)).toEqual([]);
    });

    test('D-MDM-06 con el buscador abierto sin violaciones', async ({ page }) => {
      await page.goto(fichaPath('relaciones'));
      await page.getByRole('button', { name: 'Nueva relación' }).click();
      const dialog = page.getByRole('dialog', { name: 'Nueva relación' });
      await dialog.getByRole('combobox', { name: 'Tipo de relación (obligatorio)' }).selectOption({ label: 'Matriz de (PARENT_OF)' });
      const field = dialog.getByRole('combobox', { name: 'Otra organización (obligatorio)' });
      await field.fill('acme');
      await expect(dialog.getByRole('option', { name: 'ACME · ACME PERÚ S.A.C.' })).toBeVisible();
      await field.press('ArrowDown');
      await waitForAnimations(page);
      expect(await violationsList(page)).toEqual([]);
      // Escape cierra la lista, no el diálogo.
      await field.press('Escape');
      await expect(field).toHaveAttribute('aria-expanded', 'false');
      await expect(dialog).toBeVisible();
    });
  });
}
