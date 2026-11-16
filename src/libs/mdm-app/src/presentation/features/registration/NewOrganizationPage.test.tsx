import { MdmProblemError, type IdentifierFilter, type MdmGateway, type MdmProblem } from '@mdm/contracts';
import { WIDTHS } from '@sil/ui/testing';
import { screen, waitFor, within } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { installDialogPolyfill } from '../../../testing/dialog-polyfill.ts';
import { overrideGateway } from '../../../testing/override-gateway.ts';
import { renderMdm } from '../../../testing/mdm-harness.tsx';

const NEW_PATH = '/mdm/organizaciones/nueva';
/** RUC válido por módulo 11 que la semilla no usa. */
const FREE_RUC = '20101010105';

let polyfill: ReturnType<typeof installDialogPolyfill>;
beforeAll(() => {
  polyfill = installDialogPolyfill();
});
afterAll(() => {
  polyfill.uninstall();
});

function problem(status: 403 | 422, code: 'auth.forbidden' | 'party.identifier.invalid_format'): MdmProblemError {
  const base = { title: 'Prueba', detail: null, instance: 'prueba-0001', errors: {} };
  const value = (status === 403 ? { ...base, status, code: 'auth.forbidden' } : { ...base, status, code }) as MdmProblem;
  return new MdmProblemError(value, 'prueba-0001');
}

async function openForm(options: Parameters<typeof renderMdm>[0] = {}) {
  const rendered = renderMdm({ path: NEW_PATH, ...options });
  expect(screen.getByRole('heading', { level: 1, name: 'Nueva organización' })).toBeInTheDocument();
  // Los catálogos llegan: el esquema del RUC está elegido.
  await screen.findByRole('option', { name: 'Registro Único de Contribuyentes (PE-RUC)' });
  return rendered;
}

async function fillRequired(user: ReturnType<typeof renderMdm>['user'], values: { code: string; legalName: string; ruc: string }) {
  await user.type(screen.getByRole('textbox', { name: 'Código (obligatorio)' }), values.code);
  await user.type(screen.getByRole('textbox', { name: 'Razón social (obligatorio)' }), values.legalName);
  await user.type(screen.getByRole('textbox', { name: 'Valor (obligatorio)' }), values.ruc);
}

