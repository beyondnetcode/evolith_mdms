import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { InlineNotice } from './InlineNotice.tsx';
import { ModalDialog } from './ModalDialog.tsx';
import { Switch } from './Switch.tsx';
import { LinearProgress } from './LinearProgress.tsx';
import { Tabs, panelId } from './Tabs.tsx';
import { EmptyState } from './EmptyState.tsx';
import { LoadingBar } from './Loading.tsx';
import { SnackbarProvider, useSnackbar } from './Snackbar.tsx';
import { Tag } from './Tag.tsx';
import { formatAge, formatCivilDate, formatDateTime, formatRelativeDateTime, formatShortDateTime } from './format.ts';

describe('AvisoEnLinea', () => {
  it('antepone la gravedad para lectores de pantalla', () => {
    render(
      <InlineNotice severity="error" title="No se emitió la orden de transporte: el crédito está en Rojo.">
        Sigue así hasta una evaluación Verde.
      </InlineNotice>,
    );
    expect(screen.getByText('Error:')).toHaveClass('sr-only');
    expect(screen.getByText(/No se emitió la orden/)).toBeInTheDocument();
  });

  it('solo es región en vivo si se pide', () => {
    const { rerender } = render(<InlineNotice severity="warning" title="a" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    rerender(<InlineNotice severity="warning" title="a" announce />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('Pestanas', () => {
  function Example({ onChange }: { onChange: (id: string) => void }) {
    const [value, setValue] = useState('a');
    return (
      <>
        <Tabs
          label="Ejemplo"
          baseId="t"
          value={value}
          onChange={(id) => {
            onChange(id);
            setValue(id);
          }}
          items={[
            { id: 'a', label: 'Resumen' },
            { id: 'b', label: 'Validación', badge: 2 },
            { id: 'c', label: 'Orden', count: 4 },
          ]}
        />
        <div role="tabpanel" id={panelId('t')} />
      </>
    );
  }

  it('sigue el patrón de teclado: solo la activa se tabula y las flechas mueven y activan', async () => {
    const onChange = vi.fn();
    render(<Example onChange={onChange} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((p) => p.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    tabs[0]?.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('b');
    expect(screen.getByRole('tab', { name: /Validación/ })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith('c');
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('a');
  });

  it('muestra el contador en la etiqueta y la insignia como texto accesible', () => {
    render(<Example onChange={() => undefined} />);
    expect(screen.getByRole('tab', { name: 'Orden (4)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Validación\s*,\s*2\s*abiertas/ })).toBeInTheDocument();
  });
});

describe('formato de fechas', () => {
  it('muestra siempre la hora de Lima, aunque el instante venga en otra zona', () => {
    expect(formatShortDateTime('2026-10-13T14:40:00Z')).toBe('13/10 09:40');
    expect(formatDateTime('2026-10-13T09:12:00-05:00')).toBe('13/10/2026 09:12');
  });

  it('no desplaza una fecha civil', () => {
    expect(formatCivilDate('2026-10-18')).toBe('18/10/2026');
  });
});

describe('Interruptor', () => {
  it('es un switch con nombre y descripción accesibles, y cambia con clic y con teclado', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch label="Activa transporte" description="Genera una orden por contenedor." active={false} onChange={onChange} />);
    const switchControl = screen.getByRole('switch', { name: 'Activa transporte' });
    expect(switchControl).not.toBeChecked();
    expect(switchControl).toHaveAccessibleDescription('Genera una orden por contenedor.');
    await user.click(switchControl);
    expect(onChange).toHaveBeenLastCalledWith(true);
    switchControl.focus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('deshabilitado no cambia', async () => {
    const onChange = vi.fn();
    render(<Switch label="Requiere suministros" active disabled onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('switch')).toBeChecked();
  });
});

describe('ProgresoLineal', () => {
  it('declara valor, máximo y texto', () => {
    render(<LinearProgress value={3} max={5} label="Checks completos" text="3 de 5" />);
    const bar = screen.getByRole('progressbar', { name: 'Checks completos' });
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
    expect(bar).toHaveAttribute('aria-valuetext', '3 de 5');
  });
});

describe('DialogoModal: hoja lateral y pantalla completa', () => {
  it.each(['side-sheet', 'full-screen'] as const)('%s lleva título, botón «Cerrar» que cierra y acciones', async (variant) => {
    const onClose = vi.fn();
    render(
      <ModalDialog open onClose={onClose} variant={variant} title="Registrar observación" actions={<button type="button">Registrar</button>}>
        <label>
          Campo <input data-autofocus="" />
        </label>
      </ModalDialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Registrar observación' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Registrar observación' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Etiqueta (UI-01: un componente, seis tonos)', () => {
  it.each([
    ['block', 'bg-error-container', 'text-on-error-container'],
    ['attention', 'bg-warning-container', 'text-on-warning-container'],
    ['progress', 'bg-secondary-container', 'text-on-secondary-container'],
  ] as const)('el tono %s lleva el contenedor de color con su par on-*', (tone, background, text) => {
    render(<Tag tone={tone}>Texto</Tag>);
    expect(screen.getByText('Texto')).toHaveClass(background, text);
  });

  it('`outline` lleva contorno y `ready` y `quiet` son icono y texto sin relleno ni borde', () => {
    render(
      <>
        <Tag tone="outline">Contorno</Tag>
        <Tag tone="ready">Listo</Tag>
        <Tag tone="quiet">Discreto</Tag>
      </>,
    );
    expect(screen.getByText('Contorno')).toHaveClass('border', 'border-outline');
    for (const text of ['Listo', 'Discreto']) {
      expect(screen.getByText(text).className).not.toMatch(/(?<![\w-])(bg-|border)/);
    }
  });

  it('nunca usa tertiary ni brand ni el relleno sólido primary, y el icono es decorativo', () => {
    const { container } = render(
      <>
        {(['block', 'attention', 'progress', 'outline', 'ready', 'quiet'] as const).map((tone) => (
          <Tag key={tone} tone={tone} icon="check">
            {tone}
          </Tag>
        ))}
      </>,
    );
    expect(container.innerHTML).not.toMatch(/tertiary|brand|bg-primary(?![\w-])/);
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(6);
  });

  it('mide 24 dp en tabla y lista (compact) y 32 dp en la ficha (standard)', () => {
    render(
      <>
        <Tag tone="progress" size="compact">
          Tabla
        </Tag>
        <Tag tone="progress">Ficha</Tag>
      </>,
    );
    expect(screen.getByText('Tabla')).toHaveClass('h-6', 'text-label-medium');
    expect(screen.getByText('Ficha')).toHaveClass('h-8', 'text-label-large');
  });
});

describe('EstadoVacio (UI-11)', () => {
  it('muestra un disco de 80 dp con icono decorativo, el título, el apoyo y UNA acción', () => {
    const { container } = render(
      <EmptyState icon="search" title="Ninguna solicitud coincide." action={<button type="button">Limpiar filtros</button>}>
        Prueba con otros filtros.
      </EmptyState>,
    );
    expect(screen.getByText('Ninguna solicitud coincide.')).toBeInTheDocument();
    expect(screen.getByText('Prueba con otros filtros.')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    const disc = container.querySelector('span[aria-hidden="true"]');
    expect(disc).toHaveClass('size-20', 'rounded-full', 'bg-surface-container-high');
    expect(disc?.querySelector('svg')).toHaveClass('size-10');
  });

  it('se anuncia solo cuando aparece tras buscar o filtrar, y no usa ilustración ni fotografía', () => {
    const { container, rerender } = render(<EmptyState icon="list_alt" title="Sin datos" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    rerender(<EmptyState icon="list_alt" title="Sin datos" announce />);
    expect(screen.getByRole('status')).toHaveTextContent('Sin datos');
    expect(container.querySelector('img, picture, canvas')).toBeNull();
  });
});

describe('fechas relativas (R-13)', () => {
  const now = new Date('2026-10-14T15:00:00-05:00');

  it('«hoy 09:40», «ayer 22:50» y desde el segundo día la fecha corta, por el día civil de Lima', () => {
    expect(formatRelativeDateTime('2026-10-14T09:40:00-05:00', now)).toBe('hoy 09:40');
    expect(formatRelativeDateTime('2026-10-13T22:50:00-05:00', now)).toBe('ayer 22:50');
    expect(formatRelativeDateTime('2026-10-12T16:02:00-05:00', now)).toBe('12/10 16:02');
    // 23:30 de Lima del 13 ya es 04:30 UTC del 14: sigue siendo «ayer» en Lima.
    expect(formatRelativeDateTime('2026-10-13T23:30:00-05:00', now)).toBe('ayer 23:30');
  });

  it('la antigüedad de una lectura: ahora, minutos y horas', () => {
    expect(formatAge(20_000)).toBe('ahora');
    expect(formatAge(2 * 60_000 + 5_000)).toBe('hace 2 min');
    expect(formatAge(3 * 60 * 60_000)).toBe('hace 3 h');
    expect(formatAge(-5)).toBe('ahora');
  });
});

describe('Snackbar (UI-15)', () => {
  function Trigger({ withAction }: { withAction: boolean }) {
    const { show } = useSnackbar();
    return (
      <button type="button" onClick={() => show({ text: 'Guardado', ...(withAction ? { action: { label: 'Deshacer', onPress: () => undefined } } : {}) })}>
        Mostrar
      </button>
    );
  }

  it('nunca ofrece dos botones de texto: una acción de texto y el cierre como botón de icono', async () => {
    const user = userEvent.setup();
    render(
      <SnackbarProvider>
        <Trigger withAction />
      </SnackbarProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Mostrar' }));
    const buttons = screen.getAllByRole('button').filter((button) => button.textContent !== 'Mostrar');
    expect(buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent)).toEqual(['Deshacer', 'Cerrar']);
    const close = screen.getByRole('button', { name: 'Cerrar' });
    expect(close.textContent).toBe('');
    expect(close).toHaveClass('size-12');
    await user.click(close);
    expect(screen.queryByText('Guardado')).not.toBeInTheDocument();
  });
});

describe('Barra de carga con movimiento reducido (UI-10)', () => {
  it('trae el texto «Cargando…» visible solo con prefers-reduced-motion y la barra sigue anunciada', () => {
    render(<LoadingBar subject="solicitudes" />);
    expect(screen.getByRole('progressbar', { name: 'Cargando solicitudes' })).toBeInTheDocument();
    const caption = screen.getByText('Cargando…');
    expect(caption).toHaveClass('hidden', 'motion-reduce:block');
    expect(caption).toHaveAttribute('aria-hidden', 'true');
  });
});
