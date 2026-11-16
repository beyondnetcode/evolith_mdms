import type { PartyType } from '@mdm/contracts';
import type { RoleTypeField, RoleTypeIssue } from '../../../domain/role-type-form.ts';

/**
 * Microcopy de P-MDM-04 «Tipos de rol» (UX-MDM-001 §5.7, US-MDM-014, D-046). Propuesta sin validar con usuarios
 * (SU-MDM-15).
 */
export const ROLE_TYPE_TEXTS = {
  title: 'Tipos de rol',
  intro:
    'Los papeles que una organización puede tener (cliente, transportista, consignatario…). Un tipo desactivado ya no se asigna a roles nuevos; los roles que ya lo usan se conservan.',
  showInactive: 'Mostrar inactivos',
  showInactiveHelp: 'Incluye los tipos desactivados.',
  newRoleType: 'Nuevo tipo de rol',
  loading: 'los tipos de rol',
  count: (total: number) => (total === 1 ? '1 tipo de rol' : `${total} tipos de rol`),
  caption: (total: number) => `Tipos de rol, ${total} ${total === 1 ? 'resultado' : 'resultados'}`,
  none: 'No hay tipos de rol activos.',
  noneAtAll: 'Aún no hay tipos de rol.',
  moreActions: (name: string) => `Más acciones del tipo de rol ${name}`,
  rowActions: 'Acciones',
  active: 'Activo',
  inactive: 'Inactivo',
  yes: 'Sí',
  no: 'No',
  noCode: 'Sin código',
  edit: 'Editar',
  deactivate: 'Desactivar',
  activate: 'Reactivar',
} as const;

export const ROLE_TYPE_COLUMNS = {
  code: 'Código',
  name: 'Nombre',
  edifact: 'UN/EDIFACT 3035',
  partyTypes: 'Tipos de parte',
  fiscal: 'Exige identificador fiscal',
  status: 'Estado',
} as const;

export const PARTY_TYPE_LABEL: Readonly<Record<PartyType, string>> = {
  ORGANIZATION: 'Organización',
  PERSON: 'Persona',
};

/** «Organización, persona». */
export function partyTypesText(types: readonly PartyType[]): string {
  const text = types.map((type) => PARTY_TYPE_LABEL[type].toLowerCase()).join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Textos de los diálogos de P-MDM-04 (UX-MDM-001 §5.6 y §6.2). */
export const ROLE_TYPE_DIALOG_TEXTS = {
  createTitle: 'Nuevo tipo de rol',
  editTitle: (name: string) => `Editar el tipo de rol ${name}`,
  create: 'Crear',
  save: 'Guardar',
  code: 'Código',
  codeHelp: 'Mayúsculas, números y guion bajo, por ejemplo AGENTE_DE_CARGA. No se puede cambiar después.',
  codePreview: (code: string) => `Se guardará como ${code}. No se puede cambiar después.`,
  codeFixed: (code: string) => `Código: ${code}. No se puede cambiar.`,
  name: 'Nombre',
  description: 'Descripción (opcional)',
  edifact: 'Código UN/EDIFACT 3035 (opcional)',
  edifactHelp: 'Dos letras del calificador de parte, por ejemplo CN para consignatario.',
  partyTypes: 'Tipos de parte admitidos (obligatorio)',
  fiscal: 'Exige identificador fiscal vigente',
  fiscalHelp: 'Solo se asigna a una organización con un identificador fiscal vigente, como la empresa del grupo.',
  created: (code: string) => `Tipo de rol ${code} creado.`,
  saved: 'Cambios guardados.',
  conflict: 'Otra persona cambió este tipo de rol mientras editabas. Tus cambios siguen aquí.',
  deactivateTitle: (name: string) => `¿Desactivar el tipo de rol ${name}?`,
  deactivateBody:
    'Ya no se podrá asignar a roles nuevos ni elegir en el alta de organizaciones. Los roles que ya lo usan se conservan con su vigencia. Podrás reactivarlo.',
  deactivateConfirm: 'Desactivar',
  deactivated: (name: string) => `Tipo de rol ${name} desactivado.`,
  activateTitle: (name: string) => `¿Reactivar el tipo de rol ${name}?`,
  activateBody: 'Se podrá asignar de nuevo a roles nuevos y elegir en el alta de organizaciones.',
  activateConfirm: 'Reactivar',
  activated: (name: string) => `Tipo de rol ${name} reactivado.`,
  toggleConflict: 'Otra persona cambió este tipo de rol mientras lo veías.',
} as const;

const MESSAGES: Readonly<Record<RoleTypeField, Partial<Record<RoleTypeIssue['kind'], string>>>> = {
  code: {
    required: 'Escribe un código.',
    code_format: 'El código empieza por una letra y lleva solo letras, números y guion bajo, de 2 a 50 caracteres. Por ejemplo, AGENTE_DE_CARGA.',
    taken: 'Ya existe un tipo de rol con este código, aunque esté desactivado. Usa otro código.',
  },
  name: { required: 'Escribe el nombre.', too_long: 'El nombre admite hasta 200 caracteres.' },
  description: { too_long: 'La descripción admite hasta 500 caracteres.' },
  unEdifact3035Code: { edifact_format: 'El código UN/EDIFACT 3035 son dos letras, por ejemplo CN.' },
  allowedPartyTypes: { required: 'Elige al menos un tipo de parte.' },
};

/** Mensaje de un campo: dice qué falta y cómo corregirlo (UX-MDM-001 §6.3). */
export function roleTypeFieldMessage(field: RoleTypeField, issue: RoleTypeIssue): string {
  return MESSAGES[field][issue.kind] ?? 'Revisa este campo.';
}
