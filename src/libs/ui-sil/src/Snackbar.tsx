import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, IconButton } from './Button.tsx';
import { Icon } from './Icon.tsx';

interface Message {
  readonly text: string;
  readonly action?: { readonly label: string; readonly onPress: () => void };
}

interface SnackbarContext {
  readonly show: (message: Message) => void;
}

const Context = createContext<SnackbarContext | null>(null);

const DURATION_MS = 6000;

/**
 * Snackbar de M3 para lo transitorio (resultado de guardar, copiado). Una sola acción de texto y el cierre como
 * botón de icono de 48 dp (nunca dos botones de texto, UI-15); de 344 a 560 dp de ancho. Si lleva acción no se
 * cierra sola. La región en vivo existe siempre, vacía, para que el lector anuncie el cambio
 * (WCAG 4.1.3).
 */
export function SnackbarProvider({ children }: { readonly children: ReactNode }) {
  const [message, setMessage] = useState<Message | null>(null);
  const show = useCallback((created: Message) => setMessage(created), []);
  const value = useMemo(() => ({ show: show }), [show]);

  useEffect(() => {
    if (message === null || message.action !== undefined) return;
    const timer = setTimeout(() => setMessage(null), DURATION_MS);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <Context value={value}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pb-24 expanded:pb-4">
        {message !== null && (
          <div className="pointer-events-auto flex min-h-12 w-full max-w-140 min-w-86 items-center gap-2 rounded-xs bg-inverse-surface py-1 pr-1 pl-4 text-body-medium text-inverse-on-surface shadow-level-3">
            <span className="min-w-0 flex-1">{message.text}</span>
            {message.action !== undefined && (
              <Button
                variant="text-inverse"
                onClick={() => {
                  message.action?.onPress();
                  setMessage(null);
                }}
              >
                {message.action.label}
              </Button>
            )}
            <IconButton aria-label="Cerrar" inverse onClick={() => setMessage(null)}>
              <Icon name="close" />
            </IconButton>
          </div>
        )}
      </div>
    </Context>
  );
}

export function useSnackbar(): SnackbarContext {
  const context = use(Context);
  if (context === null) throw new Error('useSnackbar requiere un SnackbarProvider');
  return context;
}
