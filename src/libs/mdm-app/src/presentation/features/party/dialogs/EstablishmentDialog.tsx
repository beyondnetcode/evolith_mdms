import { hasProblemCode, normalizeCode, type Establishment, type EstablishmentKind } from '@mdm/contracts';
import { LoadError, LoadingBar, SelectField, TextField, useSnackbar } from '@sil/ui';
import { useQuery } from '@tanstack/react-query';
import { useId, useRef, useState, type ComponentProps } from 'react';
import { useMdmGateway } from '../../../../application/gateway-context.ts';
import { attemptWrite, useLoadedVersion } from '../../../../application/party-writes.ts';
import { mdmQueries } from '../../../../application/queries.ts';
import {
  ESTABLISHMENT_DRAFT_FIELDS,
  draftFromEstablishment,
  emptyEstablishmentDraft,
  findActivePrincipal,
  textLimit,
  toEstablishmentInput,
  toOpenEstablishmentRequest,
  validateEstablishmentDraft,
  type EstablishmentDraft,
  type EstablishmentDraftField,
} from '../../../../domain/establishment-form.ts';
import { Checkbox } from '../../../common/Checkbox.tsx';
import { ErrorSummary } from '../../../common/ErrorSummary.tsx';
import { fieldMessage, type FieldKind } from '../../../common/field-messages.ts';
import { FormSheet } from '../../../common/dialogs/FormSheet.tsx';
import { useSubmitAction, type SubmitResult } from '../../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../../common/dialogs/WriteNotice.tsx';
import { logProblem, problemSentence } from '../../../common/problem-text.ts';
import { serverFieldIssue } from '../../../common/server-fields.ts';
import { DIALOG_TEXTS as T } from '../texts.ts';
import type { PartyDialogProps } from './party-dialog.ts';

/** Abrir (P-18) o editar (P-19) un establecimiento. */
export type EstablishmentDialogMode = { readonly kind: 'open' } | { readonly kind: 'edit'; readonly establishment: Establishment };

type Errors = Partial<Record<EstablishmentDraftField, string>>;
type TextFieldName = Exclude<EstablishmentDraftField, 'kindCode' | 'isPrincipal'>;

const KIND: Readonly<Record<EstablishmentDraftField, FieldKind>> = {
  code: 'establishmentCode',
  kindCode: 'kindCode',
  name: 'establishmentName',
  taxEstablishmentCode: 'taxEstablishmentCode',
  isPrincipal: 'establishmentCode',
  line1: 'addressLine1',
  line2: 'addressLine2',
  ubigeo: 'ubigeo',
  department: 'department',
  province: 'province',
  district: 'district',
  postalCode: 'postalCode',
  countryCode: 'addressCountry',
  reference: 'reference',
};

/** Campo del cuerpo de P-18/P-19 (`address.line1`) → campo del formulario. */
function draftFieldOf(contractField: string): EstablishmentDraftField | undefined {
  const name = contractField.startsWith('address.') ? contractField.slice('address.'.length) : contractField;
  return ESTABLISHMENT_DRAFT_FIELDS.find((field) => field === name);
}

interface FormProps extends PartyDialogProps {
  readonly mode: EstablishmentDialogMode;
  readonly kinds: readonly EstablishmentKind[];
}

/**
 * D-MDM-05 «Abrir o editar establecimiento» (US-MDM-009; UX-MDM-001 §4.4 y §5.6; UI-MDM-001 §3.5): grupo
 * «Establecimiento» (código solo al abrir —después es inmutable—, tipo de C-03 con `isSupported`, nombre, anexo SUNAT
 * y «Principal», con aviso que nombra al principal actual) y grupo «Dirección» con `autocomplete`. `principal_exists`
 * y el código repetido se pintan en su campo.
 */
