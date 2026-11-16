import { hasProblemCode, type PartyRole, type PartyRoleType } from '@mdm/contracts';
import { DateField, InlineNotice, LoadError, LoadingBar, SelectField, useSnackbar } from '@sil/ui';
import { useQuery } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { useMdmGateway } from '../../../../application/gateway-context.ts';
import { attemptWrite, useLoadedVersion } from '../../../../application/party-writes.ts';
import { assignableRoleTypes, mdmQueries } from '../../../../application/queries.ts';
import { limaToday } from '../../../../domain/field-rules.ts';
import {
  ROLE_DRAFT_FIELDS,
  emptyRoleDraft,
  findLoadedOverlap,
  toRoleInput,
  validateRoleDraft,
  type RoleDraft,
  type RoleDraftField,
} from '../../../../domain/role-state.ts';
import { ErrorSummary } from '../../../common/ErrorSummary.tsx';
import { fieldMessage, type FieldKind, type RoleNames } from '../../../common/field-messages.ts';
import { FormSheet } from '../../../common/dialogs/FormSheet.tsx';
import { useSubmitAction, type SubmitResult } from '../../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../../common/dialogs/WriteNotice.tsx';
import { logProblem, problemSentence, type ProblemContext } from '../../../common/problem-text.ts';
import { serverFieldIssue } from '../../../common/server-fields.ts';
import { roleTypeLabel } from '../RolesPanel.tsx';
import { DIALOG_TEXTS as T } from '../texts.ts';
import type { PartyDialogProps } from './party-dialog.ts';

type Errors = Partial<Record<RoleDraftField, string>>;

const KIND: Readonly<Record<RoleDraftField, FieldKind>> = { roleTypeCode: 'roleTypeCode', validFrom: 'date', validTo: 'validTo' };

function localErrors(draft: RoleDraft, roles: readonly PartyRole[], today: string, roleNames: RoleNames): Errors {
  const issues = validateRoleDraft(draft, roles, today);
  return Object.fromEntries(
    ROLE_DRAFT_FIELDS.flatMap((field) => {
      const issue = issues[field];
      return issue === undefined ? [] : [[field, fieldMessage(KIND[field], issue, roleNames)]];
    }),
  );
}

/** Rol cargado con el que choca, para nombrarlo en el mensaje de `party.role.overlap` (SU-MDM-16). */
function overlapContext(role: PartyRole | null, roleNames: RoleNames): ProblemContext {
  return role === null ? {} : { overlappingRole: { name: roleNames[role.roleTypeCode] ?? role.roleTypeCode, validFrom: role.validFrom, validTo: role.validTo } };
}

/**
 * Error del servidor → campo y mensaje (UX-MDM-001 §6.1, «Dónde»); `null` si va en el aviso del formulario. El
 * solape va en la vigencia solo si la ficha cargada tiene el rol con el que choca; si no, aviso genérico con
 * «Recargar», porque la ficha está desactualizada.
 */
interface Rejection {
  readonly draft: RoleDraft;
  readonly roles: readonly PartyRole[];
  readonly today: string;
  readonly roleNames: RoleNames;
}

function rejectionErrors(error: unknown, { draft, roles, today, roleNames }: Rejection): Errors | null {
  if (hasProblemCode(error, 'party.role.type_unknown') || hasProblemCode(error, 'party.role.type_not_allowed') || hasProblemCode(error, 'party_role_type.inactive')) {
    return { roleTypeCode: problemSentence(error) };
  }
  if (hasProblemCode(error, 'party.role.overlap')) {
    const clash = findLoadedOverlap(draft, roles, today);
    return clash === null ? null : { validTo: problemSentence(error, overlapContext(clash, roleNames)) };
  }
  const invalid = serverFieldIssue(error);
  const named = ROLE_DRAFT_FIELDS.find((item) => item === invalid?.field);
  return invalid === null || named === undefined ? null : { [named]: fieldMessage(KIND[named], invalid.issue) };
}

interface FormProps extends PartyDialogProps {
  readonly roleTypes: readonly PartyRoleType[];
}

/**
 * D-MDM-04 «Asignar rol» (US-MDM-007; UX-MDM-001 §4.3 y §5.6; UI-MDM-001 §3.5): tipo del catálogo (C-02, solo los
 * activos de organización, D-046), «Desde» (por defecto hoy) y «Hasta» opcional. Avisa en vivo del solape con los roles cargados del
 * mismo tipo y no envía mientras lo haya; el servidor decide igualmente (`INV-PTY-05`, `INV-PTY-06`).
 */