describe('P-MDM-03 Nueva organización (US-MDM-003)', () => {
  it('registra con un rol inicial y llega a la ficha nueva con un aviso de éxito', async () => {
    const { user } = await openForm();
    expect(document.title).toBe('Nueva organización · MDM · Suite');
    await fillRequired(user, { code: 'nueva empresa', legalName: 'NUEVA EMPRESA S.A.C.', ruc: FREE_RUC });
    await user.type(screen.getByRole('textbox', { name: 'Nombre comercial (opcional)' }), 'Nueva');
    await user.click(screen.getByRole('button', { name: 'Agregar un rol' }));
    const row = screen.getByRole('group', { name: 'Rol 1' });
    await waitFor(() => expect(within(row).getByRole('combobox', { name: 'Tipo de rol (obligatorio)' })).toHaveFocus());
    await user.selectOptions(within(row).getByRole('combobox', { name: 'Tipo de rol (obligatorio)' }), 'Cliente (CUSTOMER)');
    await user.click(screen.getByRole('button', { name: 'Registrar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'NUEVA_EMPRESA' })).toBeInTheDocument();
    expect(screen.getByText('Organización NUEVA_EMPRESA registrada.')).toBeInTheDocument();
    expect(screen.getByText('Roles: Cliente')).toBeInTheDocument();
    expect(screen.getByText(`PE-RUC ${FREE_RUC}`)).toBeInTheDocument();
  });

  it('valida antes de enviar: resumen de errores enfocado con enlaces y error junto a cada campo; no envía nada', async () => {
    const register = vi.fn();
    const decorateGateway = (base: MdmGateway): MdmGateway =>
      overrideGateway(base, {
        registerParty: (request) => {
          register(request);
          return base.registerParty(request);
        },
      });
    const { user } = await openForm({ decorateGateway });
    await user.click(screen.getByRole('button', { name: 'Registrar' }));

    const summary = await screen.findByText('Revisa los campos marcados.');
    const summaryBox = summary.closest('[tabindex="-1"]');
    await waitFor(() => expect(summaryBox).toHaveFocus());
    const code = screen.getByRole('textbox', { name: 'Código (obligatorio)' });
    expect(code).toHaveAttribute('aria-invalid', 'true');
    expect(code).toHaveAccessibleDescription('Escribe un código.');
    expect(screen.getByRole('textbox', { name: 'Razón social (obligatorio)' })).toHaveAccessibleDescription('Escribe la razón social.');
    await user.click(screen.getByRole('link', { name: 'Escribe el número del identificador.' }));
    expect(screen.getByRole('textbox', { name: 'Valor (obligatorio)' })).toHaveFocus();
    expect(register).not.toHaveBeenCalled();
  });

  it('el RUC con dígito verificador incorrecto se marca al salir del campo; el patrón del esquema también', async () => {
    const { user } = await openForm();
    const value = screen.getByRole('textbox', { name: 'Valor (obligatorio)' });
    await user.type(value, '20601234568');
    await user.tab();
    expect(value).toHaveAccessibleDescription('El RUC no es válido: revisa el último dígito.');
    await user.clear(value);
    await user.type(value, '2060');
    await user.tab();
    expect(value).toHaveAccessibleDescription('El RUC tiene 11 dígitos.');
  });

  it('409 duplicado: busca la existente por identificador exacto y ofrece abrirla o corregir el identificador (G-562)', async () => {
    const searches = vi.fn<(identifier: IdentifierFilter | null) => void>();
    const decorateGateway = (base: MdmGateway): MdmGateway =>
      overrideGateway(base, {
        listParties: (query, options) => {
          searches(query.identifier);
          return base.listParties(query, options);
        },
      });
    const { user, store } = await openForm({ decorateGateway });
    const before = store.parties.size;
    await fillRequired(user, { code: 'OTRA', legalName: 'OTRA S.A.', ruc: '20471471471' });
    await user.click(screen.getByRole('button', { name: 'Registrar' }));

    expect(
      await screen.findByText('Este identificador ya pertenece a otra organización: IMPORTADORA-ORIENTE · IMPORTADORA DEL ORIENTE S.A.C. (archivada).'),
    ).toBeInTheDocument();
    expect(searches).toHaveBeenCalledWith({ countryCode: 'PE', schemeCode: 'PE-RUC', value: '20471471471' });
    expect(store.parties.size).toBe(before);
    const existing = [...store.parties.values()].find((party) => party.code === 'IMPORTADORA-ORIENTE');
    expect(screen.getByRole('link', { name: 'Abrir organización existente' })).toHaveAttribute('href', `/mdm/organizaciones/${existing?.id ?? ''}`);
    // Se conserva el formulario.
    expect(screen.getByRole('textbox', { name: 'Código (obligatorio)' })).toHaveValue('OTRA');

    await user.click(screen.getByRole('button', { name: 'Corregir identificador' }));
    expect(screen.getByRole('textbox', { name: 'Valor (obligatorio)' })).toHaveFocus();
    expect(screen.queryByRole('link', { name: 'Abrir organización existente' })).not.toBeInTheDocument();
  });

  it('409 código repetido: el error va en el campo código y el resto del formulario se conserva', async () => {
    const { user } = await openForm();
    await fillRequired(user, { code: 'acme', legalName: 'OTRA ACME S.A.', ruc: FREE_RUC });
    await user.click(screen.getByRole('button', { name: 'Registrar' }));
    const code = screen.getByRole('textbox', { name: 'Código (obligatorio)' });
    await waitFor(() => expect(code).toHaveAccessibleDescription('Ya existe una organización con este código, aunque esté archivada. Usa otro código.'));
    expect(screen.getByRole('textbox', { name: 'Razón social (obligatorio)' })).toHaveValue('OTRA ACME S.A.');
    expect(screen.getByRole('textbox', { name: 'Valor (obligatorio)' })).toHaveValue(FREE_RUC);
    expect(screen.getByRole('combobox', { name: 'Esquema (obligatorio)' })).toHaveValue('PE-RUC');
  });

  it('422 del servidor sobre el identificador: el mensaje va en el campo valor, con la pista del esquema', async () => {
    const decorateGateway = (base: MdmGateway): MdmGateway =>
      overrideGateway(base, { registerParty: () => Promise.reject(problem(422, 'party.identifier.invalid_format')) });
    const { user } = await openForm({ decorateGateway });
    await fillRequired(user, { code: 'NUEVA', legalName: 'NUEVA S.A.', ruc: FREE_RUC });
    await user.click(screen.getByRole('button', { name: 'Registrar' }));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Valor (obligatorio)' })).toHaveAccessibleDescription(
        'El valor no tiene el formato de Registro Único de Contribuyentes. El RUC tiene 11 dígitos. Corrige el valor.',
      ),
    );
  });

  it('403 del servidor: avisa sin códigos técnicos y conserva lo escrito (ocultar no es control)', async () => {
    const decorateGateway = (base: MdmGateway): MdmGateway => overrideGateway(base, { registerParty: () => Promise.reject(problem(403, 'auth.forbidden')) });
    const { user } = await openForm({ decorateGateway });
    await fillRequired(user, { code: 'NUEVA', legalName: 'NUEVA S.A.', ruc: FREE_RUC });
    await user.click(screen.getByRole('button', { name: 'Registrar' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No tienes permiso para esta acción.');
    expect(alert).toHaveTextContent('Pide el permiso a tu responsable.');
    expect(alert).not.toHaveTextContent('auth.forbidden');
    expect(screen.getByRole('textbox', { name: 'Código (obligatorio)' })).toHaveValue('NUEVA');
  });

  it('el rol inicial con «hasta» anterior a «desde» se marca sin enviar', async () => {
    const { user } = await openForm();
    await user.click(screen.getByRole('button', { name: 'Agregar un rol' }));
    const row = screen.getByRole('group', { name: 'Rol 1' });
    await user.selectOptions(within(row).getByRole('combobox', { name: 'Tipo de rol (obligatorio)' }), 'Cliente (CUSTOMER)');
    const from = within(row).getByRole('textbox', { name: 'Desde' });
    await user.clear(from);
    await user.type(from, '10102026');
    await user.type(within(row).getByRole('textbox', { name: 'Hasta (opcional)' }), '01102026');
    await user.click(screen.getByRole('button', { name: 'Registrar' }));
    await waitFor(() =>
      expect(within(row).getByRole('textbox', { name: 'Hasta (opcional)' })).toHaveAccessibleDescription(
        'La fecha de fin no puede ser anterior a la de inicio (10/10/2026).',
      ),
    );
    await user.click(within(row).getByRole('button', { name: 'Quitar el rol Cliente' }));
    expect(screen.queryByRole('group', { name: 'Rol 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar un rol' })).toHaveFocus();
  });

  it('llega con el identificador de la búsqueda sin resultado ya escrito (WCAG 3.3.7)', async () => {
    await openForm({ path: `${NEW_PATH}?pais=PE&esquema=PE-RUC&valor=${FREE_RUC}` });
    expect(screen.getByRole('textbox', { name: 'Valor (obligatorio)' })).toHaveValue(FREE_RUC);
    expect(screen.getByRole('combobox', { name: 'País (obligatorio)' })).toHaveValue('PE');
  });

  it('«Cancelar» con datos escritos pide confirmación; «Descartar» vuelve a Organizaciones', async () => {
    const { user } = await openForm();
    await user.type(screen.getByRole('textbox', { name: 'Código (obligatorio)' }), 'X');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    const dialog = screen.getByRole('dialog', { name: '¿Descartar la organización sin registrar?' });
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Descartar' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Organizaciones' })).toBeInTheDocument();
  });

  it('en compact es una página a una columna con «Registrar» en la barra inferior', async () => {
    await openForm({ width: WIDTHS.compact });
    expect(screen.getByRole('button', { name: 'Registrar' }).parentElement).toHaveClass('fixed');
  });

  it('sin permiso no hay formulario: lo explica y ofrece volver', () => {
    renderMdm({ path: NEW_PATH, role: 'CONSULTOR' });
    expect(screen.getByText('No tienes permiso para registrar organizaciones.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a Organizaciones' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar' })).not.toBeInTheDocument();
  });
});
