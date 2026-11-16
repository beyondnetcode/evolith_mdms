import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ActionMenu } from './ActionMenu.tsx';
import { Tooltip } from './Tooltip.tsx';

/** ADR-0110 P-UX-08: un menú atrapa el foco, vuelve inerte el resto, cierra con `Escape` y devuelve el foco al disparador. */
function renderMenu() {
  return render(
    <>
      <button type="button">Antes</button>
      <main>
        <ActionMenu
          label="Más acciones"
          items={[
            { id: 'a', label: 'Primera', onSelect: () => undefined },
            { id: 'b', label: 'Segunda', onSelect: () => undefined },
          ]}
        />
      </main>
      <button type="button">Después</button>
    </>,
  );
}

describe('menú: gestión del foco (P-UX-08)', () => {
  it('Tab y Mayús+Tab recorren sus elementos sin salir del menú', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Más acciones' }));
    expect(screen.getByRole('menuitem', { name: 'Primera' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('menuitem', { name: 'Segunda' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('menuitem', { name: 'Primera' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('menuitem', { name: 'Segunda' })).toHaveFocus();
  });

  it('mientras está abierto el resto de la página es inerte, y deja de serlo al cerrarse', async () => {
    const user = userEvent.setup();
    renderMenu();
    const before = screen.getByText('Antes');
    await user.click(screen.getByRole('button', { name: 'Más acciones' }));
    expect(before).toHaveAttribute('inert');
    expect(screen.getByText('Después')).toHaveAttribute('inert');
    await user.keyboard('{Escape}');
    expect(before).not.toHaveAttribute('inert');
  });

  it('Escape cierra y devuelve el foco al botón que lo abrió', async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Más acciones' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('elegir un elemento cierra el menú y devuelve el foco al botón', async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Más acciones' });
    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Segunda' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

/** Un botón con tooltip que abre un panel, como el del selector de fecha acoplado. */
function PanelWithTooltip() {
  const [open, setOpen] = useState(false);
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <Tooltip text="Elegir fecha">
        <button type="button" aria-label="Elegir fecha" aria-expanded={open} onClick={() => setOpen(true)}>
          Fecha
        </button>
      </Tooltip>
      {open && <div role="dialog" aria-label="Selector de fecha" />}
    </div>
  );
}

const pastTooltipDelay = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 600));

describe('tooltip de un botón que abre un panel (P-UX-08)', () => {
  it('no aparece mientras el panel está abierto, aunque el cursor siga sobre el botón', async () => {
    const user = userEvent.setup();
    render(<PanelWithTooltip />);
    await user.click(screen.getByRole('button', { name: 'Elegir fecha' }));
    await pastTooltipDelay();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('el primer Escape cierra el panel', async () => {
    const user = userEvent.setup();
    render(<PanelWithTooltip />);
    await user.click(screen.getByRole('button', { name: 'Elegir fecha' }));
    await pastTooltipDelay();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('con el panel cerrado, Escape cierra solo el tooltip (WCAG 1.4.13)', async () => {
    const user = userEvent.setup();
    render(<PanelWithTooltip />);
    await user.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Elegir fecha');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
