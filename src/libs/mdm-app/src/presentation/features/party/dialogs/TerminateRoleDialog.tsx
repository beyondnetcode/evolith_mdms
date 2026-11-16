import type { PartyRole } from '@mdm/contracts';
import { DateField, TextAreaField, useSnackbar } from '@sil/ui';
import { useId, useRef, useState } from 'react';
import { useMdmGateway } from '../../../../application/gateway-context.ts';
import { attemptWrite, useLoadedVersion } from '../../../../application/party-writes.ts';
import { limaToday } from '../../../../domain/field-rules.ts';
import { checkTerminationDate, defaultTerminationDate } from '../../../../domain/role-state.ts';
import { ConfirmDialog } from '../../../common/dialogs/ConfirmDialog.tsx';
import { useSubmitAction, type SubmitResult } from '../../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../../common/dialogs/WriteNotice.tsx';
import { fieldMessage, type RoleNames } from '../../../common/field-messages.ts';
import { logProblem } from '../../../common/problem-text.ts';
import { roleTypeLabel } from '../RolesPanel.tsx';
import { DIALOG_TEXTS as T } from '../texts.ts';
import type { PartyDialogProps } from './party-dialog.ts';

const REASON_MAX = 500;

interface Props extends PartyDialogProps {
  readonly role: PartyRole;
  readonly roleNames: RoleNames;
}

/**
 * D-MDM-10 «Terminar rol» (US-MDM-008; UX-MDM-001 §5.6 y §6.2): confirmación terminal con la vigencia actual del rol,
 * «Termina el» (por defecto hoy, entre su «desde» y su «hasta» vigente: lo rechaza antes de enviar) y motivo
 * opcional, porque P-15 los recibe. Terminado, el rol no se reactiva. Foco inicial en «Cancelar».
 */
export function TerminateRoleDialog({ party, role, roleNames, cache, onClose }: Props) {
  const gateway = useMdmGateway();
  const snackbar = useSnackbar();
  const dateId = useId();
  const loaded = useLoadedVersion(party.version, cache);
  const today = limaToday();
  const [validTo, setValidTo] = useState(() => defaultTerminationDate(role, today));
  const [reason, setReason] = useState('');
  const [dateError, setDateError] = useState<string | undefined>(undefined);
  const saved = useRef(false);
  const name = roleNames[role.roleTypeCode] ?? role.roleTypeCode;

  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    if (saved.current) return { kind: 'idle' };
    const issue = checkTerminationDate(validTo, role, today);
    setDateError(issue === null ? undefined : fieldMessage('terminationDate', issue));
    if (issue !== null) {
      document.getElementById(dateId)?.focus();
      return { kind: 'invalid' };
    }
    const date = validTo === '' ? today : validTo;
    const request = { validTo: date, reason: reason.trim() === '' ? null : reason.trim().slice(0, REASON_MAX) };
    const outcome = await attemptWrite(() => gateway.terminateRole(party.id, role.roleId, request, loaded.version));
    if (outcome.kind === 'saved') {
      saved.current = true;
      await cache.afterWrite();
      snackbar.show({ text: T.terminated(name, date) });
      onClose();
      return { kind: 'idle' };
    }
    if (outcome.kind === 'conflict') return { kind: 'conflict' };
    logProblem('P-15', outcome.error);
    return { kind: 'failed', error: outcome.error };
  });

  async function reload(): Promise<void> {
    if ((await loaded.reload()) !== null) submit.dismiss();
  }

  return (
    <ConfirmDialog
      title={T.terminateTitle(name)}
      confirmLabel={T.terminateConfirm}
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
          context={{ notFoundSubject: 'el rol' }}
        />
      }
    >
      <p className="text-body-large text-on-surface">{roleTypeLabel(role, roleNames)}</p>
      <p className="tabular-nums">{T.currentValidity(role.validFrom, role.validTo)}</p>
      <p>{T.terminateBody}</p>
      <DateField
        fieldId={dateId}
        label={T.terminateDate}
        value={validTo}
        error={dateError}
        onValueChange={(value) => {
          setValidTo(value);
          setDateError(undefined);
        }}
      />
      <TextAreaField
        label={T.reason}
        value={reason}
        max={REASON_MAX}
        currentValue={reason}
        readOnly={submit.pending}
        onChange={(event) => setReason(event.target.value)}
      />
    </ConfirmDialog>
  );
}
