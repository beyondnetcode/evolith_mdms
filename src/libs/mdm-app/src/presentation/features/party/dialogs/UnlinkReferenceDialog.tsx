import type { ExternalReference } from '@mdm/contracts';
import { useSnackbar } from '@sil/ui';
import { useCallback, useRef } from 'react';
import { useMdmGateway } from '../../../../application/gateway-context.ts';
import { useLinkCache, useLinkVersion } from '../../../../application/link-writes.ts';
import { attemptWrite } from '../../../../application/party-writes.ts';
import { ConfirmDialog } from '../../../common/dialogs/ConfirmDialog.tsx';
import { useSubmitAction, type SubmitResult } from '../../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../../common/dialogs/WriteNotice.tsx';
import { logProblem } from '../../../common/problem-text.ts';
import { referenceObjectInSentence } from '../ExternalReferencesPanel.tsx';
import { REFERENCE_TEXTS as T } from '../texts.ts';
import type { PartyDialogProps } from './party-dialog.ts';

interface Props extends PartyDialogProps {
  readonly reference: ExternalReference;
}

/**
 * D-MDM-12 «Desvincular referencia externa» (US-MDM-012; UX-MDM-001 §5.6 y §6.2): confirmación terminal con sistema,
 * instancia, clave y objeto, y el aviso de que la clave no podrá vincularse a otro objeto (G-574). Sin motivo: X-04 no
 * tiene cuerpo. Envía la versión de la referencia (su propio agregado). Desvinculada, queda visible y sin acciones.
 */
export function UnlinkReferenceDialog({ party, reference, onClose }: Props) {
  const gateway = useMdmGateway();
  const snackbar = useSnackbar();
  const links = useLinkCache(party.id);
  const read = useCallback(() => links.readReference(reference.id), [links, reference.id]);
  const loaded = useLinkVersion(reference.version, read);
  const saved = useRef(false);
  const object = referenceObjectInSentence(reference, party.code, party.establishments);

  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    if (saved.current) return { kind: 'idle' };
    const outcome = await attemptWrite(() => gateway.unlinkExternalReference(reference.id, loaded.version));
    if (outcome.kind === 'saved') {
      saved.current = true;
      await links.afterReferenceWrite();
      snackbar.show({ text: T.unlinked });
      onClose();
      return { kind: 'idle' };
    }
    if (outcome.kind === 'conflict') return { kind: 'conflict' };
    logProblem('X-04', outcome.error);
    return { kind: 'failed', error: outcome.error };
  });

  async function reload(): Promise<void> {
    if (await loaded.reload()) submit.dismiss();
  }

  return (
    <ConfirmDialog
      title={T.unlinkTitle(reference.externalKey)}
      confirmLabel={T.unlinkConfirm}
      tone="danger"
      onSubmit={submit.submit}
      pending={submit.pending}
      onCancel={onClose}
      notice={
        <WriteNotice
          state={submit.state}
          onReload={() => void reload()}
          onDiscard={onClose}
          reloading={loaded.reloading}
          context={{ notFoundSubject: 'la referencia' }}
          conflictText={T.conflict}
        />
      }
    >
      <p className="text-body-large text-on-surface">{T.line(reference.systemCode, reference.systemInstance, reference.externalObjectType, reference.externalKey)}</p>
      <p>{T.unlinkBody(reference.systemCode, reference.systemInstance, object)}</p>
    </ConfirmDialog>
  );
}
