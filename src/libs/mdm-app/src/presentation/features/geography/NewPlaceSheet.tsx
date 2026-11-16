import {
  EMPTY_PLACE_QUERY,
  normalizeGeoCode,
  type CodeScheme,
  type PlaceSummary,
  type RegisterPlaceRequest,
  type TerritorialSchema,
} from '@mdm/contracts';
import { Button, LoadError, SelectField, TextField, useSnackbar } from '@sil/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router';
import { useMdmGateway } from '../../../application/gateway-context.ts';
import { attemptWrite } from '../../../application/party-writes.ts';
import { useMdmSession } from '../../../application/session-context.ts';
import { ErrorSummary } from '../../common/ErrorSummary.tsx';
import { FormSheet } from '../../common/dialogs/FormSheet.tsx';
import { useSubmitAction, type SubmitResult, type SubmitState } from '../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../common/dialogs/WriteNotice.tsx';
import { logProblem } from '../../common/problem-text.ts';
import { placePath } from '../../mdm-roots.ts';

interface Draft {
  readonly type: RegisterPlaceRequest['type'];
  readonly parentId: string;
  readonly officialName: string;
  readonly code: string;
}

function ParentSearch({
  value,
  onChange,
  onSearch,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSearch: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <TextField
        label="Buscar país o división"
        value={value}
        maxLength={100}
        help="Escribe al menos dos letras; afina la búsqueda si aparecen demasiados resultados."
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onSearch();
          }
        }}
      />
      <Button variant="outlined" onClick={onSearch} disabled={value.trim().length < 2}>
        Buscar lugares superiores
      </Button>
    </div>
  );
}

type Field = keyof Draft;
type FieldErrors = Partial<Record<Field, string>>;

interface PlaceSetup {
  readonly type: RegisterPlaceRequest['type'];
  readonly parent: PlaceSummary;
  readonly level: TerritorialSchema['levels'][number] | null;
  readonly scheme: CodeScheme | null;
  readonly sourceCode: string;
}

function findScheme(schemes: readonly CodeScheme[] | undefined, level: TerritorialSchema['levels'][number] | undefined) {
  return schemes?.find((item) => item.code === level?.canonicalSchemeCode);
}

function isEligibleParent(place: PlaceSummary): boolean {
  return place.status === 'Active' && (place.type === 'Country' || place.type === 'AdministrativeDivision' || place.type === 'Locality');
}

function nextLevel(schema: TerritorialSchema | undefined, parent: PlaceSummary | undefined) {
  if (schema === undefined || parent === undefined) return undefined;
  const order = (parent.level ?? 0) + 1;
  return schema.levels.find((level) => level.order === order);
}

function placeSetup(
  input: {
    readonly type: RegisterPlaceRequest['type'];
    readonly parent: PlaceSummary | undefined;
    readonly level: TerritorialSchema['levels'][number] | undefined;
    readonly scheme: CodeScheme | undefined;
    readonly sourceCode: string;
  },
): PlaceSetup | undefined {
  const { type, parent, level, scheme, sourceCode } = input;
  if (parent === undefined) return undefined;
  if (type === 'Locality') return { type, parent, level: null, scheme: null, sourceCode };
  if (level === undefined || scheme === undefined) return undefined;
  return { type, parent, level, scheme, sourceCode };
}

function resourcesReady(
  setup: PlaceSetup | undefined,
  statuses: readonly boolean[],
): boolean {
  return setup !== undefined && statuses.every(Boolean);
}

function hasChanges(draft: Draft): boolean {
  return draft.type !== 'AdministrativeDivision' ||
    draft.parentId.length > 0 ||
    draft.officialName.length > 0 ||
    draft.code.length > 0;
}

function levelText(parent: PlaceSummary | undefined, level: TerritorialSchema['levels'][number] | undefined, schemaFailed: boolean): string {
  if (level !== undefined) return level.localLabel;
  if (parent === undefined) return '';
  return schemaFailed ? 'No disponible' : 'Nivel no disponible';
}

