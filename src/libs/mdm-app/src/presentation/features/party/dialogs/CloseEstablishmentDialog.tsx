import type { Establishment } from '@mdm/contracts';
import { InlineNotice, useSnackbar } from '@sil/ui';
import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useMdmGateway } from '../../../../application/gateway-context.ts';
import { attemptWrite, useLoadedVersion } from '../../../../application/party-writes.ts';
import { mdmQueries } from '../../../../application/queries.ts';
import { useMdmSession } from '../../../../application/session-context.ts';
import { linkedCount } from '../../../../domain/reference-form.ts';
import { ConfirmDialog } from '../../../common/dialogs/ConfirmDialog.tsx';
import { useSubmitAction, type SubmitResult } from '../../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../../common/dialogs/WriteNotice.tsx';
import { logProblem } from '../../../common/problem-text.ts';
import { DIALOG_TEXTS as T } from '../texts.ts';
import type { PartyDialogProps } from './party-dialog.ts';

interface Props extends PartyDialogProps {
  readonly establishment: Establishment;
}

/**
 * D-MDM-09 «Cerrar establecimiento» (US-MDM-010; UX-MDM-001 §5.6 y §6.2): confirmación terminal que dice que el
 * cierre es definitivo e irreversible y que el código no se reutiliza (`INV-PTY-08`, `INV-PTY-10`). Prerrequisitos a
 * la vista en un aviso neutro: si es el principal y cuántas referencias externas vinculadas tiene (X-01; si no se
 * pueden leer, se omite). Sin motivo: P-22 no tiene cuerpo. Foco inicial en «Cancelar».
 */
export function CloseEstablishmentDialog({ party, establishment, cache, onClose }: Props) {
  const gateway = useMdmGateway();
  const snackbar = useSnackbar();
  const { role } = useMdmSession();
  const loaded = useLoadedVersion(party.version, cache);
  const saved = useRef(false);
  const references = useQuery(mdmQueries.establishmentReferences(gateway, role, party.id, establishment.id));
  const linked = linkedCount(references.data?.items ?? []);
  const principal = establishment.isPrincipal && establishment.isActive;
  const prerequisites = [...(principal ? [T.closePrincipal] : []), ...(linked > 0 ? [T.closeReferences(linked)] : [])];

  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    if (saved.current) return { kind: 'idle' };
    const outcome = await attemptWrite(() => gateway.closeEstablishment(party.id, establishment.id, loaded.version));
    if (outcome.kind === 'saved') {
      saved.current = true;
      await cache.afterWrite();
      snackbar.show({ text: T.closed(establishment.code) });
      onClose();
      return { kind: 'idle' };
    }
    if (outcome.kind === 'conflict') return { kind: 'conflict' };
    logProblem('P-22', outcome.error);
    return { kind: 'failed', error: outcome.error };
  });

  async function reload(): Promise<void> {
    if ((await loaded.reload()) !== null) submit.dismiss();
  }

  return (
    <ConfirmDialog
      title={T.closeTitle(establishment.code)}
      confirmLabel={T.closeConfirm}
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
          context={{ notFoundSubject: 'el establecimiento' }}
        />
      }
    >
      <p className="text-body-large text-on-surface">{`${establishment.code} · ${establishment.name}`}</p>
      <p>{T.closeBody(establishment.code)}</p>
      {prerequisites.length > 0 && (
        <InlineNotice severity="neutral">
          {prerequisites.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </InlineNotice>
      )}
    </ConfirmDialog>
  );
}
