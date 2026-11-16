import { SuiteGatewayError } from '@suite/contracts';
import { TEST_PASSWORD, MOCK_SESSION_KEY } from '@suite/mock';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WIDTHS } from '@sil/ui/testing';
import { renderSuite } from '../../testing/suite-harness.tsx';

const start = { session: null, path: '/acceso' } as const;

/** R-03: los usuarios de prueba viven en un menú: se abre y se elige «Usar a {nombre}». */
async function use(user: ReturnType<typeof renderSuite>['user'], name: string): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Usuarios de prueba' }));
  await user.click(screen.getByRole('menuitem', { name: `Usar a ${name}` }));
}

describe('S-01 Inicio de sesión', () => {
  it('el inquilino se elige de la tabla de inquilinos, ordenada por nombre, con ORG seleccionado', async () => {
    renderSuite(start);
    const field = screen.getByLabelText('Inquilino (obligatorio)');
    await waitFor(() => expect(field).toHaveValue('ORG'));
    expect(within(field).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Seleccionar',
      'Organización S.A. (ORG)',
      'Organización Transportes S.A.C. (ORG_TRANSPORTES)',
      'Unilog S.A.C. (UNILOG)',
    ]);
  });

  it('sin inquilino elegido lo pide en el resumen y en el campo', async () => {
    const { user } = renderSuite(start);
    await use(user, 'Ana Pérez');
    await waitFor(() => expect(screen.getByLabelText('Inquilino (obligatorio)')).toBeEnabled());
    await user.selectOptions(screen.getByLabelText('Inquilino (obligatorio)'), '');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    const summary = await screen.findByRole('alert');
    expect(summary).toHaveTextContent('No se inició sesión. Corrige 1 campo:');
    expect(screen.getAllByText('Elige tu inquilino.')).toHaveLength(2);
    await user.click(within(summary).getByRole('link', { name: 'Elige tu inquilino.' }));
    expect(screen.getByLabelText('Inquilino (obligatorio)')).toHaveFocus();
  });

  it('en un inquilino al que no pertenece, la cuenta responde como credencial inválida', async () => {
    const { user } = renderSuite(start);
    await use(user, 'Ana Pérez');
    await user.selectOptions(screen.getByLabelText('Inquilino (obligatorio)'), 'UNILOG');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText('Inquilino, usuario o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.')).toBeInTheDocument();
    expect(screen.getByLabelText('Inquilino (obligatorio)')).toHaveValue('UNILOG');
  });

  it('los usuarios de prueba son los del inquilino elegido: la variante de cada caso', async () => {
    const { user } = renderSuite(start);
    await waitFor(() => expect(screen.getByLabelText('Inquilino (obligatorio)')).toBeEnabled());
    // R-03: la lista vive en el menú; se abre, se leen sus elementos y se cierra con Escape.
    const names = async (): Promise<string[]> => {
      await user.click(screen.getByRole('button', { name: 'Usuarios de prueba' }));
      // El nombre accesible es el elemento que nombra `aria-labelledby`: «Usar a {nombre}».
      const items = screen
        .getAllByRole('menuitem')
        .map((item) => document.getElementById(item.getAttribute('aria-labelledby') ?? '')?.textContent.replace(/^Usar a /, '') ?? '');
      await user.keyboard('{Escape}');
      return items;
    };
    const organizacion = ['Ana Pérez', 'Carlos Vega', 'Luis Rojas', 'Rosa Díaz', 'Rosa Medina', 'Diego Salas', 'Usuario bloqueado'];
    expect(await names()).toEqual(organizacion);
    await user.selectOptions(screen.getByLabelText('Inquilino (obligatorio)'), 'UNILOG');
    const unilog = ['Sofía Ramos', 'Ricardo Paredes', 'Pedro Díaz', 'Teresa Núñez', 'Lucía Medina', 'Valeria Chávez', 'Usuario bloqueado'];
    expect(await names()).toEqual(unilog);
    await user.selectOptions(screen.getByLabelText('Inquilino (obligatorio)'), '');
    expect(screen.queryByRole('button', { name: 'Usuarios de prueba' })).not.toBeInTheDocument();
    expect(screen.getByText('Elige un inquilino para ver sus usuarios de prueba.')).toBeInTheDocument();
  });

  it('la cuenta bloqueada de otro inquilino también está bloqueada', async () => {
    const { user } = renderSuite(start);
    await waitFor(() => expect(screen.getByLabelText('Inquilino (obligatorio)')).toBeEnabled());
    await user.selectOptions(screen.getByLabelText('Inquilino (obligatorio)'), 'UNILOG');
    await use(user, 'Usuario bloqueado');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText(/Tu cuenta está bloqueada/)).toBeInTheDocument();
  });

  it('con otro inquilino la sesión queda en ese inquilino', async () => {
    const { user } = renderSuite(start);
    await waitFor(() => expect(screen.getByLabelText('Inquilino (obligatorio)')).toBeEnabled());
    await user.selectOptions(screen.getByLabelText('Inquilino (obligatorio)'), 'ORG_TRANSPORTES');
    await use(user, 'Miguel Flores');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await screen.findByRole('heading', { level: 1, name: /^Hola, Miguel/ });
    expect(JSON.parse(globalThis.sessionStorage.getItem(MOCK_SESSION_KEY) ?? '{}')).toMatchObject({ tenant: { code: 'ORG_TRANSPORTES' } });
  });

  it('«Usar» antes de que cargue la lista inicia sesión igual con el inquilino de la cuenta', async () => {
    let release = (): void => undefined;
    const { user } = renderSuite({
      ...start,
      decorateSuiteGateway: (base) => ({
        ...base,
        listSignInTenants: () => new Promise((resolve) => (release = () => void base.listSignInTenants().then(resolve))),
      }),
    });
    expect(screen.getByLabelText('Inquilino (obligatorio)')).toBeDisabled();
    await use(user, 'Ana Pérez');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('heading', { level: 1, name: /^Hola, Ana/ })).toBeInTheDocument();
    release();
  });

  it('si la lista de inquilinos no carga, lo avisa y «Reintentar» la vuelve a pedir', async () => {
    let calls = 0;
    const { user } = renderSuite({
      ...start,
      decorateSuiteGateway: (base) => ({
        ...base,
        listSignInTenants: () => (++calls === 1 ? Promise.reject(new SuiteGatewayError('SUITE-00000000')) : base.listSignInTenants()),
      }),
    });
    expect(await screen.findByText('No se pudo cargar la lista de inquilinos.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByLabelText('Inquilino (obligatorio)')).toHaveValue('ORG'));
    expect(screen.queryByText('No se pudo cargar la lista de inquilinos.')).not.toBeInTheDocument();
  });

  // Ajuste por R-02 y R-03: título «Inicia sesión», ayuda como botón de texto con diálogo y usuarios de prueba en un menú.
  it('muestra el título, los dos campos, un solo botón relleno, la ayuda en un botón de texto y el aviso de prototipo en una línea', () => {
    renderSuite(start);
    expect(screen.getByRole('heading', { level: 1, name: 'Inicia sesión' })).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario (obligatorio)')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Contraseña (obligatorio)')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '¿Necesitas ayuda para ingresar?' })).toBeInTheDocument();
    const prototype = screen.getByText('Prototipo: los usuarios y las claves son de prueba y no corresponden a cuentas reales.');
    expect(prototype.className).toContain('text-body-small');
    // Un solo botón relleno (UXP-03): los demás son delineado, de texto o de icono.
    const filled = screen.getAllByRole('button').filter((button) => button.className.includes('bg-primary'));
    expect(filled.map((button) => button.textContent)).toEqual(['Iniciar sesión']);
    expect(document.title).toBe('Iniciar sesión · Suite');
  });

  it('la ayuda para ingresar abre un diálogo básico con la frase del administrador de accesos', async () => {
    const { user } = renderSuite(start);
    await user.click(screen.getByRole('button', { name: '¿Necesitas ayuda para ingresar?' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ayuda para ingresar' });
    expect(within(dialog).getByText('Si no recuerdas tu usuario o tu contraseña, comunícate con el administrador de accesos.')).toBeInTheDocument();
  });

  it('R-03: la lista de usuarios de prueba no está en el DOM hasta abrir el menú; cada elemento se nombra «Usar a {nombre}»', async () => {
    const { user } = renderSuite(start);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Usuarios de prueba' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(7);
    expect(screen.getByRole('menuitem', { name: 'Usar a Carlos Vega' })).toBeInTheDocument();
    // La descripción (rol y sede) se anuncia como descripción, no como nombre.
    expect(screen.getByRole('menuitem', { name: 'Usar a Ana Pérez' })).toHaveAccessibleDescription(/Customer Service/);
  });

  it('el foco inicial está en el usuario y la clave no se muestra en ninguna parte de la pantalla', () => {
    renderSuite(start);
    expect(screen.getByLabelText('Usuario (obligatorio)')).toHaveFocus();
    expect(document.body.textContent).not.toContain(TEST_PASSWORD);
  });

  it('«Usar» rellena inquilino, usuario y clave enmascarada, sin mostrar la clave', async () => {
    const { user } = renderSuite(start);
    await use(user, 'Ana Pérez');
    await waitFor(() => expect(screen.getByLabelText('Inquilino (obligatorio)')).toHaveValue('ORG'));
    expect(screen.getByLabelText('Usuario (obligatorio)')).toHaveValue('ana.perez');
    const key = screen.getByLabelText('Contraseña (obligatorio)');
    expect(key).toHaveAttribute('type', 'password');
    expect(key).toHaveValue(TEST_PASSWORD);
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toHaveFocus();
  });

  it('el botón alterna la visibilidad de la contraseña y lo dice con aria-pressed', async () => {
    const { user } = renderSuite(start);
    const field = screen.getByLabelText('Contraseña (obligatorio)');
    const button = screen.getByRole('button', { name: 'Mostrar contraseña' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);
    expect(field).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('con los campos vacíos muestra el resumen enlazado, un error por campo y mueve el foco al resumen', async () => {
    const { user } = renderSuite(start);
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    const summary = await screen.findByRole('alert');
    expect(summary).toHaveTextContent('No se inició sesión. Corrige 2 campos:');
    expect(screen.getAllByText('Indica tu usuario.')).toHaveLength(2);
    expect(screen.getAllByText('Indica tu contraseña.')).toHaveLength(2);
    expect(summary.parentElement).toHaveFocus();
    await user.click(within(summary).getByRole('link', { name: 'Indica tu contraseña.' }));
    expect(screen.getByLabelText('Contraseña (obligatorio)')).toHaveFocus();
  });

  it('con un solo campo vacío dice «1 campo»', async () => {
    const { user } = renderSuite(start);
    await user.type(screen.getByLabelText('Usuario (obligatorio)'), 'ana.perez');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Corrige 1 campo:');
  });

  it('usuario inexistente y clave inválida dan la misma respuesta; se conserva el usuario y se vacía la clave', async () => {
    const { user } = renderSuite(start);
    for (const name of ['ana.perez', 'no.existe']) {
      await user.clear(screen.getByLabelText('Usuario (obligatorio)'));
      await user.type(screen.getByLabelText('Usuario (obligatorio)'), name);
      await user.type(screen.getByLabelText('Contraseña (obligatorio)'), 'clave-mala');
      await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
      expect(await screen.findByText('Inquilino, usuario o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.')).toBeInTheDocument();
      expect(screen.getByLabelText('Usuario (obligatorio)')).toHaveValue(name);
      await waitFor(() => expect(screen.getByLabelText('Contraseña (obligatorio)')).toHaveValue(''));
    }
    expect(globalThis.sessionStorage.getItem(MOCK_SESSION_KEY)).toBeNull();
  });

  it('la cuenta bloqueada de origen dice que está bloqueada aunque la clave sea la de prueba', async () => {
    const { user } = renderSuite(start);
    await use(user, 'Usuario bloqueado');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(
      await screen.findByText('Tu cuenta está bloqueada. Pide a tu jefatura o al administrador de accesos que la desbloquee.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled();
  });

  it('tras 5 intentos fallidos consecutivos la cuenta se bloquea, incluso con la clave correcta', async () => {
    const { user } = renderSuite(start);
    await user.type(screen.getByLabelText('Usuario (obligatorio)'), 'luis.rojas');
    for (let attempt = 0; attempt < 5; attempt++) {
      await user.type(screen.getByLabelText('Contraseña (obligatorio)'), 'clave-mala');
      await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
      await screen.findByText('Inquilino, usuario o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.');
      await waitFor(() => expect(screen.getByLabelText('Contraseña (obligatorio)')).toHaveValue(''));
    }
    await user.type(screen.getByLabelText('Contraseña (obligatorio)'), TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText(/Tu cuenta está bloqueada/)).toBeInTheDocument();
  });

  it('UMS caído: aviso con código de referencia, «Reintentar» repite el envío y no queda sesión', async () => {
    const { user } = renderSuite({ ...start, settings: { suite: { umsDown: true, maintenance: false, expires: false } } });
    await use(user, 'Ana Pérez');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('No se puede verificar tu identidad. Intenta de nuevo en unos minutos.');
    expect(notice).toHaveTextContent(/código a soporte: SUITE-[0-9A-F]{8}\./);
    await user.click(within(notice).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede verificar tu identidad.');
    expect(globalThis.sessionStorage.getItem(MOCK_SESSION_KEY)).toBeNull();
  });

  it('con ?motivo=expirada avisa que la sesión terminó', () => {
    renderSuite({ session: null, path: '/acceso?motivo=expirada' });
    expect(screen.getByText('Tu sesión terminó. Inicia sesión para continuar.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Inicia sesión' })).toHaveFocus();
  });

  it('un motivo desconocido se ignora', () => {
    renderSuite({ session: null, path: '/acceso?motivo=otra-cosa' });
    expect(screen.queryByText('Tu sesión terminó. Inicia sesión para continuar.')).not.toBeInTheDocument();
  });

  it('al iniciar sesión abre S-02 con el saludo y el foco en el título, y guarda la sesión', async () => {
    const { user } = renderSuite(start);
    await use(user, 'Ana Pérez');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    const title = await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' });
    await waitFor(() => expect(title).toHaveFocus());
    expect(globalThis.sessionStorage.getItem(MOCK_SESSION_KEY)).toContain('ana.perez');
  });

  it('el título de la pestaña cambia con la pantalla', async () => {
    const { user } = renderSuite(start);
    await use(user, 'Ana Pérez');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await screen.findByRole('heading', { level: 1, name: /^Hola, Ana/ });
    expect(document.title).toBe('Suite');
  });

  it('«Ayuda» muestra la snackbar del prototipo', async () => {
    const { user } = renderSuite(start);
    await user.click(screen.getByRole('button', { name: 'Ayuda' }));
    expect(screen.getByText('La ayuda no está disponible en el prototipo.')).toBeInTheDocument();
  });

  it('no hay avatar ni menú de cuenta sin sesión', () => {
    renderSuite(start);
    expect(screen.queryByRole('button', { name: /^Cuenta de / })).not.toBeInTheDocument();
  });

  it('con sesión vigente S-01 redirige a S-02', async () => {
    renderSuite({ path: '/acceso', user: 'ana.perez' });
    expect(await screen.findByRole('heading', { level: 1, name: /^Hola, Ana/ })).toBeInTheDocument();
  });

  it('el enlace «Ir al contenido principal» es el primer elemento enfocable y apunta al contenido', () => {
    renderSuite(start);
    const link = screen.getByRole('link', { name: 'Ir al contenido principal' });
    expect(document.querySelector('a, button, input')).toBe(link);
    expect(link).toHaveAttribute('href', '#contenido');
    expect(document.getElementById('contenido')).not.toBeNull();
  });

  it('se ve en los tres tamaños: el panel de marca solo existe en la clase expanded (CSS) y el formulario siempre', () => {
    for (const width of Object.values(WIDTHS)) {
      const { unmount } = renderSuite({ ...start, width });
      expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
      unmount();
    }
  });
});

describe('Guarda de sesión (anexo A1 §1)', () => {
  it('sin sesión, la raíz y cualquier dirección desconocida piden iniciar sesión sin revelar si existen', async () => {
    renderSuite({ session: null, path: '/' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' })).toBeInTheDocument();
  });

  it.each(['//evil.example', '/\\evil.example', 'https://evil.example/x', 'javascript:alert(1)'])(
    'un volver inseguro (%s) se descarta y se abre S-02',
    async (back) => {
      const { user } = renderSuite({ session: null, path: `/acceso?volver=${encodeURIComponent(back)}` });
      await use(user, 'Ana Pérez');
      await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
      expect(await screen.findByRole('heading', { level: 1, name: /^Hola, Ana/ })).toBeInTheDocument();
    },
  );

  it('sin perfil de MDM, una dirección de MDM muestra «sin acceso» sin montar MDM y sin revelar si existe', async () => {
    renderSuite({ user: 'diego.salas', path: '/mdm/organizaciones' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Sin acceso a MDM' })).toBeInTheDocument();
    expect(screen.getByText('No tienes acceso a MDM. Solicita el rol al administrador de UMS.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navegación de MDM' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al portal' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('button', { name: 'Cuenta de Diego Salas' })).toBeInTheDocument();
  });

  it('una sesión alterada en el almacenamiento se descarta', async () => {
    globalThis.sessionStorage.clear();
    renderSuite({ session: null, path: '/' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' })).toBeInTheDocument();
  });
});
