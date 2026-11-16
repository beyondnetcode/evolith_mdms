import type { IdentifierScheme, PartySummary } from '@mdm/contracts';
import { Button, DateField, Icon, IconButton, InlineNotice, SelectField, TextField, buttonStyles, type SelectOption } from '@sil/ui';
import { Link } from 'react-router';
import { CODE_MAX, NAME_MAX, roleField, type OrganizationDraft, type OrganizationField, type RoleDraft } from '../../../domain/organization-form.ts';
import type { RoleNames } from '../../common/field-messages.ts';
import { countryOptions, duplicateText, schemeOptions } from '../../common/identifier-display.ts';
import { organizationPath } from '../../mdm-roots.ts';
import type { OrganizationErrors } from './organization-errors.ts';
import { REGISTRATION_TEXTS as T } from './texts.ts';

/** Lo común a cada grupo de campos: valores, errores y cómo cambiar o validar un campo. */
export interface FieldsProps {
  readonly draft: OrganizationDraft;
  readonly errors: OrganizationErrors;
  /** `id` del control de cada campo: el resumen de errores enlaza a él. */
  readonly idOf: (field: OrganizationField) => string;
  readonly onChange: (change: Partial<OrganizationDraft>, field: OrganizationField) => void;
  /** Valida el campo al salir (nunca mientras se escribe, UX-MDM-001 §6.3). */
  readonly onBlur: (field: OrganizationField) => void;
  readonly readOnly: boolean;
}

const LEGEND = 'mb-4 text-title-medium';

/** Grupo «Datos»: código, razón social y nombre comercial. */
export function DataFields({ draft, errors, idOf, onChange, onBlur, readOnly }: FieldsProps) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className={LEGEND}>{T.dataGroup}</legend>
      <TextField
        fieldId={idOf('code')}
        label={T.code}
        required
        value={draft.code}
        maxLength={CODE_MAX}
        autoComplete="off"
        readOnly={readOnly}
        help={T.codeHelp}
        error={errors.code}
        onChange={(event) => onChange({ code: event.target.value }, 'code')}
        onBlur={() => onBlur('code')}
      />
      <TextField
        fieldId={idOf('legalName')}
        label={T.legalName}
        required
        value={draft.legalName}
        maxLength={NAME_MAX}
        autoComplete="organization"
        readOnly={readOnly}
        error={errors.legalName}
        onChange={(event) => onChange({ legalName: event.target.value }, 'legalName')}
        onBlur={() => onBlur('legalName')}
      />
      <TextField
        fieldId={idOf('tradeName')}
        label={T.tradeName}
        value={draft.tradeName}
        maxLength={NAME_MAX}
        autoComplete="off"
        readOnly={readOnly}
        error={errors.tradeName}
        onChange={(event) => onChange({ tradeName: event.target.value }, 'tradeName')}
        onBlur={() => onBlur('tradeName')}
      />
    </fieldset>
  );
}

interface DuplicateProps {
  /** `undefined`: sin duplicado. `null`: duplicado sin la organización encontrada. */
  readonly owner: PartySummary | null | undefined;
  readonly onFix: () => void;
}

/** `409` `party.identifier.duplicate` (UX-MDM-001 §4.2): la organización existente y sus dos salidas. */
export function DuplicateNotice({ owner, onFix }: DuplicateProps) {
  if (owner === undefined) return null;
  return (
    <InlineNotice
      severity="warning"
      announce
      title={duplicateText(owner)}
      actions={
        <>
          {owner !== null && (
            <Link to={organizationPath(owner.id)} className={buttonStyles('text-inherit')}>
              {T.openExisting}
            </Link>
          )}
          <Button variant="text-inherit" onClick={onFix}>
            {T.fixIdentifier}
          </Button>
        </>
      }
    />
  );
}