function levelHint(parent: PlaceSummary | undefined, level: TerritorialSchema['levels'][number] | undefined): string | undefined {
  return level === undefined && parent !== undefined
    ? 'El lugar no tiene un nivel siguiente disponible en la escalera declarada.'
    : undefined;
}

function clearFieldError(errors: FieldErrors, field: Field): FieldErrors {
  return {
    ...(field !== 'parentId' && errors.parentId !== undefined ? { parentId: errors.parentId } : {}),
    ...(field !== 'officialName' && errors.officialName !== undefined ? { officialName: errors.officialName } : {}),
    ...(field !== 'code' && errors.code !== undefined ? { code: errors.code } : {}),
  };
}

function parentOptions(parents: readonly PlaceSummary[]) {
  return parents.map((place) => ({
    id: place.id,
    name: `${place.displayPath} · ${place.canonicalCode?.value ?? place.countryCode}`,
  }));
}

function validateName(name: string): string | undefined {
  return name.trim().length < 2 || name.trim().length > 200
    ? 'El nombre admite de 2 a 200 caracteres.'
    : undefined;
}

function validateCode(draft: Draft, setup: PlaceSetup | undefined): string | undefined {
  if (draft.type !== 'AdministrativeDivision') return undefined;
  if (setup?.scheme === null || setup?.scheme === undefined) return 'Escribe el código oficial.';
  if (draft.code.trim().length === 0) return 'Escribe el código oficial.';
  return draft.code.trim().length > setup.scheme.maxLength
    ? `El código admite hasta ${setup.scheme.maxLength} caracteres.`
    : undefined;
}

function validateDraft(draft: Draft, setup: PlaceSetup | undefined): FieldErrors {
  const errors: FieldErrors = {};
  const nameError = validateName(draft.officialName);
  const codeError = validateCode(draft, setup);
  if (nameError !== undefined) errors.officialName = nameError;
  if (codeError !== undefined) errors.code = codeError;
  if (draft.parentId.length === 0) errors.parentId = 'Elige un lugar superior vigente.';
  return errors;
}

function fieldSummary(errors: FieldErrors, idOf: (field: Field) => string) {
  return (Object.keys(errors) as Field[]).flatMap((field) =>
    errors[field] === undefined ? [] : [{ fieldId: idOf(field), message: errors[field] ?? '' }],
  );
}

function placeRequest(draft: Draft, setup: PlaceSetup): RegisterPlaceRequest {
  return {
    type: setup.type,
    parentId: setup.parent.id,
    canonicalCode: setup.scheme === null ? null : { schemeCode: setup.scheme.code, value: normalizeGeoCode(draft.code) },
    officialName: draft.officialName.trim(),
    languageCode: 'es',
    validFrom: null,
    sourceCode: setup.sourceCode,
    sourceVersion: null,
  };
}

interface SavePlaceArgs {
  readonly gateway: ReturnType<typeof useMdmGateway>;
  readonly request: RegisterPlaceRequest;
  readonly session: ReturnType<typeof useMdmSession>;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly snackbar: ReturnType<typeof useSnackbar>;
  readonly navigate: ReturnType<typeof useNavigate>;
  readonly onClose: () => void;
}

async function savePlace({ gateway, request, session, queryClient, snackbar, navigate, onClose }: SavePlaceArgs): Promise<SubmitResult> {
  const outcome = await attemptWrite(() => gateway.registerPlace(request));
  if (outcome.kind === 'saved') {
    await queryClient.invalidateQueries({ queryKey: ['mdm', session.role, 'geo', 'places'] });
    await queryClient.invalidateQueries({ queryKey: ['mdm', session.role, 'geo', 'place-parents'] });
    snackbar.show({ text: `Lugar «${request.officialName}» registrado.` });
    onClose();
    await navigate(placePath(outcome.value.id));
    return { kind: 'idle' };
  }
  const error = outcome.kind === 'rejected' ? outcome.error : new Error('El servidor rechazó la creación del lugar por un conflicto.');
  logProblem('PL-03', error);
  return { kind: 'failed', error };
}

