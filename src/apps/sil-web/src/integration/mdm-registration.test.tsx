import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SYSTEM_REGISTRY } from '../system-registry.ts';
import { renderApp } from '../testing/composition-harness.tsx';

describe('el anfitrión monta MDM como un sistema más (D-044)', () => {
  it('MDM figura en el registro con su raíz y reconoce solo sus roles', () => {
    const mdm = SYSTEM_REGISTRY.find((module) => module.code === 'MDM');
    expect(mdm?.routeRoots).toEqual(['mdm']);
    expect(mdm?.roleLabel('ANALISTA_DATOS_MAESTROS')).toBe('Analista de datos maestros');
    expect(mdm?.roleLabel('JEFATURA')).toBeNull();
    expect(SYSTEM_REGISTRY.map((module) => module.code)).toEqual(['MDM']);
  });

  it('desde el lanzador, la tarjeta de MDM abre «Organizaciones» con el perfil de la sesión', async () => {
    const { user } = renderApp(null, { user: 'rosa.medina', path: '/' });
    await user.click(await screen.findByRole('link', { name: /^MDM.*Sistema de Datos Maestros.*Analista de datos maestros · Callao/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Organizaciones' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'ACME' })).toBeInTheDocument();
    // El marco de MDM es el de SIL: riel con «Organizaciones» y el FAB arriba (G-584).
    const rail = screen.getByRole('navigation', { name: 'Navegación de MDM' });
    expect(within(rail).getByRole('link', { name: 'Organizaciones' })).toHaveAttribute('aria-current', 'page');
    expect(within(rail).getByRole('link', { name: 'Nueva organización' })).toBeInTheDocument();
  });

  it('el consultor lee la lista sin la acción de alta', async () => {
    renderApp(null, { user: 'carlos.vega', path: '/mdm/organizaciones' });
    expect(await screen.findByRole('link', { name: 'ACME' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Navegación de MDM' })).getByRole('link', { name: 'Organizaciones' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nueva organización' })).not.toBeInTheDocument();
  });

  it('sin perfil de MDM, la dirección no monta MDM', async () => {
    renderApp(null, { user: 'ana.perez', path: '/mdm/organizaciones' });
    expect(await screen.findByRole('link', { name: 'Volver al portal' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Organizaciones' })).not.toBeInTheDocument();
  });
});
