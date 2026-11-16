import type { PartyRoleType } from '@mdm/contracts';
import { useSnackbar } from '@sil/ui';
import { useRef } from 'react';
import { useMdmGateway } from '../../../application/gateway-context.ts';
import { attemptWrite } from '../../../application/party-writes.ts';
import { useLoadedRoleType, type RoleTypeCache } from '../../../application/role-type-writes.ts';
import { ConfirmDialog } from '../../common/dialogs/ConfirmDialog.tsx';
import { useSubmitAction, type SubmitResult } from '../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../common/dialogs/WriteNotice.tsx';
import { logProblem } from '../../common/problem-text.ts';
import { ROLE_TYPE_DIALOG_TEXTS as T } from './texts.ts';

interface Props {
  readonly type: PartyRoleType;
  /** `deactivate` (C-07) o `activate` (C-08). */
  readonly action: 'deactivate' | 'activate';
  readonly cache: RoleTypeCache;
  readonly onClose: () => void;
}

/**
 * Confirmación de desactivar o reactivar un tipo de rol (P-MDM-04, US-MDM-014; UX-MDM-001 §6.2). Es reversible
 * (tono primario): desactivar explica que los roles existentes se conservan y que el tipo ya no se asigna a roles
 * nuevos. Envía la versión del tipo con la que se abrió; ante `412`, aviso con «Recargar y revisar». Foco inicial en
 * «Cancelar».
 */
export function ToggleRoleTypeDialog({ type, action, cache, onClose }: Props) {
  const gateway = useMdmGateway();
  const snackbar = useSnackbar();
  const loaded = useLoadedRoleType(type, cache);
  const saved = useRef(false);
  const deactivating = action === 'deactivate';

  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    if (saved.current) return { kind: 'idle' };
    const request = { reason: null };
    const outcome = await attemptWrite(() =>
      deactivating ? gateway.deactivateRoleType(type.code, request, loaded.version) : gateway.activateRoleType(type.code, request, loaded.version),
    );
    if (outcome.kind === 'saved') {
      saved.current = true;
      await cache.afterWrite();
      snackbar.show({ text: deactivating ? T.deactivated(type.name) : T.activated(type.name) });
      onClose();
      return { kind: 'idle' };
    }
    if (outcome.kind === 'conflict') return { kind: 'conflict' };
    logProblem(deactivating ? 'C-07' : 'C-08', outcome.error);
    return { kind: 'failed', error: outcome.error };
  });

  async function reload(): Promise<void> {
    if ((await loaded.reload()) !== null) submit.dismiss();
  }

  return (
    <ConfirmDialog
      title={deactivating ? T.deactivateTitle(type.name) : T.activateTitle(type.name)}
      confirmLabel={deactivating ? T.deactivateConfirm : T.activateConfirm}
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
          conflictText={T.toggleConflict}
          context={{ notFoundSubject: 'el tipo de rol' }}
        />
      }
    >
      <p className="text-body-large text-on-surface">{`${type.name} (${type.code})`}</p>
      <p>{deactivating ? T.deactivateBody : T.activateBody}</p>
    </ConfirmDialog>
  );
}
