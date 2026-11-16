import type { CodeScheme, TerritorialLevelInput, TerritorialSchemaInput } from '@mdm/contracts';
import { LoadError, SelectField, TextField, useSnackbar } from '@sil/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useMdmGateway } from '../../../application/gateway-context.ts';
import { attemptWrite } from '../../../application/party-writes.ts';
import { useMdmSession } from '../../../application/session-context.ts';
import { ErrorSummary } from '../../common/ErrorSummary.tsx';
import { FormSheet } from '../../common/dialogs/FormSheet.tsx';
import { useSubmitAction, type SubmitResult } from '../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../common/dialogs/WriteNotice.tsx';
import { logProblem } from '../../common/problem-text.ts';

interface LevelDraft {
  readonly localLabel: string;
  readonly schemeCode: string;
  readonly addressLevel: string;
}

interface FieldError {
  readonly fieldId: string;
  readonly message: string;
}

interface ValidationInput {
  readonly levels: readonly LevelDraft[];
  readonly schemes: readonly CodeScheme[];
  readonly usesPostalCode: boolean;
  readonly postalCodePattern: string;
  readonly formId: string;
}

function schemeOptions(schemes: readonly CodeScheme[]) {
  return schemes.map((scheme) => ({ id: scheme.code, name: `${scheme.code} · ${scheme.name}` }));
}

function buildLevels(levels: readonly LevelDraft[], schemes: readonly CodeScheme[]): readonly TerritorialLevelInput[] {
  const defaultScheme = schemes.find((scheme) => scheme.isCanonical)?.code ?? '';
  return levels.map((level, index) => ({
    order: index + 1,
    canonicalLabel: `ADM${index + 1}` as TerritorialLevelInput['canonicalLabel'],
    localLabel: level.localLabel.trim(),
    canonicalSchemeCode: level.schemeCode || defaultScheme,
    isAddressLevel: level.addressLevel === 'true',
  }));
}

function makeRequest(
  levels: readonly LevelDraft[],
  schemes: readonly CodeScheme[],
  usesPostalCode: boolean,
  postalCodePattern: string,
): TerritorialSchemaInput {
  return {
    levels: buildLevels(levels, schemes),
    usesPostalCode,
    postalCodePattern: usesPostalCode ? postalCodePattern.trim() : null,
  };
}

function validateLevels({
  levels,
  schemes,
  usesPostalCode,
  postalCodePattern,
  formId,
}: ValidationInput): readonly FieldError[] {
  const errors = levels.flatMap((level, index) => {
    const missingLabel = level.localLabel.trim().length === 0;
    const unavailableScheme = !schemes.some((scheme) => scheme.code === level.schemeCode || (
      level.schemeCode.length === 0 && scheme.isCanonical
    ));
    return [
      ...(missingLabel ? [{ fieldId: `${formId}-label-${index + 1}`, message: 'Escribe el nombre local del nivel.' }] : []),
      ...(unavailableScheme ? [{ fieldId: `${formId}-scheme-${index + 1}`, message: 'Elige un esquema canónico disponible.' }] : []),
    ];
  });
  if (levels.filter((level) => level.addressLevel === 'true').length > 1) {
    errors.push({ fieldId: `${formId}-address-${levels.findIndex((level) => level.addressLevel === 'true') + 1}`, message: 'Solo un nivel puede marcarse para direcciones.' });
  }
  if (usesPostalCode && postalCodePattern.trim().length === 0) {
    errors.push({ fieldId: `${formId}-postal-pattern`, message: 'Indica el patrón del código postal.' });
  }
  return errors;
}

function resizeLevels(current: readonly LevelDraft[], count: number): readonly LevelDraft[] {
  return Array.from({ length: count }, (_, index) => current[index] ?? ({
    localLabel: '',
    schemeCode: '',
    addressLevel: 'false',
  }));
}

function LevelFields({
  formId,
  levels,
  schemes,
  errors,
  onChange,
}: {
  readonly formId: string;
  readonly levels: readonly LevelDraft[];
  readonly schemes: readonly CodeScheme[];
  readonly errors: readonly FieldError[];
  readonly onChange: (index: number, field: keyof LevelDraft, value: string) => void;
}) {
  const options = schemeOptions(schemes);
  const defaultScheme = schemes.find((scheme) => scheme.isCanonical)?.code ?? '';
  return (
    <>
      {levels.map((level, index) => {
        const order = index + 1;
        return (
          <fieldset key={order} className="flex flex-col gap-3 rounded-md border border-outline-variant p-3">
            <legend className="px-1 text-label-large">Nivel ADM{order}</legend>
            <TextField
              label="Nombre local"
              required
              fieldId={`${formId}-label-${order}`}
              value={level.localLabel}
              maxLength={100}
              error={errors.find((error) => error.fieldId === `${formId}-label-${order}`)?.message}
              onChange={(event) => onChange(index, 'localLabel', event.target.value)}
            />
            <SelectField
              label="Esquema canónico"
              required
              fieldId={`${formId}-scheme-${order}`}
              value={level.schemeCode || defaultScheme}
              options={options}
              error={errors.find((error) => error.fieldId === `${formId}-scheme-${order}`)?.message}
              onChange={(event) => onChange(index, 'schemeCode', event.target.value)}
            />
            <SelectField
              label="Nivel para direcciones"
              fieldId={`${formId}-address-${order}`}
              value={level.addressLevel}
              options={[{ id: 'false', name: 'No' }, { id: 'true', name: 'Sí' }]}
              onChange={(event) => onChange(index, 'addressLevel', event.target.value)}
            />
          </fieldset>
        );
      })}
    </>
  );
}

