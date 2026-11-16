import { screen, within } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { setSystemScheme } from '@sil/ui/testing';
import { renderSuite } from '../../testing/suite-harness.tsx';

describe('selector de tema en el menú de cuenta', () => {
  beforeEach(() => {
    setSystemScheme('light');
  });

  async function openMenu(options: Parameters<typeof renderSuite>[0] = { path: '/', user: 'ana.perez' }) {
    const app = renderSuite(options);
    await app.user.click(await screen.findByRole('button', { name: /^Cuenta de / }));
    return { ...app, group: screen.getByRole('group', { name: 'Tema' }) };
  }

  it('son tres botones de opción en un grupo con leyenda; por defecto «Seguir al sistema»', async () => {
    const { group } = await openMenu();
    const options = within(group).getAllByRole('radio');
    expect(options.map((o) => o.closest('label')?.textContent)).toEqual(['Claro', 'Oscuro', 'Seguir al sistema']);
    expect(within(group).getByRole('radio', { name: 'Seguir al sistema' })).toBeChecked();
    expect(within(group).getByText('Sigue el esquema de tu dispositivo (hoy: claro).')).toBeInTheDocument();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('el texto de apoyo sigue al sistema operativo en vivo, sin recargar', async () => {
    setSystemScheme('dark');
    const { group } = await openMenu();
    expect(within(group).getByText('Sigue el esquema de tu dispositivo (hoy: oscuro).')).toBeInTheDocument();
  });

  it('elegir Oscuro tiene efecto inmediato: data-theme, apoyo y almacenamiento por usuario y por dispositivo', async () => {
    const { group, user } = await openMenu();
    await user.click(within(group).getByRole('radio', { name: 'Oscuro' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(within(group).getByText('Siempre oscuro.')).toBeInTheDocument();
    expect(globalThis.localStorage.getItem('suite.tema.ana.perez')).toBe('dark');
    expect(globalThis.localStorage.getItem('suite.tema')).toBe('dark');
    await user.click(within(group).getByRole('radio', { name: 'Claro' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(within(group).getByText('Siempre claro.')).toBeInTheDocument();
    await user.click(within(group).getByRole('radio', { name: 'Seguir al sistema' }));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('se mueve con las flechas y no cierra el menú', async () => {
    const { group, user } = await openMenu();
    within(group).getByRole('radio', { name: 'Seguir al sistema' }).focus();
    await user.keyboard('{ArrowUp}');
    expect(within(group).getByRole('radio', { name: 'Oscuro' })).toBeChecked();
    expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument();
  });

  it('otra pestaña que cambia la preferencia (evento storage) se refleja aquí', async () => {
    const { group } = await openMenu();
    act(() => {
      globalThis.localStorage.setItem('suite.tema', 'dark');
      globalThis.dispatchEvent(new StorageEvent('storage', { key: 'suite.tema', newValue: 'dark' }));
    });
    expect(within(group).getByRole('radio', { name: 'Oscuro' })).toBeChecked();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('la preferencia es por usuario: cada quien ve la suya y, sin la suya, la última del dispositivo', async () => {
    const saved = { 'suite.tema.ana.perez': 'dark', 'suite.tema.luis.rojas': 'light', 'suite.tema': 'dark' };
    const ana = await openMenu({ path: '/', user: 'ana.perez', localStorageSeed: saved });
    expect(within(ana.group).getByRole('radio', { name: 'Oscuro' })).toBeChecked();
    expect(document.documentElement.dataset.theme).toBe('dark');
    ana.unmount();
    const luis = await openMenu({ path: '/', user: 'luis.rojas', localStorageSeed: saved });
    expect(within(luis.group).getByRole('radio', { name: 'Claro' })).toBeChecked();
    expect(document.documentElement.dataset.theme).toBe('light');
    luis.unmount();
    const carlos = await openMenu({ path: '/', user: 'carlos.vega', localStorageSeed: { 'suite.tema': 'oscuro' } });
    expect(within(carlos.group).getByRole('radio', { name: 'Oscuro' })).toBeChecked();
  });

  it('un valor corrupto guardado se descarta: queda «Seguir al sistema»', async () => {
    const { group } = await openMenu({ path: '/', user: 'ana.perez', localStorageSeed: { 'suite.tema.ana.perez': '<img onerror=x>', 'suite.tema': 'rojo' } });
    expect(within(group).getByRole('radio', { name: 'Seguir al sistema' })).toBeChecked();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});

describe('botón «Tema» de S-01 (sin menú de cuenta)', () => {
  it('su nombre dice el valor, abre el grupo, cambia el icono y Escape devuelve el foco', async () => {
    setSystemScheme('light');
    const { user } = renderSuite({ path: '/acceso', session: null });
    const button = await screen.findByRole('button', { name: 'Tema: Seguir al sistema' });
    expect(screen.queryByRole('button', { name: /^Cuenta de / })).not.toBeInTheDocument();
    await user.click(button);
    await user.click(within(screen.getByRole('group', { name: 'Tema' })).getByRole('radio', { name: 'Claro' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getByRole('button', { name: 'Tema: Claro' })).toBe(button);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Tema' })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    // Sin sesión solo existe la clave del dispositivo.
    expect(globalThis.localStorage.getItem('suite.tema')).toBe('light');
    expect(globalThis.localStorage.length).toBe(1);
  });
});
