import { startTransition, useActionState, useCallback, useState, type SubmitEvent } from 'react';

/** Resultado de un envío, como unión discriminada. `attempt` numera los envíos (para reenfocar y descartar avisos). */
export type SubmitResult =
  | { readonly kind: 'idle' }
  /** Hay errores de campo (locales o del servidor): el resumen recibe el foco. */
  | { readonly kind: 'invalid' }
  /** `412`: D-MDM-14. */
  | { readonly kind: 'conflict' }
  /** Error sin campo: aviso en línea al inicio del formulario. */
  | { readonly kind: 'failed'; readonly error: unknown };

export type SubmitState = SubmitResult & { readonly attempt: number };

const INITIAL: SubmitState = { kind: 'idle', attempt: 0 };

export interface SubmitAction {
  /** Último resultado, salvo que la persona lo haya descartado. */
  readonly state: SubmitState;
  /** `onSubmit` del formulario: lanza la acción en una transición. Mientras hay un envío en curso, no hace nada. */
  readonly submit: (event: SubmitEvent<HTMLFormElement>) => void;
  readonly pending: boolean;
  /** Oculta el aviso del último envío (tras «Recargar y revisar»). */
  readonly dismiss: () => void;
}

/**
 * Envío de un formulario con las Actions de React 19 (`useActionState`): la acción valida, escribe y devuelve su
 * resultado; React lleva el estado pendiente y serializa los envíos. Los valores viven en el estado del componente
 * (controlados), así que un error nunca borra lo escrito (WCAG 3.3.7).
 *
 * Se lanza desde `onSubmit` dentro de `startTransition` y no con `<form action>`: tras una acción con `action`, React
 * restablece el formulario (`form.reset()`) y un `<select>` controlado pierde su valor en el DOM aunque el estado lo
 * conserve. Con `onSubmit` no hay restablecimiento y el resto (pendiente, serialización) es igual.
 */
export function useSubmitAction(run: () => Promise<SubmitResult>): SubmitAction {
  const [state, dispatch, pending] = useActionState<SubmitState, FormData>(async (previous) => ({ ...(await run()), attempt: previous.attempt + 1 }), INITIAL);
  const [dismissed, setDismissed] = useState(0);
  const dismiss = useCallback(() => setDismissed(state.attempt), [state.attempt]);
  const submit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending) return;
      const data = new FormData(event.currentTarget);
      startTransition(() => dispatch(data));
    },
    [pending, dispatch],
  );
  return { state: state.attempt > dismissed ? state : { kind: 'idle', attempt: state.attempt }, submit, pending, dismiss };
}
