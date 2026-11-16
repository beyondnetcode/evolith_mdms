import type { MdmGateway } from '@mdm/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { installDialogPolyfill } from '../../testing/dialog-polyfill.ts';
import { overrideGateway } from '../../testing/override-gateway.ts';
import { openPartySection } from '../../testing/party-fixtures.ts';
import { AsyncCombobox, type ComboboxOption, type ComboboxResults } from './AsyncCombobox.tsx';

let polyfill: ReturnType<typeof installDialogPolyfill>;
beforeAll(() => {
  polyfill = installDialogPolyfill();
});
afterAll(() => {
  polyfill.uninstall();
});

const OPTIONS: readonly ComboboxOption[] = [
  { id: 'a', label: 'ACME · ACME PERÚ S.A.C.' },
  { id: 'b', label: 'ANDINA-FOODS · ANDINA FOODS S.A.C.' },
  { id: 'c', label: 'AGROEXPORT-NORTE · AGROEXPORTADORA DEL NORTE S.A.' },
];

/** Campo con resultados controlados por la prueba y un contenedor que registra las teclas que le llegan. */
function Harness({ results, onSelect, onRetry, onOuterKey }: { readonly results: ComboboxResults; readonly onSelect: (option: ComboboxOption) => void; readonly onRetry: () => void; readonly onOuterKey: (key: string) => void }) {
  const [text, setText] = useState('');
  return (
    <div role="presentation" onKeyDown={(event) => onOuterKey(event.key)}>
      <AsyncCombobox
        label="Otra organización"
        fieldId="campo"
        required
        help="Busca por código."
        error={undefined}
        text={text}
        onTextChange={setText}
        results={results}
        onSelect={(option) => {
          setText(option.label);
          onSelect(option);
        }}
        onRetry={onRetry}
        emptyText="Ninguna organización coincide."
        countText={(count) => `${count} organizaciones encontradas.`}
      />
    </div>
  );
}

function setup(results: ComboboxResults) {
  const onSelect = vi.fn<(option: ComboboxOption) => void>();
  const onRetry = vi.fn();
  const onOuterKey = vi.fn<(key: string) => void>();
  const user = userEvent.setup();
  const view = render(<Harness results={results} onSelect={onSelect} onRetry={onRetry} onOuterKey={onOuterKey} />);
  return { user, onSelect, onRetry, onOuterKey, view, field: screen.getByRole('combobox', { name: 'Otra organización (obligatorio)' }) };
}

describe('AsyncCombobox: patrón combobox del APG (UI-MDM-001 §5.2)', () => {
  it('ARIA: lista controlada, autocompletado de lista y ayuda asociada', () => {
    const { field } = setup({ kind: 'idle' });
    expect(field).toHaveAttribute('aria-autocomplete', 'list');
    expect(field).toHaveAttribute('aria-expanded', 'false');
    expect(field).toHaveAttribute('aria-controls', 'campo-lista');
    expect(field).toHaveAccessibleDescription('Busca por código.');
  });

  it('flechas recorren las opciones sin sacar el foco del campo; Enter elige y cierra', async () => {
    const { user, field, onSelect } = setup({ kind: 'ready', options: OPTIONS });
    await user.click(field);
    await user.keyboard('a');
    expect(field).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('3 organizaciones encontradas.');
    const listbox = screen.getByRole('listbox', { name: 'Otra organización' });
    const options = within(listbox).getAllByRole('option');
    expect(field).toHaveAttribute('aria-activedescendant', options[0]?.id);
    await user.keyboard('{ArrowDown}');
    expect(field).toHaveAttribute('aria-activedescendant', options[1]?.id);
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    // No da la vuelta: se queda en la última.
    expect(field).toHaveAttribute('aria-activedescendant', options[2]?.id);
    await user.keyboard('{ArrowUp}');
    expect(field).toHaveAttribute('aria-activedescendant', options[1]?.id);
    expect(field).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[1]);
    expect(field).toHaveValue('ANDINA-FOODS · ANDINA FOODS S.A.C.');
    expect(field).toHaveAttribute('aria-expanded', 'false');
    expect(field).not.toHaveAttribute('aria-activedescendant');
  });

  it('Escape cierra la lista sin salir del contenedor; con la lista cerrada, borra lo escrito; vacío, deja pasar Escape', async () => {
    const { user, field, onOuterKey } = setup({ kind: 'ready', options: OPTIONS });
    await user.click(field);
    await user.keyboard('ac');
    expect(field).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(field).toHaveAttribute('aria-expanded', 'false');
    expect(field).toHaveValue('ac');
    await user.keyboard('{Escape}');
    expect(field).toHaveValue('');
    expect(onOuterKey).not.toHaveBeenCalledWith('Escape');
    await user.keyboard('{Escape}');
    expect(onOuterKey).toHaveBeenCalledWith('Escape');
  });

  it('cargando, vacío y error: se anuncian; el error es una opción que reintenta con Enter', async () => {
    const first = setup({ kind: 'loading' });
    await first.user.click(first.field);
    await first.user.keyboard('ac');
    expect(first.field).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Buscando…');
    first.view.unmount();

    const empty = setup({ kind: 'ready', options: [] });
    await empty.user.click(empty.field);
    await empty.user.keyboard('zz');
    expect(screen.getByRole('status')).toHaveTextContent('Ninguna organización coincide.');
    expect(empty.field).toHaveAttribute('aria-expanded', 'false');
    empty.view.unmount();

    const failed = setup({ kind: 'error' });
    await failed.user.click(failed.field);
    await failed.user.keyboard('ac');
    expect(screen.getByRole('option', { name: 'No pudimos buscar. Reintentar' })).toBeInTheDocument();
    await failed.user.keyboard('{Enter}');
    expect(failed.onRetry).toHaveBeenCalledTimes(1);
    expect(failed.onSelect).not.toHaveBeenCalled();
  });
});

describe('Buscador de D-MDM-06 en el servidor (P-01, SU-MDM-08)', () => {
  it('busca por RUC; el error de búsqueda se reintenta; Escape en la lista no cierra el diálogo', async () => {
    let fail = true;
    const decorateGateway = (base: MdmGateway) =>
      overrideGateway(base, {
        listParties: (...args) => {
          if (!fail) return base.listParties(...args);
          fail = false;
          return Promise.reject(new Error('caída'));
        },
      });
    const { user } = await openPartySection('ORG', { section: 'relaciones', decorateGateway });
    await user.click(screen.getByRole('button', { name: 'Nueva relación' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nueva relación' });
    const field = within(dialog).getByRole('combobox', { name: 'Otra organización (obligatorio)' });
    await user.click(field);
    await user.keyboard('20601234565');
    expect(await within(dialog).findByRole('option', { name: 'No pudimos buscar. Reintentar' })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(await within(dialog).findByRole('option', { name: 'ACME · ACME PERÚ S.A.C.' })).toBeInTheDocument();
    expect(await within(dialog).findByText('1 organización encontrada.', { selector: '[role="status"]' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(field).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('dialog', { name: 'Nueva relación' })).toBeInTheDocument();
  });
});
