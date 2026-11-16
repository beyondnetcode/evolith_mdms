import { useSnackbar } from '@sil/ui';
import { useRef } from 'react';
import { useMdmGateway } from '../../../../application/gateway-context.ts';
import { attemptWrite, useLoadedVersion } from '../../../../application/party-writes.ts';
import { ConfirmDialog } from '../../../common/dialogs/ConfirmDialog.tsx';
import { useSubmitAction, type SubmitResult } from '../../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../../common/dialogs/WriteNotice.tsx';
import { logProblem } from '../../../common/problem-text.ts';
import { DIALOG_TEXTS as T } from '../texts.ts';
import type { PartyDialogProps } from './party-dialog.ts';

/**
 * D-MDM-08 «Archivar organización» (US-MDM-005; UX-MDM-001 §5.6 y §6.2): confirmación terminal que dice que es
 * definitivo y cuántos roles vigentes y establecimientos activos tiene, porque archivar no los termina ni los
 * cierra (G-572). Sin motivo: P-07 no tiene cuerpo. Foco inicial en «Cancelar».
 */
export function ArchiveDialog({ party, cache, onClose }: PartyDialogProps) {
  const gateway = useMdmGateway();
  const snackbar = useSnackbar();
  const loaded = useLoadedVersion(party.version, cache);
  const saved = useRef(false);
  const roles = party.roles.filter((role) => role.isCurrent).length;
  const establishments = party.establishments.filter((establishment) => establishment.isActive && !establishment.isClosed).length;

  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    if (saved.current) return { kind: 'idle' };
    const outcome = await attemptWrite(() => gateway.archiveParty(party.id, loaded.version));
    if (outcome.kind === 'saved') {
      saved.current = true;
      await cache.afterWrite();
      snackbar.show({ text: T.archived(party.code) });
      onClose();
      return { kind: 'idle' };
    }
    if (outcome.kind === 'conflict') return { kind: 'conflict' };
    logProblem('P-07', outcome.error);
    return { kind: 'failed', error: outcome.error };
  });

  async function reload(): Promise<void> {
    if ((await loaded.reload()) !== null) submit.dismiss();
  }

  return (
    <ConfirmDialog
      title={T.archiveTitle(party.code)}
      confirmLabel={T.archiveConfirm}
      tone="danger"
      onSubmit={submit.submit}
      pending={submit.pending}
      onCancel={onClose}
      notice={<WriteNotice state={submit.state} onReload={() => void reload()} onDiscard={onClose} reloading={loaded.reloading} />}
    >
      <p>
        La organización quedará en solo lectura y no se podrá reactivar. Sus {roles} roles vigentes y {establishments} establecimientos activos{' '}
        <strong>no</strong> se terminan ni se cierran. Su código y sus identificadores no podrán usarse en otra organización.
      </p>
    </ConfirmDialog>
  );
}
