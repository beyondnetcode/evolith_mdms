import type { IdentifierFilter, IdentifierScheme } from '@mdm/contracts';
import { Button, SelectField, TextField, type SelectOption } from '@sil/ui';
import { useId, useState } from 'react';
import { checkIdentifierDraft, type IdentifierDraft, type IdentifierField } from '../../../domain/organization-search.ts';
import { countryOptions } from '../../common/identifier-display.ts';
import { ORGANIZATIONS_TEXTS as T } from './texts.ts';

interface Props {
  readonly schemes: readonly IdentifierScheme[];
  readonly current: IdentifierFilter | null;
  readonly onSearch: (filter: IdentifierFilter | null) => void;
}

type FieldErrors = Partial<Record<IdentifierField, string>>;

const DEFAULT_DRAFT: IdentifierDraft = { countryCode: 'PE', schemeCode: 'PE-RUC', value: '' };

/**
 * Búsqueda exacta por identificador (US-MDM-001): país, esquema y valor juntos. Con uno o dos, no se envía la
 * petición y cada campo vacío dice qué falta (UX-MDM-001 §6.3). Elegir país filtra los esquemas sin enviar nada
 * (WCAG 3.2.2).
 */
export function IdentifierSearch({ schemes, current, onSearch }: Props) {
  const id = useId();
  const [draft, setDraft] = useState<IdentifierDraft>(current ?? DEFAULT_DRAFT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const countries: SelectOption[] = countryOptions(schemes);
  const countrySchemes: SelectOption[] = schemes
    .filter((scheme) => scheme.countryCode === draft.countryCode)
    .map((scheme) => ({ id: scheme.code, name: `${scheme.code} · ${scheme.name}` }));

  function change(field: IdentifierField, value: string): void {
    // Cambiar de país invalida el esquema elegido: el catálogo es por país.
    setDraft((previous) => (field === 'countryCode' ? { ...previous, countryCode: value, schemeCode: '' } : { ...previous, [field]: value }));
    setErrors((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => key !== field)));
  }

  function submit(): void {
    const check = checkIdentifierDraft(draft);
    if (check.kind === 'incomplete') {
      setErrors(Object.fromEntries(check.missing.map((field) => [field, T.identifierMissing(field)])));
      document.getElementById(`${id}-${check.missing[0] ?? 'value'}`)?.focus();
      return;
    }
    setErrors({});
    onSearch(check.kind === 'complete' ? check.filter : null);
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <fieldset className="flex flex-col gap-4 expanded:flex-row expanded:items-start expanded:gap-2">
        <legend className="sr-only">{T.identifierLegend}</legend>
        <SelectField
          fieldId={`${id}-countryCode`}
          label={T.country}
          options={countries}
          value={draft.countryCode}
          error={errors.countryCode}
          onChange={(event) => change('countryCode', event.target.value)}
          className="expanded:w-40"
        />
        <SelectField
          fieldId={`${id}-schemeCode`}
          label={T.scheme}
          options={countrySchemes}
          value={draft.schemeCode}
          error={errors.schemeCode}
          onChange={(event) => change('schemeCode', event.target.value)}
          className="expanded:w-72"
        />
        <TextField
          fieldId={`${id}-value`}
          label={T.value}
          value={draft.value}
          maxLength={50}
          autoComplete="off"
          inputMode="text"
          error={errors.value}
          onChange={(event) => change('value', event.target.value)}
          className="expanded:w-56"
        />
        <div className="flex gap-2 expanded:pt-1">
          <Button type="submit" variant="tonal">
            {T.identifierSubmit}
          </Button>
          {current !== null && (
            <Button
              onClick={() => {
                setDraft(DEFAULT_DRAFT);
                setErrors({});
                onSearch(null);
              }}
            >
              {T.identifierClear}
            </Button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