function retryLookups(refetchers: ReadonlyArray<() => Promise<unknown>>): void {
  for (const refetch of refetchers) void refetch();
}

interface PlaceLookupRefetchers {
  readonly parents: () => Promise<unknown>;
  readonly schema: () => Promise<unknown>;
  readonly schemes: () => Promise<unknown>;
}

function retryPlaceLookups(refetchers: PlaceLookupRefetchers, hasParent: boolean): void {
  retryLookups([
    refetchers.parents,
    ...(hasParent ? [refetchers.schema, refetchers.schemes] : []),
  ]);
}

function PlaceLoadErrorNotice({
  error,
  onRetry,
}: {
  readonly error: Error | null;
  readonly onRetry: () => void;
}) {
  if (error === null) return null;
  return (
    <LoadError
      subject="los datos necesarios para registrar un lugar"
      error={error}
      onRetry={onRetry}
    />
  );
}

function PlaceFormNotices({
  state,
  errors,
  formId,
  error,
  onRetry,
}: {
  readonly state: SubmitState;
  readonly errors: FieldErrors;
  readonly formId: string;
  readonly error: Error | null;
  readonly onRetry: () => void;
}) {
  return (
    <>
      <WriteNotice state={state} />
      <ErrorSummary
        errors={state.kind === 'invalid' ? fieldSummary(errors, (field) => `${formId}-${field}`) : []}
        attempt={state.kind === 'invalid' ? state.attempt : 0}
      />
      <PlaceLoadErrorNotice error={error} onRetry={onRetry} />
    </>
  );
}

interface SubmitPlaceArgs {
  readonly draft: Draft;
  readonly setup: PlaceSetup | undefined;
  readonly ready: boolean;
  readonly setErrors: Dispatch<SetStateAction<FieldErrors>>;
  readonly saveContext: Omit<SavePlaceArgs, 'request'>;
}

async function submitPlace({ draft, setup, ready, setErrors, saveContext }: SubmitPlaceArgs): Promise<SubmitResult> {
  const errors = validateDraft(draft, setup);
  setErrors(errors);
  if (Object.keys(errors).length > 0) return { kind: 'invalid' };
  if (!ready || setup === undefined) return { kind: 'idle' };
  return savePlace({ ...saveContext, request: placeRequest(draft, setup) });
}

function usePlaceLookups(
  gateway: ReturnType<typeof useMdmGateway>,
  role: ReturnType<typeof useMdmSession>['role'],
  countryCode: string | null,
) {
  const schema = useQuery({
    queryKey: ['mdm', role, 'geo', 'territorial-schema', countryCode],
    queryFn: ({ signal }) => gateway.getTerritorialSchema(countryCode ?? '', { signal }),
    enabled: countryCode !== null,
  });
  const schemes = useQuery({
    queryKey: ['mdm', role, 'geo', 'code-schemes', countryCode],
    queryFn: ({ signal }) =>
      gateway.listCodeSchemes({ includeInactive: false, countryCode, appliesTo: 'AdministrativeDivision' }, { signal }),
    enabled: countryCode !== null,
  });
  return { schema, schemes };
}

interface PlaceFormResourcesInput {
  readonly gateway: ReturnType<typeof useMdmGateway>;
  readonly role: ReturnType<typeof useMdmSession>['role'];
  readonly draft: Draft;
  readonly parent: PlaceSummary | undefined;
  readonly parentsReady: boolean;
}