/** Grupo «Identificador primario»: país, esquema (C-01 del país, `ORGANIZATION`), valor y «Vigente desde». */
export function IdentifierFields({
  draft,
  errors,
  idOf,
  onChange,
  onBlur,
  readOnly,
  schemes,
}: FieldsProps & { readonly schemes: readonly IdentifierScheme[] }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className={LEGEND}>{T.identifierGroup}</legend>
      <SelectField
        fieldId={idOf('countryCode')}
        label={T.country}
        required
        options={countryOptions(schemes)}
        value={draft.countryCode}
        error={errors.countryCode}
        onChange={(event) => onChange({ countryCode: event.target.value, schemeCode: '' }, 'countryCode')}
      />
      <SelectField
        fieldId={idOf('schemeCode')}
        label={T.scheme}
        required
        options={schemeOptions(schemes, draft.countryCode)}
        value={draft.schemeCode}
        error={errors.schemeCode}
        onChange={(event) => onChange({ schemeCode: event.target.value }, 'schemeCode')}
      />
      <TextField
        fieldId={idOf('value')}
        label={T.value}
        required
        value={draft.value}
        maxLength={50}
        autoComplete="off"
        readOnly={readOnly}
        error={errors.value}
        onChange={(event) => onChange({ value: event.target.value }, 'value')}
        onBlur={() => onBlur('value')}
      />
      <DateField
        fieldId={idOf('validFrom')}
        label={T.validFrom}
        value={draft.validFrom}
        help={T.validFromHelp}
        error={errors.validFrom}
        onValueChange={(value) => onChange({ validFrom: value }, 'validFrom')}
      />
    </fieldset>
  );
}

interface RolesProps extends FieldsProps {
  readonly roleOptions: readonly SelectOption[];
  readonly roleNames: RoleNames;
  readonly onAdd: () => void;
  readonly onRemove: (key: number) => void;
  readonly onRoleChange: (key: number, change: Partial<RoleDraft>, field: OrganizationField) => void;
  /** `id` de «Agregar otro rol»: recibe el foco al quitar una fila. */
  readonly addId: string;
}

/** Grupo «Roles iniciales (opcional)»: filas con tipo (C-02, `ORGANIZATION`), desde y hasta. */
export function RolesFields({ draft, errors, idOf, roleOptions, roleNames, onAdd, onRemove, onRoleChange, addId }: RolesProps) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className={LEGEND}>{T.rolesGroup}</legend>
      {draft.roles.length === 0 && <p className="text-body-medium text-on-surface-variant">{T.noRoles}</p>}
      {draft.roles.map((role, index) => {
        const name = roleNames[role.roleTypeCode] ?? T.roleWithoutType;
        return (
          <div key={role.key} role="group" aria-label={T.roleRow(index + 1)} className="flex items-start gap-2 rounded-md border border-outline-variant p-4">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <SelectField
                fieldId={idOf(roleField(role.key, 'roleTypeCode'))}
                label={T.roleType}
                required
                options={roleOptions}
                value={role.roleTypeCode}
                error={errors[roleField(role.key, 'roleTypeCode')]}
                onChange={(event) => onRoleChange(role.key, { roleTypeCode: event.target.value }, roleField(role.key, 'roleTypeCode'))}
              />
              <DateField
                fieldId={idOf(roleField(role.key, 'validFrom'))}
                label={T.roleFrom}
                value={role.validFrom}
                error={errors[roleField(role.key, 'validFrom')]}
                onValueChange={(value) => onRoleChange(role.key, { validFrom: value }, roleField(role.key, 'validFrom'))}
              />
              <DateField
                fieldId={idOf(roleField(role.key, 'validTo'))}
                label={T.roleTo}
                value={role.validTo}
                error={errors[roleField(role.key, 'validTo')]}
                onValueChange={(value) => onRoleChange(role.key, { validTo: value }, roleField(role.key, 'validTo'))}
              />
            </div>
            <IconButton aria-label={T.removeRole(name)} onClick={() => onRemove(role.key)}>
              <Icon name="close" />
            </IconButton>
          </div>
        );
      })}
      <Button id={addId} onClick={onAdd} className="self-start">
        <Icon name="add" className="size-4.5" />
        {draft.roles.length === 0 ? T.addFirstRole : T.addRole}
      </Button>
    </fieldset>
  );
}
