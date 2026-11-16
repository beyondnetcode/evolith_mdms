/*
 * jsdom no implementa `HTMLDialogElement.showModal()` ni `close()`: `ModalDialog` de `ui-sil` cae a marcar `open` y
 * entonces `Escape` no hace nada. Este sustituto, SOLO PARA PRUEBAS, reproduce lo que la plataforma hace y la
 * interfaz necesita observar: `showModal` abre en modo modal, `Escape` lanza `cancel` (cancelable) y, si nadie lo
 * impide, cierra; `close` quita `open` y lanza `close`. La trampa del foco y el resto `inert` son de la plataforma:
 * no se reproducen aquí y quedan para la prueba en navegador (G-569).
 */

interface Installed {
  readonly uninstall: () => void;
}

export function installDialogPolyfill(): Installed {
  const prototype = HTMLDialogElement.prototype;
  const originalShowModal = Object.getOwnPropertyDescriptor(prototype, 'showModal');
  const originalClose = Object.getOwnPropertyDescriptor(prototype, 'close');
  const stack: HTMLDialogElement[] = [];

  Object.defineProperty(prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '');
      stack.push(this);
    },
  });
  Object.defineProperty(prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      stack.splice(stack.indexOf(this), 1);
      this.dispatchEvent(new Event('close'));
    },
  });

  const onKeyDown = (event: KeyboardEvent): void => {
    // El diálogo de arriba que siga en el documento (React puede haberlo desmontado sin cerrarlo).
    const top = stack.filter((dialog) => dialog.isConnected).at(-1);
    if (event.key !== 'Escape' || top === undefined || event.defaultPrevented) return;
    const cancel = new Event('cancel', { cancelable: true });
    top.dispatchEvent(cancel);
    if (!cancel.defaultPrevented) top.close();
  };
  document.addEventListener('keydown', onKeyDown);

  return {
    uninstall: () => {
      document.removeEventListener('keydown', onKeyDown);
      if (originalShowModal === undefined) Reflect.deleteProperty(prototype, 'showModal');
      else Object.defineProperty(prototype, 'showModal', originalShowModal);
      if (originalClose === undefined) Reflect.deleteProperty(prototype, 'close');
      else Object.defineProperty(prototype, 'close', originalClose);
    },
  };
}
