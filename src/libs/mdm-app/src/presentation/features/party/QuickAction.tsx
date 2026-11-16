import { Button, InlineNotice, useSnackbar } from '@sil/ui';
import { useCallback, useState, useTransition } from 'react';
import { attemptWrite, type PartyCache } from '../../../application/party-writes.ts';
import { logProblem, problemText, type ProblemContext } from '../../common/problem-text.ts';

/**
 * Acciones reversibles de un clic (UX-MDM-001 §5.1): activar la organización, suspender y reactivar un rol, desactivar
 * y reactivar un establecimiento. No abren diálogo: se ejecutan desde el menú, confirman con una _snackbar_ y, si
 * fallan, explican el motivo en un aviso en línea que se anuncia (`role="alert"`). Envían el `If-Match` de la ficha.
 */
export interface QuickAction {
  /** Operación del contrato, para el registro de soporte (`P-06`, `P-13`…). */
  readonly operation: string;
  readonly write: () => Promise<unknown>;
  /** Texto de la _snackbar_ de éxito. */
  readonly success: string;
  /** Lo que el mensaje de error necesita de lo cargado. */
  readonly context?: ProblemContext;
}

export type QuickActionState =
  | { readonly kind: 'idle' }
  /** `412`: sin borrador que conservar, se ofrece «Recargar». */
  | { readonly kind: 'conflict' }
  | { readonly kind: 'failed'; readonly error: unknown; readonly context: ProblemContext };

export interface QuickActionRunner {
  readonly state: QuickActionState;
  readonly pending: boolean;
  readonly run: (action: QuickAction) => void;
  readonly dismiss: () => void;
}

export function useQuickAction(cache: PartyCache): QuickActionRunner {
  const snackbar = useSnackbar();
  const [state, setState] = useState<QuickActionState>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();
  const run = useCallback(
    (action: QuickAction) => {
      if (pending) return;
      startTransition(async () => {
        const outcome = await attemptWrite(action.write);
        if (outcome.kind === 'saved') {
          await cache.afterWrite();
          setState({ kind: 'idle' });
          snackbar.show({ text: action.success });
          return;
        }
        if (outcome.kind === 'conflict') {
          setState({ kind: 'conflict' });
          return;
        }
        logProblem(action.operation, outcome.error);
        setState({ kind: 'failed', error: outcome.error, context: action.context ?? {} });
      });
    },
    [pending, cache, snackbar],
  );
  const dismiss = useCallback(() => setState({ kind: 'idle' }), []);
  return { state, pending, run, dismiss };
}

/** `412` en una acción de un clic: sin borrador que conservar, del texto de §6.1 solo vale la primera frase. */
export const QUICK_ACTION_CONFLICT = 'Otra persona cambió esta organización mientras editabas.';

interface NoticeProps {
  readonly state: QuickActionState;
  /** «Recargar»: descarta el aviso y vuelve a leer la ficha. */
  readonly onReload: () => void;
}

export function QuickActionNotice({ state, onReload }: NoticeProps) {
  if (state.kind === 'idle') return null;
  const text = state.kind === 'conflict' ? { message: QUICK_ACTION_CONFLICT, hint: null, reload: true } : problemText(state.error, state.context);
  return (
    <InlineNotice
      severity="error"
      announce
      title={text.message}
      actions={
        text.reload ? (
          <Button variant="text-inherit" onClick={onReload}>
            Recargar
          </Button>
        ) : undefined
      }
    >
      {text.hint ?? undefined}
    </InlineNotice>
  );
}
