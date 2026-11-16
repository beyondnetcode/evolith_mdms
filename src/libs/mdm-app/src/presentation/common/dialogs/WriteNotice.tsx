import { Button, InlineNotice } from '@sil/ui';
import { problemText, type ProblemContext } from '../problem-text.ts';
import { VersionConflictNotice } from '../VersionConflictNotice.tsx';
import type { SubmitState } from './use-submit-action.ts';

interface Props {
  readonly state: SubmitState;
  /** «Recargar y revisar» / «Recargar». Sin él (un alta: no hay versión que recargar), no se ofrece. */
  readonly onReload?: () => void;
  /** «Descartar mis cambios». */
  readonly onDiscard?: () => void;
  readonly reloading?: boolean;
  readonly context?: ProblemContext;
  /** Texto de D-MDM-14 para lo que tiene versión propia (relación, referencia). */
  readonly conflictText?: string;
}

/**
 * Aviso del último envío al inicio del formulario (UX-MDM-001 §5.6): D-MDM-14 ante `412` o el mensaje de §6.1 del
 * error sin campo, con «Recargar» cuando es lo que se sugiere. Se anuncia (`role="alert"`): aparece tras una acción.
 */
export function WriteNotice({ state, onReload, onDiscard, reloading = false, context, conflictText }: Props) {
  if (state.kind === 'conflict' && onReload !== undefined && onDiscard !== undefined) {
    return <VersionConflictNotice onReload={onReload} onDiscard={onDiscard} busy={reloading} {...(conflictText === undefined ? {} : { text: conflictText })} />;
  }
  if (state.kind !== 'failed') return null;
  const text = problemText(state.error, context);
  return (
    <InlineNotice
      severity="error"
      announce
      title={text.message}
      actions={
        text.reload && onReload !== undefined ? (
          <Button variant="text-inherit" onClick={onReload} disabled={reloading} aria-busy={reloading}>
            Recargar
          </Button>
        ) : undefined
      }
    >
      {text.hint ?? undefined}
    </InlineNotice>
  );
}
