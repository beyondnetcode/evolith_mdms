import { useMdmGateway } from '../../../../application/gateway-context.ts';
import { attemptWrite, useLoadedVersion } from '../../../../application/party-writes.ts';
import { ConfirmDialog } from '../../../common/dialogs/ConfirmDialog.tsx';
import { useSubmitAction, type SubmitResult } from '../../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../../common/dialogs/WriteNotice.tsx';
import { logProblem } from '../../../common/problem-text.ts';
import { useRef } from 'react';
import { DIALOG_TEXTS as T } from '../texts.ts';
import type { PartyDialogProps } from './party-dialog.ts';

/**
 * D-MDM-13 «Suspender organización» (US-MDM-005; UX-MDM-001 §5.6 y §6.2): confirmación reversible, sin motivo
 * (P-05 no lo pide en la UX hasta que el contrato lo guarde, G-331), que enumera lo que queda deshabilitado. Al
 * terminar, la ficha muestra el aviso de suspendida.
 */
export function SuspendDialog({ party, cache, onClose }: PartyDialogProps) {
  const gateway = useMdmGateway();
  const loaded = useLoadedVersion(party.version, cache);
  const saved = useRef(false);

  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    if (saved.current) return { kind: 'idle' };
    const outcome = await attemptWrite(() => gateway.suspendParty(party.id, { reason: null }, loaded.version));
    if (outcome.kind === 'saved') {
      saved.current = true;
      await cache.afterWrite();
      onClose();
      return { kind: 'idle' };
    }
    if (outcome.kind === 'conflict') return { kind: 'conflict' };
    logProblem('P-05', outcome.error);
    return { kind: 'failed', error: outcome.error };
  });

  async function reload(): Promise<void> {
    if ((await loaded.reload()) !== null) submit.dismiss();
  }

  return (
    <ConfirmDialog
      title={T.suspendTitle(party.code)}
      confirmLabel={T.suspendConfirm}
      tone="primary"
      onSubmit={submit.submit}
      pending={submit.pending}
      onCancel={onClose}
      notice={
        <WriteNotice
          state={submit.state}
          onReload={() => void reload()}
          onDiscard={onClose}
          reloading={loaded.reloading}
          context={{ partyStatus: 'Suspended' }}
        />
      }
    >
      <p>{T.suspendBody}</p>
      <ul className="flex list-disc flex-col gap-1 ps-5">
        {T.suspendedList.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </ConfirmDialog>
  );
}
