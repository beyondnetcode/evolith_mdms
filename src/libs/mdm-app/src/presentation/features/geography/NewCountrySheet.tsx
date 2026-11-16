import { type RegisterCountryRequest } from '@mdm/contracts';
import { LoadError, TextField, useSnackbar } from '@sil/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMdmGateway } from '../../../application/gateway-context.ts';
import { attemptWrite } from '../../../application/party-writes.ts';
import { useMdmSession } from '../../../application/session-context.ts';
import { ErrorSummary } from '../../common/ErrorSummary.tsx';
import { FormSheet } from '../../common/dialogs/FormSheet.tsx';
import { useSubmitAction, type SubmitResult } from '../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../common/dialogs/WriteNotice.tsx';
import { logProblem } from '../../common/problem-text.ts';
import { countryPath } from '../../mdm-roots.ts';

interface Draft {
  readonly alpha2: string;
  readonly alpha3: string;
  readonly numeric: string;
  readonly officialName: string;
}

interface SaveCountryArgs {
  readonly request: RegisterCountryRequest;
  readonly gateway: ReturnType<typeof useMdmGateway>;
  readonly session: ReturnType<typeof useMdmSession>;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly snackbar: ReturnType<typeof useSnackbar>;
  readonly navigate: ReturnType<typeof useNavigate>;
  readonly onClose: () => void;
}

type Field = keyof Draft;
type Errors = Partial<Record<Field, string>>;
const FIELDS: readonly Field[] = [
  'alpha2',
  'alpha3',
  'numeric',
  'officialName',
];

function clearFieldError(errors: Errors, field: Field): Errors {
  const next: Errors = {};
  for (const candidate of FIELDS) {
    const message = errors[candidate];
    if (candidate !== field && message !== undefined) next[candidate] = message;
  }
  return next;
}

function countryRequest(draft: Draft): RegisterCountryRequest {
  return {
    alpha2: draft.alpha2.trim().toUpperCase(),
    alpha3: draft.alpha3.trim().toUpperCase(),
    numeric: draft.numeric.trim(),
    officialName: draft.officialName.trim(),
    englishName: null,
    validFrom: null,
    sourceCode: 'ISO',
    sourceVersion: null,
  };
}

function validate(draft: Draft): Errors {
  const errors: Errors = {};
  if (!/^[A-Za-z]{2}$/.test(draft.alpha2.trim())) errors.alpha2 = 'Usa dos letras ISO 3166-1, por ejemplo PE.';
  if (!/^[A-Za-z]{3}$/.test(draft.alpha3.trim())) errors.alpha3 = 'Usa tres letras ISO 3166-1, por ejemplo PER.';
  if (!/^[0-9]{3}$/.test(draft.numeric.trim())) errors.numeric = 'Usa los tres dígitos ISO 3166-1, por ejemplo 604.';
  if (draft.officialName.trim().length < 1 || draft.officialName.trim().length > 200) {
    errors.officialName = 'El nombre oficial admite de 1 a 200 caracteres.';
  }
  return errors;
}

async function saveCountry({
  request,
  gateway,
  session,
  queryClient,
  snackbar,
  navigate,
  onClose,
}: SaveCountryArgs): Promise<SubmitResult> {
  const outcome = await attemptWrite(() => gateway.registerCountry(request));
  if (outcome.kind !== 'saved') {
    const error = outcome.kind === 'rejected' ? outcome.error : new Error('El servidor rechazó el alta del país por un conflicto.');
    logProblem('CO-02', error);
    return { kind: 'failed', error };
  }
  await queryClient.invalidateQueries({ queryKey: ['mdm', session.role, 'geo', 'countries'] });
  await queryClient.invalidateQueries({ queryKey: ['mdm', session.role, 'geo', 'places'] });
  await queryClient.invalidateQueries({ queryKey: ['mdm', session.role, 'geo', 'place-parents'] });
  snackbar.show({ text: `País «${request.officialName}» registrado.` });
  onClose();
  await navigate(countryPath(request.alpha2));
  return { kind: 'idle' };
}

export function NewCountrySheet({ onClose }: { readonly onClose: () => void }) {
  const gateway = useMdmGateway();
  const session = useMdmSession();
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  const formId = useId();
  const [draft, setDraft] = useState<Draft>({
    alpha2: '',
    alpha3: '',
    numeric: '',
    officialName: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const sources = useQuery({
    queryKey: ['mdm', session.role, 'geo', 'sources'],
    queryFn: ({ signal }) => gateway.listSources({ signal }),
  });
  const hasIsoSource = sources.data?.items.some((source) => source.code === 'ISO') ?? false;
  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    const fieldErrors = validate(draft);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return { kind: 'invalid' };
    return saveCountry({
      request: countryRequest(draft),
      gateway,
      session,
      queryClient,
      snackbar,
      navigate,
      onClose,
    });
  });
  const idOf = (field: Field) => `${formId}-${field}`;
  const summary = (Object.keys(errors) as Field[]).flatMap((field) =>
    errors[field] === undefined ? [] : [{ fieldId: idOf(field), message: errors[field] ?? '' }],
  );
  const dirty = [draft.alpha2, draft.alpha3, draft.numeric, draft.officialName].some((value) => value.length > 0);

  function update(field: Field, value: string): void {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => clearFieldError(current, field));
  }

  return (
    <FormSheet
      title="Nuevo país"
      formId={formId}
      submitLabel="Registrar país"
      onSubmit={submit.submit}
      pending={submit.pending}
      disabled={sources.isLoading || sources.isError || !hasIsoSource}
      dirty={dirty}
      onClose={onClose}
      notices={
        <>
          <WriteNotice state={submit.state} />
          <ErrorSummary errors={submit.state.kind === 'invalid' ? summary : []} attempt={submit.state.kind === 'invalid' ? submit.state.attempt : 0} />
          {sources.isError ? (
            <LoadError subject="las fuentes de datos" error={sources.error} onRetry={() => void sources.refetch()} />
          ) : null}
          {sources.isSuccess && !hasIsoSource ? (
            <p role="alert" className="text-body-small text-error">No está configurada la fuente ISO necesaria para registrar países.</p>
          ) : null}
          <p className="text-body-small text-on-surface-variant">
            La escalera territorial es opcional. Puedes declararla después desde la ficha del país.
          </p>
        </>
      }
    >
      <TextField label="Nombre oficial" required fieldId={idOf('officialName')} value={draft.officialName} maxLength={200} error={errors.officialName} onChange={(event) => update('officialName', event.target.value)} data-autofocus />
      <TextField label="ISO alfa-2" required fieldId={idOf('alpha2')} value={draft.alpha2} maxLength={2} error={errors.alpha2} help="Dos letras, por ejemplo PE." onChange={(event) => update('alpha2', event.target.value)} />
      <TextField label="ISO alfa-3" required fieldId={idOf('alpha3')} value={draft.alpha3} maxLength={3} error={errors.alpha3} help="Tres letras, por ejemplo PER." onChange={(event) => update('alpha3', event.target.value)} />
      <TextField label="ISO numérico" required fieldId={idOf('numeric')} value={draft.numeric} maxLength={3} error={errors.numeric} help="Tres dígitos, por ejemplo 604." onChange={(event) => update('numeric', event.target.value)} />
    </FormSheet>
  );
}