function placeFormReady({
  isDivision,
  setup,
  parentsReady,
  schemaReady,
  schemesReady,
  sourcesReady,
}: {
  readonly isDivision: boolean;
  readonly setup: PlaceSetup | undefined;
  readonly parentsReady: boolean;
  readonly schemaReady: boolean;
  readonly schemesReady: boolean;
  readonly sourcesReady: boolean;
}): boolean {
  return resourcesReady(setup, [
    parentsReady,
    ...(isDivision ? [schemaReady, schemesReady] : []),
    sourcesReady,
  ]);
}

function placeFormLoadError(
  isDivision: boolean,
  schemaError: Error | null,
  schemesError: Error | null,
): Error | null {
  return isDivision ? schemaError ?? schemesError : null;
}

function placeFormLevelLabel(
  isDivision: boolean,
  parent: PlaceSummary | undefined,
  level: TerritorialSchema['levels'][number] | undefined,
  schemaFailed: boolean,
): string {
  return isDivision ? levelText(parent, level, schemaFailed) : 'Localidad';
}

function usePlaceFormResources({ gateway, role, draft, parent, parentsReady }: PlaceFormResourcesInput) {
  const isDivision = draft.type === 'AdministrativeDivision';
  const { schema, schemes } = usePlaceLookups(gateway, role, isDivision ? parent?.countryCode ?? null : null);
  const level = isDivision ? nextLevel(schema.data, parent) : undefined;
  const scheme = isDivision ? findScheme(schemes.data?.items, level) : undefined;
  const sourceCode = scheme?.defaultSourceCode ?? 'ORG';
  const setup = placeSetup({ type: draft.type, parent, level, scheme, sourceCode });
  const ready = placeFormReady({
    isDivision,
    setup,
    parentsReady,
    schemaReady: schema.isSuccess,
    schemesReady: schemes.isSuccess,
    sourcesReady: true,
  });
  const loadError = parentsReady ? placeFormLoadError(isDivision, schema.error, schemes.error) : null;
  const levelLabel = placeFormLevelLabel(isDivision, parent, level, schema.isError);
  const codeHelp = scheme === undefined ? 'El esquema canónico lo determina la escalera del país.' : `Formato esperado: ${scheme.valuePattern}`;
  return { schema, schemes, level, scheme, setup, ready, loadError, levelLabel, codeHelp };
}

interface NewPlaceFieldsProps {
  readonly formId: string;
  readonly draft: Draft;
  readonly errors: FieldErrors;
  readonly parentOptions: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly levelLabel: string;
  readonly levelHelp: string | undefined;
  readonly scheme: CodeScheme | undefined;
  readonly codeHelp: string;
  readonly parentSearch: string;
  readonly onChange: (field: Field, value: string) => void;
  readonly onParentChange: (parentId: string) => void;
  readonly onParentSearchChange: (value: string) => void;
  readonly onParentSearch: () => void;
}

function NewPlaceFields({
  formId,
  draft,
  errors,
  parentOptions,
  levelLabel,
  levelHelp,
  scheme,
  codeHelp,
  parentSearch,
  onChange,
  onParentChange,
  onParentSearchChange,
  onParentSearch,
}: NewPlaceFieldsProps) {
  const idOf = (field: Field) => `${formId}-${field}`;
  return (
    <>
      <ParentSearch value={parentSearch} onChange={onParentSearchChange} onSearch={onParentSearch} />
      <SelectField
        label="Tipo de ubicación"
        required
        value={draft.type}
        options={[
          { id: 'AdministrativeDivision', name: 'División administrativa' },
          { id: 'Locality', name: 'Localidad' },
        ]}
        onChange={(event) => onChange('type', event.target.value)}
      />
      <SelectField
        label="Lugar superior"
        required
        fieldId={idOf('parentId')}
        value={draft.parentId}
        error={errors.parentId}
        help="Elige un resultado vigente. Para agregar cualquier ubicación, búscala arriba por nombre."
        options={parentOptions}
        onChange={(event) => onParentChange(event.target.value)}
      />
      <TextField label="Nivel territorial" value={levelLabel} readOnly help={levelHelp} />
      <TextField
        label="Nombre oficial"
        required
        fieldId={idOf('officialName')}
        value={draft.officialName}
        maxLength={200}
        error={errors.officialName}
        onChange={(event) => onChange('officialName', event.target.value)}
        data-autofocus
      />
      {draft.type === 'AdministrativeDivision' ? (
        <TextField
          label={`Código canónico${scheme === undefined ? '' : ` · ${scheme.name}`}`}
          required
          fieldId={idOf('code')}
          value={draft.code}
          maxLength={scheme?.maxLength ?? 35}
          error={errors.code}
          help={codeHelp}
          onChange={(event) => onChange('code', event.target.value)}
        />
      ) : (
        <p className="text-body-small text-on-surface-variant">
          La localidad no hereda el UBIGEO de su ubicación superior.
        </p>
      )}
    </>
  );
}

