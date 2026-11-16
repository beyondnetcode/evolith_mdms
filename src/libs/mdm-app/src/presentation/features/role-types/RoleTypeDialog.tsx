import { hasProblemCode, normalizeRoleTypeCode, type PartyRoleType } from '@mdm/contracts';
import { TextAreaField, TextField, useSnackbar } from '@sil/ui';
import { useId, useRef, useState } from 'react';
import { useMdmGateway } from '../../../application/gateway-context.ts';
import { attemptWrite } from '../../../application/party-writes.ts';
import { useLoadedRoleType, type RoleTypeCache } from '../../../application/role-type-writes.ts';
import {
  ROLE_TYPE_FIELDS,
  draftFromRoleType,
  emptyRoleTypeDraft,
  isRoleTypeDraftDirty,
  toCreateRoleTypeRequest,
  toRoleTypeInput,
  validateRoleTypeDraft,
  type RoleTypeDraft,
  type RoleTypeField,
} from '../../../domain/role-type-form.ts';
import { Checkbox } from '../../common/Checkbox.tsx';
import { ErrorSummary } from '../../common/ErrorSummary.tsx';
import { FormSheet } from '../../common/dialogs/FormSheet.tsx';
import { useSubmitAction, type SubmitResult } from '../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../common/dialogs/WriteNotice.tsx';
import { logProblem, problemSentence } from '../../common/problem-text.ts';
import { serverFieldIssue } from '../../common/server-fields.ts';
import { ROLE_TYPE_DIALOG_TEXTS as T, PARTY_TYPE_LABEL, roleTypeFieldMessage } from './texts.ts';

type Errors = Partial<Record<RoleTypeField, string>>;

const NAME_MAX = 200;
const DESCRIPTION_MAX = 500;

/** Error del servidor → campo (UX-MDM-001 §6.1, «Dónde»); `null` si va en el aviso del formulario. */
function rejectionErrors(error: unknown): Errors | null {
  if (hasProblemCode(error, 'party_role_type.code_duplicate') || hasProblemCode(error, 'party_role_type.code_invalid')) return { code: problemSentence(error) };
  if (hasProblemCode(error, 'party_role_type.edifact_invalid')) return { unEdifact3035Code: problemSentence(error) };
  const invalid = serverFieldIssue(error);
  const field = ROLE_TYPE_FIELDS.find((item) => item === invalid?.field);
  if (invalid === null || field === undefined) return null;
  const issue = invalid.issue.kind === 'too_long' ? { kind: 'too_long' as const } : { kind: 'required' as const };
  return { [field]: roleTypeFieldMessage(field, issue) };
}

interface Props {
  /** `null`: alta (C-05); un tipo: edición (C-06). */
  readonly type: PartyRoleType | null;
  /** Códigos del catálogo cargado (activos e inactivos): el código no se reutiliza. */
  readonly takenCodes: readonly string[];
  readonly cache: RoleTypeCache;
  readonly onClose: () => void;
}

/** Alta: sin versión (C-05 crea el agregado). */
function CreateRoleTypeDialog(props: Omit<Props, 'type'>) {
  return <RoleTypeForm {...props} type={null} version={null} />;
}

/** Edición: con la versión del tipo con la que se abrió (C-06 exige `If-Match`). */
function EditRoleTypeDialog({ type, ...props }: Omit<Props, 'type'> & { readonly type: PartyRoleType }) {
  const loaded = useLoadedRoleType(type, props.cache);
  return <RoleTypeForm {...props} type={type} version={loaded} />;
}

interface FormProps extends Props {
  readonly version: ReturnType<typeof useLoadedRoleType> | null;
}

/**
 * Formulario de alta o edición de un tipo de rol (P-MDM-04, US-MDM-014; UX-MDM-001 §5.7; UI-MDM-001 §3.7): código solo
 * en el alta (se normaliza a MAYÚSCULAS_CON_GUION_BAJO al salir del campo y después es inmutable), nombre, descripción,
 * código UN/EDIFACT 3035 opcional, tipos de parte admitidos y «Exige identificador fiscal vigente». `412` con
 * D-MDM-14; `409` y `422` en su campo.
 */
