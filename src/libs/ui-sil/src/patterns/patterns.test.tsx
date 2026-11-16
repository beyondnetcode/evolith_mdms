import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { TextField } from '../Fields.tsx';
import { CardList } from './CardList.tsx';
import { DataTable, EmptyCell } from './DataTable.tsx';
import { DefinitionSection } from './DefinitionSection.tsx';
import { EmptyState } from '../EmptyState.tsx';
import { ErrorSummary } from './ErrorSummary.tsx';
import { LoadMore } from './LoadMore.tsx';
import { ReadOnlyField } from './ReadOnlyField.tsx';
import { SectionCard } from './SectionCard.tsx';

interface Row {
  readonly id: string;
  readonly name: string;
}

const ROWS: readonly Row[] = [
  { id: 'SIL-00001', name: 'Uno' },
  { id: 'SIL-00002', name: '' },
];

describe('ErrorSummary', () => {
  it('es una alerta con un enlace por campo que lleva el foco al control', async () => {
    const user = userEvent.setup();
    render(
      <>
        <ErrorSummary title="Revisa 1 campo" errors={[{ fieldId: 'campo-cliente', label: 'Cliente', message: 'Elige el cliente.' }]} />
        <TextField fieldId="campo-cliente" label="Cliente" />
      </>,
    );
    const alert = screen.getByRole('alert');
    await user.click(within(alert).getByRole('link', { name: 'Cliente: Elige el cliente.' }));
    expect(screen.getByLabelText('Cliente')).toHaveFocus();
  });
});

describe('ReadOnlyField', () => {
  it('se ve pero no se edita, y dice por qué', () => {
    render(<ReadOnlyField label="Aforo" value="" reason="Lo completará el TMS." />);
    expect(screen.getByLabelText('Aforo')).toHaveAttribute('readonly');
    expect(screen.getByText('Lo completará el TMS.')).toBeInTheDocument();
  });
});

describe('DataTable', () => {
  it('tiene caption, región desplazable con foco, enlace en la columna fija y «Sin dato» para el lector', async () => {
    const onSort = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DataTable<Row, 'id' | 'name'>
          caption="Expedientes"
          regionLabel="Tabla de expedientes"
          keyColumn={{ id: 'id', label: 'ID', text: (row) => row.id }}
          columns={[{ id: 'name', label: 'Nombre', render: (row) => (row.name === '' ? <EmptyCell /> : row.name) }]}
          rows={ROWS}
          rowKey={(row) => row.id}
          rowHref={(row) => `/solicitudes/${row.id}`}
          sort={null}
          defaultSort={{ column: 'id', direction: 'desc' }}
          onSort={onSort}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('table', { name: 'Expedientes' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Tabla de expedientes' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('link', { name: 'SIL-00001' })).toHaveAttribute('href', '/solicitudes/SIL-00001');
    expect(screen.getByText('Sin dato')).toHaveClass('sr-only');
    expect(screen.getByRole('columnheader', { name: /ID/ })).toHaveAttribute('aria-sort', 'descending');
    await user.click(screen.getByRole('button', { name: 'Nombre: ordenar' }));
    expect(onSort).toHaveBeenCalledWith('name');
  });
});

describe('CardList', () => {
  it('es una lista con nombre y una tarjeta enlazada por fila', () => {
    render(
      <MemoryRouter>
        <CardList<Row> label="Expedientes" rows={ROWS} rowKey={(row) => row.id} rowHref={(row) => `/solicitudes/${row.id}`} title={(row) => row.id} body={(row) => row.name} />
      </MemoryRouter>,
    );
    const list = screen.getByRole('list', { name: 'Expedientes' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByRole('link', { name: /SIL-00001/ })).toHaveAttribute('href', '/solicitudes/SIL-00001');
  });
});

describe('LoadMore', () => {
  it('dice cuántos se muestran y carga más; en el tope explica qué hacer', async () => {
    const onLoadMore = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<LoadMore shown={25} total={40} hasMore loading={false} atLimit={false} limitText="Usa la búsqueda." onLoadMore={onLoadMore} />);
    expect(screen.getByText('Mostrando 25 de 40')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cargar más' }));
    expect(onLoadMore).toHaveBeenCalledOnce();
    rerender(<LoadMore shown={100} total={140} hasMore={false} loading={false} atLimit limitText="Usa la búsqueda." onLoadMore={onLoadMore} />);
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument();
    expect(screen.getByText('Usa la búsqueda.')).toBeInTheDocument();
  });
});

// El patrón usa el `EmptyState` único de `@sil/ui` (UI-11): el disco con icono, el título y la acción.
describe('EmptyState', () => {
  it('anuncia el vacío solo cuando responde a una acción', () => {
    const { rerender } = render(<EmptyState icon="search" title="No hay resultados." announce />);
    expect(screen.getByRole('status')).toHaveTextContent('No hay resultados.');
    rerender(<EmptyState icon="list_alt" title="Aún no hay expedientes." />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('SectionCard y DefinitionSection', () => {
  it('la tarjeta es una región con nombre y la sección plegable lista pares etiqueta/valor', () => {
    render(
      <SectionCard title="Datos del expediente">
        <DefinitionSection title="Operación" open items={[{ label: 'Sede', value: 'Callao' }]} />
      </SectionCard>,
    );
    const region = screen.getByRole('region', { name: 'Datos del expediente' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Datos del expediente' })).toBeInTheDocument();
    expect(within(region).getByRole('group')).toHaveAttribute('open');
    expect(within(region).getByRole('term')).toHaveTextContent('Sede');
    expect(within(region).getByRole('definition')).toHaveTextContent('Callao');
  });
});
