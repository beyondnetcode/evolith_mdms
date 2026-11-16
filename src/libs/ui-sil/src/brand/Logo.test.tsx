import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ASSET_SOURCE } from './assets.tsx';
import { Logo, versionForBackground } from './Logo.tsx';

describe('versionPorFondo', () => {
  it.each([
    ['light', 'color'],
    ['dark', 'negative'],
    ['brand', 'negative'],
    ['monochrome', 'mono'],
  ] as const)('sobre %s usa la versión %s', (background, version) => {
    expect(versionForBackground(background)).toBe(version);
  });
});

describe('Logo', () => {
  it('informativo: nombre accesible «Suite»', () => {
    render(<Logo shape="stacked" background="light" size="panel" informative />);
    expect(screen.getByRole('img', { name: 'Suite' })).toBeInTheDocument();
  });

  it('decorativo por defecto: oculto a los lectores de pantalla', () => {
    const { container } = render(<Logo shape="isotype" background="brand" size="bar" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('declara su origen local y la versión elegida por el fondo', () => {
    const { container } = render(<Logo shape="stacked" background="dark" size="minimum" />);
    expect(ASSET_SOURCE).toBe('marca-local');
    const root = container.firstElementChild;
    expect(root).toHaveAttribute('data-source', ASSET_SOURCE);
    expect(root).toHaveAttribute('data-version', 'negative');
    expect(root).toHaveAttribute('data-shape', 'stacked');
  });

  it('dibuja una marca vectorial, sin imagen externa', () => {
    const { container } = render(<Logo shape="isotype" background="light" size="bar" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('reserva su proporción para no desplazar el contenido al cargar', () => {
    const { container } = render(<Logo shape="isotype" background="light" size="bar" />);
    expect((container.firstElementChild as HTMLElement).style.aspectRatio).toBe('1 / 1');
  });
});