export function NewPlaceSheet({ onClose }: { readonly onClose: () => void }) {
  const gateway = useMdmGateway();
  const session = useMdmSession();
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  const formId = useId();
  const [draft, setDraft] = useState<Draft>({
    type: 'AdministrativeDivision',
    parentId: '',
    officialName: '',
    code: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [parentSearch, setParentSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const parents = useQuery({
    queryKey: ['mdm', session.role, 'geo', 'place-parents', searchTerm],
    queryFn: ({ signal }) => gateway.searchPlaces({
      ...EMPTY_PLACE_QUERY,
      name: searchTerm,
      statuses: ['Active'],
      pageSize: 100,
    }, { signal }),
    enabled: searchTerm.length >= 2,
  });
  const availableParents = useMemo(() => (parents.data?.items ?? []).filter(isEligibleParent), [parents.data]);
  const parent = availableParents.find((place) => place.id === draft.parentId);
  const { schema, schemes, level, scheme, setup, ready, loadError, levelLabel, codeHelp } = usePlaceFormResources({
    gateway,
    role: session.role,
    draft,
    parent,
    parentsReady: parents.isSuccess,
  });
  const dirty = hasChanges(draft);

  function update(field: Field, value: string): void {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => clearFieldError(current, field));
  }

  function searchParents(): void {
    const term = parentSearch.trim();
    if (term.length < 2) return;
    setSearchTerm(term);
    setDraft((current) => ({ ...current, parentId: '' }));
    setErrors({});
  }

  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    return submitPlace({
      draft,
      setup,
      ready,
      setErrors,
      saveContext: {
        gateway,
        session,
        queryClient,
        snackbar,
        navigate,
        onClose,
      },
    });
  });

  return (
    <FormSheet
      title="Nuevo lugar"
      formId={formId}
      submitLabel="Registrar lugar"
      onSubmit={submit.submit}
      pending={submit.pending}
      disabled={!ready}
      dirty={dirty}
      onClose={onClose}
      notices={
        <PlaceFormNotices
          state={submit.state}
          errors={errors}
          formId={formId}
          error={parents.error ?? loadError}
          onRetry={() => retryPlaceLookups({
            parents: () => parents.refetch(),
            schema: () => schema.refetch(),
            schemes: () => schemes.refetch(),
          }, parent !== undefined && draft.type === 'AdministrativeDivision')}
        />
      }
    >
      <NewPlaceFields
        formId={formId}
        draft={draft}
        errors={errors}
        parentOptions={parentOptions(availableParents)}
        levelLabel={levelLabel}
        levelHelp={levelHint(parent, level)}
        scheme={scheme}
        codeHelp={codeHelp}
        parentSearch={parentSearch}
        onChange={update}
        onParentSearchChange={setParentSearch}
        onParentSearch={searchParents}
        onParentChange={(parentId) => {
          setDraft((current) => ({ ...current, parentId }));
          setErrors({});
        }}
      />
    </FormSheet>
  );
}