function RoleTypeForm({ type, takenCodes, cache, onClose, version }: FormProps) {
  const gateway = useMdmGateway();
  const snackbar = useSnackbar();
  const formId = useId();
  const creating = type === null;
  const [initial] = useState(() => (type === null ? emptyRoleTypeDraft() : draftFromRoleType(type)));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const saved = useRef(false);
  const rules = { creating, takenCodes };

  function localErrors(): Errors {
    const issues = validateRoleTypeDraft(draft, rules);
    return Object.fromEntries(
      ROLE_TYPE_FIELDS.flatMap((field) => {
        const issue = issues[field];
        return issue === undefined ? [] : [[field, roleTypeFieldMessage(field, issue)]];
      }),
    );
  }

  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    if (saved.current) return { kind: 'idle' };
    const found = localErrors();
    setErrors(found);
    if (Object.keys(found).length > 0) return { kind: 'invalid' };
    const request = toCreateRoleTypeRequest(draft);
    const outcome = await attemptWrite(() =>
      type === null || version === null ? gateway.createRoleType(request) : gateway.changeRoleType(type.code, toRoleTypeInput(draft), version.version),
    );
    if (outcome.kind === 'saved') {
      saved.current = true;
      await cache.afterWrite();
      snackbar.show({ text: creating ? T.created(request.code) : T.saved });
      onClose();
      return { kind: 'idle' };
    }
    if (outcome.kind === 'conflict') return { kind: 'conflict' };
    const mapped = rejectionErrors(outcome.error);
    if (mapped !== null) {
      setErrors(mapped);
      return { kind: 'invalid' };
    }
    logProblem(creating ? 'C-05' : 'C-06', outcome.error);
    return { kind: 'failed', error: outcome.error };
  });

  function change(next: Partial<RoleTypeDraft>, field: RoleTypeField): void {
    setDraft((previous) => ({ ...previous, ...next }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  function blur(field: RoleTypeField): void {
    const message = localErrors()[field];
    if (message !== undefined) setErrors((previous) => ({ ...previous, [field]: message }));
  }

  async function reload(keepDraft: boolean): Promise<void> {
    if (version === null) return;
    const fresh = await version.reload();
    if (fresh === null) return;
    if (!keepDraft) setDraft(draftFromRoleType(fresh));
    submit.dismiss();
  }

  const id = (field: RoleTypeField) => `${formId}-${field}`;
  const summary = ROLE_TYPE_FIELDS.flatMap((field) => {
    const message = errors[field];
    return message === undefined ? [] : [{ fieldId: id(field), message }];
  });
  const normalizedCode = normalizeRoleTypeCode(draft.code);
  const partyTypesErrorId = `${id('allowedPartyTypes')}-error`;

  return (
    <FormSheet
      title={type === null ? T.createTitle : T.editTitle(type.name)}
      formId={formId}
      submitLabel={creating ? T.create : T.save}
      onSubmit={submit.submit}
      pending={submit.pending}
      dirty={isRoleTypeDraftDirty(initial, draft)}
      onClose={onClose}
      notices={
        <>
          <WriteNotice
            state={submit.state}
            {...(version === null
              ? {}
              : { onReload: () => void reload(true), onDiscard: () => void reload(false), reloading: version.reloading, conflictText: T.conflict })}
            context={{ notFoundSubject: 'el tipo de rol' }}
          />
          <ErrorSummary errors={submit.state.kind === 'invalid' ? summary : []} attempt={submit.state.kind === 'invalid' ? submit.state.attempt : 0} />
        </>
      }
    >
      {type === null ? (
        <TextField
          fieldId={id('code')}
          data-autofocus=""
          label={T.code}
          required
          autoCapitalize="characters"
          spellCheck={false}
          value={draft.code}
          maxLength={50}
          readOnly={submit.pending}
          help={normalizedCode !== '' && normalizedCode !== draft.code ? T.codePreview(normalizedCode) : T.codeHelp}
          error={errors.code}
          onChange={(event) => change({ code: event.target.value }, 'code')}
          onBlur={() => {
            setDraft((previous) => ({ ...previous, code: normalizeRoleTypeCode(previous.code) }));
            blur('code');
          }}
        />
      ) : (
        <p className="text-body-large text-on-surface">{T.codeFixed(type.code)}</p>
      )}
      <TextField
        fieldId={id('name')}
        {...(type === null ? {} : { 'data-autofocus': '' })}
        label={T.name}
        required
        value={draft.name}
        maxLength={NAME_MAX}
        readOnly={submit.pending}
        error={errors.name}
        onChange={(event) => change({ name: event.target.value }, 'name')}
        onBlur={() => blur('name')}
      />
      <TextAreaField
        fieldId={id('description')}
        label={T.description}
        value={draft.description}
        max={DESCRIPTION_MAX}
        currentValue={draft.description}
        readOnly={submit.pending}
        error={errors.description}
        onChange={(event) => change({ description: event.target.value }, 'description')}
      />
      <TextField
        fieldId={id('unEdifact3035Code')}
        label={T.edifact}
        help={T.edifactHelp}
        autoCapitalize="characters"
        spellCheck={false}
        value={draft.unEdifact3035Code}
        maxLength={2}
        readOnly={submit.pending}
        error={errors.unEdifact3035Code}
        onChange={(event) => change({ unEdifact3035Code: event.target.value.toUpperCase() }, 'unEdifact3035Code')}
        onBlur={() => blur('unEdifact3035Code')}
      />
      <fieldset aria-describedby={errors.allowedPartyTypes === undefined ? undefined : partyTypesErrorId} className="flex flex-col">
        <legend className="pb-1 text-body-medium text-on-surface-variant">{T.partyTypes}</legend>
        <Checkbox
          fieldId={id('allowedPartyTypes')}
          label={PARTY_TYPE_LABEL.ORGANIZATION}
          checked={draft.organization}
          readOnly={submit.pending}
          onChange={(checked) => change({ organization: checked }, 'allowedPartyTypes')}
        />
        <Checkbox label={PARTY_TYPE_LABEL.PERSON} checked={draft.person} readOnly={submit.pending} onChange={(checked) => change({ person: checked }, 'allowedPartyTypes')} />
        {errors.allowedPartyTypes !== undefined && (
          <p id={partyTypesErrorId} className="ps-8 text-body-small text-error">
            {errors.allowedPartyTypes}
          </p>
        )}
      </fieldset>
      <Checkbox
        label={T.fiscal}
        description={T.fiscalHelp}
        checked={draft.requiresFiscalIdentifier}
        readOnly={submit.pending}
        onChange={(checked) => setDraft((previous) => ({ ...previous, requiresFiscalIdentifier: checked }))}
      />
    </FormSheet>
  );
}

/** Alta o edición según `type`. */
export function RoleTypeDialog({ type, ...props }: Props) {
  return type === null ? <CreateRoleTypeDialog {...props} /> : <EditRoleTypeDialog {...props} type={type} />;
}