function AssignRoleForm({ party, cache, onClose, roleTypes }: FormProps) {
  const gateway = useMdmGateway();
  const snackbar = useSnackbar();
  const formId = useId();
  const loaded = useLoadedVersion(party.version, cache);
  const today = limaToday();
  const [initial] = useState(() => emptyRoleDraft(today));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const saved = useRef(false);
  const roleNames: RoleNames = Object.fromEntries(roleTypes.map((type) => [type.code, type.name]));
  // Un tipo desactivado no se ofrece (D-046): no se asigna a roles nuevos.
  const options = assignableRoleTypes(roleTypes).map((type) => ({ id: type.code, name: roleTypeLabel({ roleTypeCode: type.code }, roleNames) }));
  const clash = findLoadedOverlap(draft, party.roles, today);

  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    if (saved.current) return { kind: 'idle' };
    const found = localErrors(draft, party.roles, today, roleNames);
    setErrors(found);
    if (Object.keys(found).length > 0) return { kind: 'invalid' };
    const outcome = await attemptWrite(() => gateway.assignRole(party.id, toRoleInput(draft), loaded.version));
    if (outcome.kind === 'saved') {
      saved.current = true;
      await cache.afterWrite();
      snackbar.show({ text: T.roleAssigned });
      onClose();
      return { kind: 'idle' };
    }
    if (outcome.kind === 'conflict') return { kind: 'conflict' };
    const mapped = rejectionErrors(outcome.error, { draft, roles: party.roles, today, roleNames });
    if (mapped !== null) {
      setErrors(mapped);
      return { kind: 'invalid' };
    }
    logProblem('P-12', outcome.error);
    return { kind: 'failed', error: outcome.error };
  });

  function change(next: Partial<RoleDraft>, field: RoleDraftField): void {
    setDraft((previous) => ({ ...previous, ...next }));
    // Cambiar el tipo o una fecha puede resolver el solape señalado en «Hasta»: se vuelve a comprobar al enviar.
    setErrors((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => key !== field && key !== 'validTo')));
  }

  async function reload(keepDraft: boolean): Promise<void> {
    const fresh = await loaded.reload();
    if (fresh === null) return;
    if (!keepDraft) setDraft(initial);
    submit.dismiss();
  }

  const id = (field: RoleDraftField) => `${formId}-${field}`;
  const summary = ROLE_DRAFT_FIELDS.flatMap((field) => {
    const message = errors[field];
    return message === undefined ? [] : [{ fieldId: id(field), message }];
  });
  const dirty = ROLE_DRAFT_FIELDS.some((key) => initial[key] !== draft[key]);

  return (
    <FormSheet
      title={T.assignRoleTitle}
      formId={formId}
      submitLabel={T.assignSubmit}
      onSubmit={submit.submit}
      pending={submit.pending}
      dirty={dirty}
      onClose={onClose}
      notices={
        <>
          <WriteNotice state={submit.state} onReload={() => void reload(true)} onDiscard={() => void reload(false)} reloading={loaded.reloading} />
          <ErrorSummary errors={submit.state.kind === 'invalid' ? summary : []} attempt={submit.state.kind === 'invalid' ? submit.state.attempt : 0} />
        </>
      }
    >
      <SelectField
        fieldId={id('roleTypeCode')}
        data-autofocus=""
        label={T.roleType}
        required
        options={options}
        value={draft.roleTypeCode}
        error={errors.roleTypeCode}
        onChange={(event) => change({ roleTypeCode: event.target.value }, 'roleTypeCode')}
      />
      <DateField
        fieldId={id('validFrom')}
        label={T.roleFrom}
        help={T.roleFromHelp}
        value={draft.validFrom}
        error={errors.validFrom}
        onValueChange={(value) => change({ validFrom: value }, 'validFrom')}
      />
      <DateField
        fieldId={id('validTo')}
        label={T.roleTo}
        help={T.roleToHelp}
        value={draft.validTo}
        error={errors.validTo}
        onValueChange={(value) => change({ validTo: value }, 'validTo')}
      />
      {/* Solape calculado con los roles cargados: aparece al elegir tipo y fechas y se anuncia (WCAG 4.1.3). */}
      <div aria-live="polite">
        {clash !== null && (
          <InlineNotice severity="warning" title={T.overlapWarning}>
            {T.overlapDetail(roleTypeLabel(clash, roleNames), clash.validFrom, clash.validTo)}
          </InlineNotice>
        )}
      </div>
    </FormSheet>
  );
}

/** Carga los tipos de rol (C-02) antes de abrir el formulario: sin catálogo no se puede elegir ni enviar. */
export function AssignRoleDialog(props: PartyDialogProps) {
  const gateway = useMdmGateway();
  const roleTypes = useQuery(mdmQueries.roleTypes(gateway));
  if (roleTypes.data !== undefined) return <AssignRoleForm {...props} roleTypes={roleTypes.data.items} />;
  return (
    <FormSheet
      title={T.assignRoleTitle}
      formId="mdm-rol-cargando"
      submitLabel={T.assignSubmit}
      onSubmit={(event) => event.preventDefault()}
      pending={false}
      disabled
      dirty={false}
      onClose={props.onClose}
    >
      {roleTypes.isError ? (
        <LoadError subject="los tipos de rol" error={roleTypes.error} onRetry={() => void roleTypes.refetch()} />
      ) : (
        <LoadingBar subject="los tipos de rol" />
      )}
    </FormSheet>
  );
}
