import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from './Button.tsx';
import { DateField } from './DateField.tsx';
import { TimeField } from './TimeField.tsx';
import { MasterDataField } from './MasterDataField.tsx';
import { ActionMenu, SelectionMenu } from './ActionMenu.tsx';
import { parseTypedDate, displayDate } from './dates.ts';

const CUSTOMERS = [
  { id: 'agroexport-sur', name: 'Agroexport Sur' },
  { id: 'industrias-norte', name: 'Industrias Norte' },
  { id: 'pesquera-andina', name: 'Pesquera Andina' },
];

describe('Tooltip de M3 (WCAG 1.4.13)', () => {
  it('aparece con el foco del teclado, no tapa el control y Escape lo cierra', async () => {
    const user = userEvent.setup();
    render(<IconButton aria-label="Actualizar">i</IconButton>);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Actualizar');
    expect(screen.getByRole('button', { name: 'Actualizar' })).not.toHaveAttribute('title');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

describe('CampoMaestro (menú desplegable con filtrado)', () => {
  it('filtra al escribir, elige con el teclado y envía el id en el formulario', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="f">
        <MasterDataField label="Cliente" name="clienteId" options={CUSTOMERS} onValueChange={onChange} required />
      </form>,
    );
    const combo = screen.getByRole('combobox', { name: /Cliente/ });
    await user.type(combo, 'indus');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('industrias-norte');
    expect(combo).toHaveValue('Industrias Norte');
    const data = new FormData(screen.getByRole('form', { name: 'f' }));
    expect(data.get('clienteId')).toBe('industrias-norte');
  });

  it('solo selecciona: lo escrito que no es una opción se restaura al salir; un campo opcional ofrece «Sin selección»', async () => {
    const user = userEvent.setup();
    render(<MasterDataField label="Agencia" options={CUSTOMERS} defaultValue="agroexport-sur" />);
    const combo = screen.getByRole('combobox', { name: /Agencia/ });
    await user.click(combo);
    expect(screen.getByRole('option', { name: 'Sin selección' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.type(combo, 'zzz');
    await user.tab();
    expect(combo).toHaveValue('Agroexport Sur');
  });

  it('mientras llegan las opciones dice «Cargando opciones…» dentro del campo', () => {
    render(<MasterDataField label="Cliente" options={[]} loading />);
    expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', 'Cargando opciones…');
  });
});

describe('CampoFecha y CampoHora', () => {
  it('interpretan dd/mm/aaaa y devuelven una fecha civil; un texto incompleto se conserva para que el validador lo rechace', () => {
    expect(parseTypedDate('18102026')).toBe('2026-10-18');
    expect(parseTypedDate('3102026')).toBe('31/02/026');
    expect(parseTypedDate('31022026')).toBe('31/02/2026');
    expect(displayDate('2026-10-18')).toBe('18/10/2026');
  });

  it('escribir da la fecha civil; el selector acoplado elige un día con el teclado', async () => {
    const user = userEvent.setup();
    function Box() {
      const [value, setValue] = useState('');
      return <DateField label="ETD" value={value} onValueChange={setValue} />;
    }
    render(<Box />);
    await user.type(screen.getByLabelText('ETD'), '25/10/2026');
    expect(screen.getByLabelText('ETD')).toHaveValue('25/10/2026');
    await user.click(screen.getByRole('button', { name: 'Elegir fecha de ETD' }));
    const day = await screen.findByRole('button', { name: /sábado, 24 de octubre de 2026/ });
    await user.click(day);
    expect(screen.getByLabelText('ETD')).toHaveValue('24/10/2026');
  });

  it('la hora se escribe en 24 h; la esfera elige la hora, pasa sola a los minutos y se opera con el teclado', async () => {
    const user = userEvent.setup();
    render(<TimeField label="Hora de llenado" />);
    await user.type(screen.getByLabelText('Hora de llenado'), '0930');
    expect(screen.getByLabelText('Hora de llenado')).toHaveValue('09:30');
    await user.click(screen.getByRole('button', { name: 'Elegir hora de Hora de llenado' }));
    const hour = await screen.findByRole('slider', { name: 'Hora' });
    expect(hour).toHaveAttribute('aria-valuetext', '09 horas');
    expect(screen.getByRole('button', { name: 'Hora 09' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(hour).toHaveFocus());
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(hour).toHaveAttribute('aria-valuetext', '07 horas');
    // Intro pasa a los minutos, en la misma esfera.
    await user.keyboard('{Enter}');
    const minutes = screen.getByRole('slider', { name: 'Minutos' });
    expect(minutes).toHaveAttribute('aria-valuetext', '30 minutos');
    await user.keyboard('{PageUp}{ArrowUp}');
    expect(minutes).toHaveAttribute('aria-valuetext', '36 minutos');
    // La cabecera vuelve a la hora.
    await user.click(screen.getByRole('button', { name: 'Hora 07' }));
    expect(screen.getByRole('slider', { name: 'Hora' })).toHaveAttribute('aria-valuetext', '07 horas');
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));
    await waitFor(() => expect(screen.getByLabelText('Hora de llenado')).toHaveValue('07:36'));
  });

  it('con el puntero, el anillo interior da las horas de 13 a 00 y la esfera pasa sola a los minutos', async () => {
    const user = userEvent.setup();
    render(<TimeField label="Hora de zarpe" />);
    await user.click(screen.getByRole('button', { name: 'Elegir hora de Hora de zarpe' }));
    const dial = await screen.findByRole('slider', { name: 'Hora' });
    // Esfera de 200 × 200 con el centro en (100, 100).
    dial.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
    // A las «3» del anillo interior (radio 26 % del lado): 15 h.
    fireEvent.pointerDown(dial, { clientX: 152, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(dial, { clientX: 152, clientY: 100, pointerId: 1 });
    const minutes = screen.getByRole('slider', { name: 'Minutos' });
    expect(screen.getByRole('button', { name: 'Hora 15' })).toBeInTheDocument();
    // Abajo del todo: minuto 30; cualquier minuto, no solo los múltiplos de 5.
    fireEvent.pointerDown(minutes, { clientX: 100, clientY: 180, pointerId: 1 });
    fireEvent.pointerUp(minutes, { clientX: 100, clientY: 180, pointerId: 1 });
    expect(minutes).toHaveAttribute('aria-valuetext', '30 minutos');
    await waitFor(() => expect(screen.getByLabelText('Hora de zarpe')).toHaveValue('15:30'));
  });

  it('con un mínimo, la esfera no ofrece horas ni minutos anteriores', async () => {
    const user = userEvent.setup();
    render(<TimeField label="Cut-off: hora" min="10:30" />);
    await user.click(screen.getByRole('button', { name: 'Elegir hora de Cut-off: hora' }));
    const hour = await screen.findByRole('slider', { name: 'Hora' });
    await waitFor(() => expect(hour).toHaveFocus());
    await user.keyboard('{Home}');
    expect(hour).toHaveAttribute('aria-valuetext', '10 horas');
    await user.keyboard('{Enter}{Home}');
    expect(screen.getByRole('slider', { name: 'Minutos' })).toHaveAttribute('aria-valuetext', '30 minutos');
  });
});

describe('MenuAcciones', () => {
  it('abre con el foco en el primer elemento, se mueve con flechas, cierra con Escape y devuelve el foco', async () => {
    const user = userEvent.setup();
    const copy = vi.fn();
    render(
      <ActionMenu
        label="Más acciones"
        items={[
          { id: 'a', label: 'Copiar ID', onSelect: copy },
          { id: 'b', label: 'Cancelar servicio', onSelect: () => undefined, disabled: true, reason: 'El servicio ya se canceló.' },
        ]}
      />,
    );
    const button = screen.getByRole('button', { name: 'Más acciones' });
    await user.click(button);
    expect(screen.getByRole('menuitem', { name: 'Copiar ID' })).toHaveFocus();
    expect(screen.getByRole('menuitem', { name: /Cancelar servicio/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: /Cancelar servicio/ })).toHaveAccessibleDescription('El servicio ya se canceló.');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('el menú de casillas no se cierra al elegir y MenuSeleccion marca la opción vigente', async () => {
    const user = userEvent.setup();
    const toggle = vi.fn();
    const { unmount } = render(<ActionMenu label="Más" menuLabel="Columnas" items={[{ id: 'a', label: 'Booking', type: 'checkbox', checked: true, onSelect: toggle }]} />);
    await user.click(screen.getByRole('button', { name: 'Más' }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Booking' }));
    expect(toggle).toHaveBeenCalled();
    expect(screen.getByRole('menu', { name: 'Columnas' })).toBeInTheDocument();
    unmount();
    const change = vi.fn();
    render(<SelectionMenu label="Filas por página" options={[25, 50]} value={25} onChange={change} />);
    await user.click(screen.getByRole('button', { name: 'Filas por página: 25' }));
    expect(screen.getByRole('menuitemradio', { name: '25' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('menuitemradio', { name: '50' }));
    expect(change).toHaveBeenCalledWith(50);
  });
});