export function TerritorialSchemaSheet({
  countryCode,
  countryName,
  onClose,
}: {
  readonly countryCode: string;
  readonly countryName: string;
  readonly onClose: () => void;
}) {
  const gateway = useMdmGateway();
  const session = useMdmSession();
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();
  const formId = useId();
  const [levels, setLevels] = useState<readonly LevelDraft[]>([{ localLabel: '', schemeCode: '', addressLevel: 'false' }]);
  const [usesPostalCode, setUsesPostalCode] = useState(false);
  const [postalCodePattern, setPostalCodePattern] = useState('');
  const [errors, setErrors] = useState<readonly FieldError[]>([]);
  const schemes = useQuery({
    queryKey: ['mdm', session.role, 'geo', 'code-schemes', countryCode, 'AdministrativeDivision'],
    queryFn: ({ signal }) => gateway.listCodeSchemes({ includeInactive: false, countryCode, appliesTo: 'AdministrativeDivision' }, { signal }),
  });
  const availableSchemes = schemes.data?.items ?? [];
  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    const fieldErrors = validateLevels({
      levels,
      schemes: availableSchemes,
      usesPostalCode,
      postalCodePattern,
      formId,
    });
    setErrors(fieldErrors);
    if (fieldErrors.length > 0) return { kind: 'invalid' };
    const request = makeRequest(levels, availableSchemes, usesPostalCode, postalCodePattern);
    const outcome = await attemptWrite(() => gateway.declareTerritorialSchema(countryCode, request));
    if (outcome.kind !== 'saved') {
      const error = outcome.kind === 'rejected' ? outcome.error : new Error('El servidor rechazó la escalera territorial por un conflicto.');
      logProblem('CO-06', error);
      return { kind: 'failed', error };
    }
    await queryClient.invalidateQueries({ queryKey: ['mdm', session.role, 'geo', 'countries'] });
    await queryClient.invalidateQueries({ queryKey: ['mdm', session.role, 'geo', 'country', countryCode] });
    await queryClient.invalidateQueries({ queryKey: ['mdm', session.role, 'geo', 'territorial-schema', countryCode] });
    snackbar.show({ text: `Escalera territorial de «${countryName}» declarada.` });
    onClose();
    return { kind: 'idle' };
  });
  const summary = errors.map(({ fieldId, message }) => ({ fieldId, message }));
  const dirty = levels.some((level) => level.localLabel.length > 0 || level.schemeCode.length > 0)
    || usesPostalCode || postalCodePattern.length > 0;

  function updateLevel(index: number, field: keyof LevelDraft, value: string): void {
    setLevels((current) => current.map((level, levelIndex) =>
      levelIndex === index ? { ...level, [field]: value } : level,
    ));
    setErrors((current) => current.filter((error) => !error.fieldId.endsWith(`-${index + 1}`)));
  }

  return (
    <FormSheet
      title={`Definir escalera de ${countryName}`}
      formId={formId}
      submitLabel="Declarar escalera"
      onSubmit={submit.submit}
      pending={submit.pending}
      disabled={schemes.isLoading || schemes.isError || availableSchemes.length === 0}
      dirty={dirty}
      onClose={onClose}
      notices={
        <>
          <WriteNotice state={submit.state} />
          <ErrorSummary errors={submit.state.kind === 'invalid' ? summary : []} attempt={submit.state.kind === 'invalid' ? submit.state.attempt : 0} />
          {schemes.isError ? <LoadError subject="los esquemas territoriales" error={schemes.error} onRetry={() => void schemes.refetch()} /> : null}
          <p className="text-body-small text-on-surface-variant">La escalera puede tener de uno a seis niveles. Déjala sin declarar si el país no maneja divisiones administrativas.</p>
        </>
      }
    >
      <SelectField
        label="Cantidad de niveles"
        value={String(levels.length)}
        options={[
          { id: '0', name: 'Sin niveles territoriales' },
          ...Array.from({ length: 6 }, (_, index) => ({ id: String(index + 1), name: String(index + 1) })),
        ]}
        onChange={(event) => setLevels((current) => resizeLevels(current, Number(event.target.value)))}
      />
      <LevelFields formId={formId} levels={levels} schemes={availableSchemes} errors={errors} onChange={updateLevel} />
      <SelectField
        label="¿Usa códigos postales?"
        value={usesPostalCode ? 'yes' : 'no'}
        options={[{ id: 'no', name: 'No' }, { id: 'yes', name: 'Sí' }]}
        onChange={(event) => setUsesPostalCode(event.target.value === 'yes')}
      />
      {usesPostalCode ? (
        <TextField
          label="Patrón de código postal"
          required
          fieldId={`${formId}-postal-pattern`}
          value={postalCodePattern}
          error={errors.find((error) => error.fieldId === `${formId}-postal-pattern`)?.message}
          onChange={(event) => setPostalCodePattern(event.target.value)}
        />
      ) : null}
    </FormSheet>
  );
}