function EstablishmentForm({ party, cache, onClose, mode, kinds }: FormProps) {
  const gateway = useMdmGateway();
  const snackbar = useSnackbar();
  const formId = useId();
  const loaded = useLoadedVersion(party.version, cache);
  const creating = mode.kind === 'open';
  const editing = mode.kind === 'edit' ? mode.establishment : null;
  const [initial] = useState(() => (editing === null ? emptyEstablishmentDraft() : draftFromEstablishment(editing)));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const saved = useRef(false);
  // Solo los admitidos en la primera entrega (sin almacén, G-547); al editar, se conserva el tipo vigente aunque no lo sea.
  const options = kinds.filter((kind) => kind.isSupported || kind.code === editing?.kindCode).map((kind) => ({ id: kind.code, name: kind.name }));
  const principal = findActivePrincipal(party.establishments, editing?.id ?? null);
  // Un inactivo marcado como principal no choca hasta reactivarlo (`INV-PTY-09` cuenta los activos).
  const warnPrincipal = draft.isPrincipal && principal !== undefined && (editing === null || editing.isActive);
  const rules = { creating, takenCodes: party.establishments.map((item) => normalizeCode(item.code)) };

  function localErrors(): Errors {
    const issues = validateEstablishmentDraft(draft, rules);
    return Object.fromEntries(
      ESTABLISHMENT_DRAFT_FIELDS.flatMap((field) => {
        const issue = issues[field];
        return issue === undefined ? [] : [[field, fieldMessage(KIND[field], issue)]];
      }),
    );
  }

  /** Error del servidor → campo (UX-MDM-001 §6.1, «Dónde»); `null` si va en el aviso del formulario. */
  function rejectionErrors(error: unknown): Errors | null {
    if (hasProblemCode(error, 'establishment.code_not_unique')) return { code: problemSentence(error) };
    if (hasProblemCode(error, 'establishment.principal_exists')) {
      return { isPrincipal: problemSentence(error, principal === undefined ? {} : { principal: { code: principal.code, name: principal.name } }) };
    }
    if (hasProblemCode(error, 'establishment.kind_unknown') || hasProblemCode(error, 'establishment.kind_not_supported')) {
      return { kindCode: problemSentence(error) };
    }
    const invalid = serverFieldIssue(error);
    const field = invalid === null ? undefined : draftFieldOf(invalid.field);
    return invalid === null || field === undefined ? null : { [field]: fieldMessage(KIND[field], invalid.issue) };
  }

  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    if (saved.current) return { kind: 'idle' };
    const found = localErrors();
    setErrors(found);
    if (Object.keys(found).length > 0) return { kind: 'invalid' };
    const outcome = await attemptWrite(() =>
      editing === null
        ? gateway.openEstablishment(party.id, toOpenEstablishmentRequest(draft), loaded.version)
        : gateway.changeEstablishment(party.id, editing.id, toEstablishmentInput(draft), loaded.version),
    );
    if (outcome.kind === 'saved') {
      saved.current = true;
      await cache.afterWrite();
      snackbar.show({ text: creating ? T.establishmentOpened : T.establishmentSaved });
      onClose();
      return { kind: 'idle' };
    }
    if (outcome.kind === 'conflict') return { kind: 'conflict' };
    const mapped = rejectionErrors(outcome.error);
    if (mapped !== null) {
      setErrors(mapped);
      return { kind: 'invalid' };
    }
    logProblem(creating ? 'P-18' : 'P-19', outcome.error);
    return { kind: 'failed', error: outcome.error };
  });

  function change(next: Partial<EstablishmentDraft>, field: EstablishmentDraftField): void {
    setDraft((previous) => ({ ...previous, ...next }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  function blur(field: EstablishmentDraftField): void {
    const message = localErrors()[field];
    if (message !== undefined) setErrors((previous) => ({ ...previous, [field]: message }));
  }

  async function reload(keepDraft: boolean): Promise<void> {
    const fresh = await loaded.reload();
    if (fresh === null) return;
    if (!keepDraft) {
      const current = editing === null ? undefined : fresh.establishments.find((item) => item.id === editing.id);
      setDraft(current === undefined ? initial : draftFromEstablishment(current));
    }
    submit.dismiss();
  }

  const id = (field: EstablishmentDraftField) => `${formId}-${field}`;
  const summary = ESTABLISHMENT_DRAFT_FIELDS.flatMap((field) => {
    const message = errors[field];
    return message === undefined ? [] : [{ fieldId: id(field), message }];
  });
  const dirty = ESTABLISHMENT_DRAFT_FIELDS.some((key) => initial[key] !== draft[key]);

  /** Campo de texto del borrador, con su error, su límite y lo común. */
  function text(field: TextFieldName, label: string, extra: Omit<ComponentProps<typeof TextField>, 'label'> = {}, autofocus = false) {
    const limit = textLimit(field);
    return (
      <TextField
        fieldId={id(field)}
        label={label}
        value={draft[field]}
        maxLength={limit}
        readOnly={submit.pending}
        error={errors[field]}
        onChange={(event) => change({ [field]: event.target.value }, field)}
        onBlur={() => blur(field)}
        {...extra}
        {...(autofocus ? { 'data-autofocus': '' } : {})}
      />
    );
  }

  return (
    <FormSheet
      title={editing === null ? T.openEstablishmentTitle : T.editEstablishmentTitle(editing.code)}
      formId={formId}
      submitLabel={creating ? T.openSubmit : T.save}
      onSubmit={submit.submit}
      pending={submit.pending}
      dirty={dirty}
      onClose={onClose}
      notices={
        <>
          <WriteNotice
            state={submit.state}
            onReload={() => void reload(true)}
            onDiscard={() => void reload(false)}
            reloading={loaded.reloading}
            context={{ notFoundSubject: 'el establecimiento' }}
          />
          <ErrorSummary errors={submit.state.kind === 'invalid' ? summary : []} attempt={submit.state.kind === 'invalid' ? submit.state.attempt : 0} />
        </>
      }
    >
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-title-medium">{T.establishmentGroup}</legend>
        {editing === null ? (
          text('code', T.establishmentCode, { required: true, autoComplete: 'off', help: T.codeHelp }, true)
        ) : (
          <p className="text-body-large tabular-nums">{T.immutableCode(editing.code)}</p>
        )}
        <SelectField
          fieldId={id('kindCode')}
          label={T.establishmentKind}
          required
          options={options}
          value={draft.kindCode}
          error={errors.kindCode}
          onChange={(event) => change({ kindCode: event.target.value }, 'kindCode')}
          {...(editing === null ? {} : { 'data-autofocus': '' })}
        />
        {text('name', T.establishmentName, { required: true, autoComplete: 'off' })}
        {text('taxEstablishmentCode', T.taxCode, { inputMode: 'numeric', autoComplete: 'off', help: T.taxCodeHelp, maxLength: 4 })}
        <Checkbox
          fieldId={id('isPrincipal')}
          label={T.isPrincipal}
          checked={draft.isPrincipal}
          readOnly={submit.pending}
          error={errors.isPrincipal}
          description={warnPrincipal ? T.principalWarning(principal.code) : T.principalHelp}
          onChange={(checked) => change({ isPrincipal: checked }, 'isPrincipal')}
        />
      </fieldset>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-title-medium">{T.addressGroup}</legend>
        {text('line1', T.line1, { required: true, autoComplete: 'address-line1' })}
        {text('line2', T.line2, { autoComplete: 'address-line2' })}
        {text('district', T.district, { autoComplete: 'address-level3' })}
        {text('province', T.province, { autoComplete: 'address-level2' })}
        {text('department', T.department, { autoComplete: 'address-level1' })}
        {text('ubigeo', T.ubigeo, { inputMode: 'numeric', autoComplete: 'off', help: T.ubigeoHelp, maxLength: 6 })}
        {text('postalCode', T.postalCode, { autoComplete: 'postal-code' })}
        {text('countryCode', T.country, { required: true, autoComplete: 'country', help: T.countryHelp, maxLength: 2 })}
        {text('reference', T.reference, { autoComplete: 'off' })}
      </fieldset>
    </FormSheet>
  );
}

/** Carga los tipos de establecimiento (C-03) antes de abrir el formulario. */
export function EstablishmentDialog(props: PartyDialogProps & { readonly mode: EstablishmentDialogMode }) {
  const gateway = useMdmGateway();
  const kinds = useQuery(mdmQueries.establishmentKinds(gateway));
  const title = props.mode.kind === 'edit' ? T.editEstablishmentTitle(props.mode.establishment.code) : T.openEstablishmentTitle;
  if (kinds.data !== undefined) return <EstablishmentForm {...props} kinds={kinds.data.items} />;
  return (
    <FormSheet
      title={title}
      formId="mdm-establecimiento-cargando"
      submitLabel={props.mode.kind === 'open' ? T.openSubmit : T.save}
      onSubmit={(event) => event.preventDefault()}
      pending={false}
      disabled
      dirty={false}
      onClose={props.onClose}
    >
      {kinds.isError ? (
        <LoadError subject="los tipos de establecimiento" error={kinds.error} onRetry={() => void kinds.refetch()} />
      ) : (
        <LoadingBar subject="los tipos de establecimiento" />
      )}
    </FormSheet>
  );
}
