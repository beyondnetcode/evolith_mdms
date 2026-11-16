import { MdmNetworkError, problemFrom, type MdmErrorCode, type PartyStatus } from '@mdm/contracts';
import { formatCivilDate } from '@sil/ui';

/**
 * Microcopy de los errores del contrato (UX-MDM-001 §6.1). El `code` y el `instance` no se muestran: se registran.
 * Los datos entre llaves salen de lo cargado en la interfaz, nunca del `detail` del servidor. Propuesta sin validar
 * con usuarios (SU-MDM-15).
 */

/** Lo que algunos mensajes necesitan de lo cargado. */
export interface ProblemContext {
  readonly partyStatus?: PartyStatus;
  /** Nombre del país del identificador («Perú»). */
  readonly countryName?: string;
  /** Esquema del identificador y la pista de su formato. */
  readonly scheme?: { readonly name: string; readonly hint: string };
  /** «PE-RUC 20100412447»: el primario vigente. */
  readonly currentPrimary?: string;
  /** Rol cargado con el que choca el que se asigna (`party.role.overlap`, SU-MDM-16). */
  readonly overlappingRole?: { readonly name: string; readonly validFrom: string; readonly validTo: string | null };
  /** Principal activo cargado (`establishment.principal_exists`). */
  readonly principal?: { readonly code: string; readonly name: string };
  /** Estado del establecimiento tras recargar (`establishment.already_*`). */
  readonly establishmentActive?: boolean;
  /** Qué no se encontró (`common.not_found`): por defecto, «la organización». */
  readonly notFoundSubject?: 'la organización' | 'el establecimiento' | 'el rol' | 'la relación' | 'la referencia' | 'el tipo de rol';
  /** Nombre del tipo de relación del borrador (`party_relationship.overlap`). */
  readonly relationshipKindName?: string;
  /** Clave y sistema del borrador (`external_reference.key_duplicate`). */
  readonly externalKey?: { readonly key: string; readonly system: string };
  /** Objeto que se quería vincular (`external_reference.target_not_active`). */
  readonly referenceTarget?: 'PARTY' | 'ESTABLISHMENT';
}

export interface ProblemText {
  readonly message: string;
  /** Acción sugerida en texto (no un botón). */
  readonly hint: string | null;
  /** La acción sugerida es «Recargar». */
  readonly reload: boolean;
}

type Entry = Readonly<{
  message: string | ((context: ProblemContext) => string);
  hint?: string;
  reload?: boolean;
}>;

const PROGRAM_ERROR: Entry = {
  message: 'Algo falló al enviar los datos. No se guardó nada.',
  hint: 'Si se repite, avisa a soporte con la hora.',
  reload: true,
};
const STATUS_WORD: Readonly<Record<PartyStatus, string>> = {
  Active: 'activa',
  Suspended: 'suspendida',
  Archived: 'archivada',
  Merged: 'fusionada',
};

/** `party.role.already_*` y `party.role.terminated` (UX-MDM-001 §6.1). */
const ROLE_CHANGED: Entry = {
  message: 'Este rol cambió de estado mientras lo veías.',
  reload: true,
};

function alreadyIn(status: PartyStatus): Entry {
  return {
    message: (context) => `La organización ya estaba ${STATUS_WORD[context.partyStatus ?? status]}. Otra persona la cambió hace poco.`,
    reload: true,
  };
}

const ENTRIES: Partial<Readonly<Record<MdmErrorCode, Entry>>> = {
  'party.person_not_supported': {
    message: 'Por ahora solo se pueden registrar organizaciones.',
  },
  'party.code_not_unique': {
    message: 'Ya existe una organización con este código, aunque esté archivada.',
    hint: 'Usa otro código.',
  },
  'party.archived': {
    message: 'Esta organización está archivada y ya no se puede modificar.',
    reload: true,
  },
  'party.merged': {
    message: 'Esta organización se fusionó con otra y ya no se puede modificar.',
    reload: true,
  },
  'party.already_active': alreadyIn('Active'),
  'party.already_suspended': alreadyIn('Suspended'),
  'party.not_active': {
    message: 'La organización está suspendida: no se pueden asignar ni reactivar roles, ni abrir ni reactivar establecimientos.',
    hint: 'Actívala primero, si tienes permiso.',
  },
  'party.identifier.scheme_unknown': {
    message: (context) => (context.countryName === undefined ? 'Este esquema no existe.' : `Este esquema no existe o no es de ${context.countryName}.`),
    hint: 'Elige un esquema de la lista.',
  },
  'party.identifier.scheme_not_allowed': {
    message: 'Este esquema no se admite para organizaciones.',
    hint: 'Elige otro esquema, por ejemplo RUC.',
  },
  'party.identifier.invalid_format': {
    message: (context) =>
      context.scheme === undefined
        ? 'El valor no tiene el formato del esquema.'
        : `El valor no tiene el formato de ${context.scheme.name}. ${context.scheme.hint}`,
    hint: 'Corrige el valor.',
  },
  'party.identifier.check_digit_invalid': {
    message: 'El RUC no es válido: revisa el último dígito.',
    hint: 'Corrige el valor.',
  },
  'party.identifier.duplicate': {
    message: 'Este identificador ya pertenece a otra organización.',
  },
  'party.identifier.primary_exists': {
    message: (context) =>
      context.currentPrimary === undefined
        ? 'Ya hay un identificador primario vigente.'
        : `Ya hay un identificador primario vigente (${context.currentPrimary}).`,
    hint: 'Marca «Reemplaza al primario actual» o desmarca «Es primario».',
  },
  'party.identifier.primary_required': {
    message: 'No puedes vencer el identificador primario sin otro que lo reemplace.',
    hint: 'Agrega antes un primario nuevo con «Reemplaza al primario actual».',
  },
  'party.identifier.fiscal_required': {
    message: 'Es el último identificador fiscal vigente y la organización es empresa del grupo.',
    hint: 'Agrega otro identificador fiscal antes de vencer este.',
  },
  'party.identifier.already_expired': {
    message: 'Este identificador ya estaba vencido.',
    reload: true,
  },
  'party.role.type_unknown': {
    message: 'Este tipo de rol ya no está disponible.',
    hint: 'Elige otro tipo.',
  },
  'party.role.type_not_allowed': {
    message: 'Este rol no se admite para organizaciones.',
    hint: 'Elige otro tipo.',
  },
  'party.role.fiscal_identifier_required': {
    message: 'Para ser empresa del grupo, la organización necesita un identificador fiscal vigente.',
    hint: 'Agrega un identificador fiscal y vuelve a asignar el rol.',
  },
  // Con el rol cargado con el que choca; si la ficha no lo tiene, la forma genérica (SU-MDM-16) y «Recargar».
  'party.role.overlap': {
    message: ({ overlappingRole: role }) =>
      role === undefined
        ? 'Ya tiene ese rol en fechas que se cruzan.'
        : `Ya tiene el rol ${role.name} entre ${formatCivilDate(role.validFrom)} y ${role.validTo === null ? 'sin fecha de fin' : formatCivilDate(role.validTo)}, y las fechas se cruzan.`,
    hint: 'Cambia las fechas o termina el otro rol.',
    reload: true,
  },
  'party.role.already_active': ROLE_CHANGED,
  'party.role.already_suspended': ROLE_CHANGED,
  'party.role.terminated': ROLE_CHANGED,
  'establishment.kind_unknown': {
    message: 'Este tipo de establecimiento ya no está disponible.',
    hint: 'Elige otro tipo.',
  },
  'establishment.kind_not_supported': {
    message: 'Los almacenes aún no se pueden registrar aquí.',
    hint: 'Elige sede, sucursal o planta.',
  },
  'establishment.code_not_unique': {
    message: 'Ya hay un establecimiento con este código en la organización, aunque esté cerrado.',
    hint: 'Usa otro código.',
  },
  'establishment.principal_exists': {
    // Sin el principal en la ficha cargada, forma genérica (propuesta; UX-MDM-001 §6.1 solo da la forma con datos).
    message: ({ principal }) =>
      principal === undefined
        ? 'Ya hay otro establecimiento principal activo. Solo puede haber uno activo.'
        : `El principal actual es ${principal.code} · ${principal.name}. Solo puede haber uno activo.`,
    hint: 'Desmarca «Principal» o quita la marca al actual primero.',
    reload: true,
  },
  'establishment.already_active': {
    message: ({ establishmentActive }) => `El establecimiento ya estaba ${establishmentActive === false ? 'inactivo' : 'activo'}.`,
    reload: true,
  },
  'establishment.already_inactive': {
    message: ({ establishmentActive }) => `El establecimiento ya estaba ${establishmentActive === true ? 'activo' : 'inactivo'}.`,
    reload: true,
  },
  'establishment.closed': {
    message: 'Este establecimiento está cerrado y ya no se puede modificar.',
    reload: true,
  },
  'party_relationship.self_reference': {
    message: 'Una organización no puede relacionarse consigo misma.',
    hint: 'Elige otra organización.',
  },
  'party_relationship.kind_unknown': {
    message: 'Este tipo de relación ya no está disponible.',
    hint: 'Elige otro tipo.',
  },
  'party_relationship.party_not_found': {
    message: 'No encontramos la otra organización.',
    hint: 'Búscala de nuevo.',
  },
  'party_relationship.party_not_active': {
    message: 'Una de las dos organizaciones está archivada o fusionada.',
    hint: 'Elige una organización activa o suspendida.',
  },
  // El tipo sale del borrador: el Problem Details no identifica la relación con la que choca (SU-MDM-16, G-567).
  'party_relationship.overlap': {
    message: ({ relationshipKindName: name }) =>
      name === undefined ? 'Ya existe una relación de ese tipo entre estas organizaciones en esas fechas.' : `Ya existe una relación ${name} entre estas organizaciones en esas fechas.`,
    hint: 'Cambia las fechas o termina la relación existente.',
  },
  'party_relationship.already_ended': {
    message: 'Esta relación ya estaba terminada.',
    reload: true,
  },
  'external_reference.target_not_found': {
    message: 'No encontramos el objeto que quieres vincular.',
    reload: true,
  },
  'external_reference.target_not_active': {
    message: ({ referenceTarget }) =>
      referenceTarget === 'ESTABLISHMENT' ? 'No se puede vincular: el establecimiento está cerrado.' : 'No se puede vincular: la organización está archivada.',
    reload: true,
  },
  'external_reference.key_duplicate': {
    message: ({ externalKey }) =>
      externalKey === undefined
        ? 'La clave ya está vinculada a otro objeto, aunque esté desvinculada.'
        : `La clave ${externalKey.key} de ${externalKey.system} ya está vinculada a otro objeto, aunque esté desvinculada.`,
  },
  'external_reference.already_unlinked': {
    message: 'Esta referencia ya estaba desvinculada.',
    reload: true,
  },
  'geo.code.duplicate': {
    message: 'Ya existe un país o lugar con ese código, aunque esté vencido.',
    hint: 'Revisa el código o elige otro.',
  },
  'geo.code.invalid_format': {
    message: 'El código no cumple el formato del esquema canónico.',
    hint: 'Corrige el código según el formato indicado junto al campo.',
  },
  'geo.place.parent_not_found': {
    message: 'No encontramos el lugar superior seleccionado.',
    hint: 'Vuelve a elegirlo de la lista.',
    reload: true,
  },
  'geo.place.parent_level_invalid': {
    message: 'El nivel de este lugar no corresponde a la escalera territorial.',
    hint: 'Elige un lugar superior con un nivel siguiente disponible.',
    reload: true,
  },
  'geo.place.historical': {
    message: 'Un lugar histórico no puede tener nuevos lugares dependientes.',
    reload: true,
  },
  'geo.place.parent_inactive': {
    message: 'El lugar superior está desactivado y no admite nuevos lugares.',
    reload: true,
  },
  'geo.country.schema_not_declared': {
    message: 'Este país aún no tiene escalera territorial.',
    hint: 'Declárala desde la ficha del país antes de registrar sus divisiones.',
  },
  'geo.scheme.unknown': {
    message: 'El esquema canónico ya no está disponible.',
    hint: 'Vuelve a cargar la escalera territorial.',
    reload: true,
  },
  'geo.scheme.not_applicable': {
    message: 'El esquema no aplica al país o al tipo de lugar.',
    hint: 'Revisa la escalera territorial.',
    reload: true,
  },
  'geo.source.unknown': {
    message: 'La fuente seleccionada ya no está disponible.',
    hint: 'Elige una fuente de la lista actualizada.',
    reload: true,
  },
  'geo.place.type_not_supported': {
    message: 'Este tipo de lugar todavía no se puede dar de alta en esta etapa.',
  },
  // Catálogo de tipos de rol (C-05 a C-08, D-046).
  'party_role_type.code_duplicate': {
    message: 'Ya existe un tipo de rol con este código, aunque esté desactivado.',
    hint: 'Usa otro código.',
  },
  'party_role_type.code_invalid': {
    message: 'El código empieza por una letra y lleva solo letras, números y guion bajo, de 2 a 50 caracteres.',
    hint: 'Corrige el código.',
  },
  'party_role_type.edifact_invalid': {
    message: 'El código UN/EDIFACT 3035 son dos letras.',
    hint: 'Corrige el código, por ejemplo CN.',
  },
  'party_role_type.already_active': {
    message: 'Este tipo de rol ya estaba activo. Otra persona lo cambió hace poco.',
    reload: true,
  },
  'party_role_type.already_inactive': {
    message: 'Este tipo de rol ya estaba desactivado. Otra persona lo cambió hace poco.',
    reload: true,
  },
  'party_role_type.inactive': {
    message: 'Este tipo de rol está desactivado: ya no se asigna a roles nuevos.',
    hint: 'Elige otro tipo.',
    reload: true,
  },
  'validation.failed': {
    message: 'Revisa los campos marcados.',
    hint: 'Corrige cada campo del resumen de errores.',
  },
  'request.malformed': PROGRAM_ERROR,
  'request.method_not_allowed': PROGRAM_ERROR,
  'request.unsupported_media_type': PROGRAM_ERROR,
  'precondition.required': PROGRAM_ERROR,
  'auth.unauthenticated': { message: 'Tu sesión terminó.' },
  'auth.user_required': { message: 'Tu sesión terminó.' },
  'auth.forbidden': {
    message: 'No tienes permiso para esta acción.',
    hint: 'Pide el permiso a tu responsable.',
  },
  'common.not_found': {
    message: ({ notFoundSubject = 'la organización' }) => `No encontramos ${notFoundSubject}. Puede que el enlace esté mal.`,
    reload: true,
  },
  'precondition.failed': {
    message: 'Otra persona cambió esta organización mientras editabas. Tus cambios siguen aquí.',
  },
  'server.unexpected_error': {
    message: 'No pudimos completar la acción. No se guardó nada.',
    hint: 'Reintenta; si se repite, avisa a soporte con la hora.',
  },
};

const NETWORK: ProblemText = {
  message: 'No hay conexión con el servidor. No se guardó nada.',
  hint: 'Reintenta.',
  reload: false,
};
const UNEXPECTED: ProblemText = {
  message: 'No pudimos completar la acción. No se guardó nada.',
  hint: 'Reintenta; si se repite, avisa a soporte con la hora.',
  reload: false,
};

/** Texto de un error de escritura. Lo que no es una respuesta del contrato cae al mensaje genérico. */
export function problemText(error: unknown, context: ProblemContext = {}): ProblemText {
  if (error instanceof MdmNetworkError) return NETWORK;
  const problem = problemFrom(error);
  const entry = problem === null ? undefined : ENTRIES[problem.code];
  if (entry === undefined) return UNEXPECTED;
  return {
    message: typeof entry.message === 'string' ? entry.message : entry.message(context),
    hint: entry.hint ?? null,
    reload: entry.reload ?? false,
  };
}

/** «Mensaje. Acción sugerida.» en una línea. */
export function problemSentence(error: unknown, context: ProblemContext = {}): string {
  const text = problemText(error, context);
  return text.hint === null ? text.message : `${text.message} ${text.hint}`;
}

const PROGRAM_ERRORS: ReadonlySet<MdmErrorCode> = new Set([
  'request.malformed',
  'request.method_not_allowed',
  'request.unsupported_media_type',
  'precondition.required',
]);

/**
 * Registra los errores de programa y los inesperados (UX-MDM-001 §4.6 y §6.1): el código y la correlación van al
 * registro para soporte, no a la pantalla (P-SEC-04). Los errores de negocio no se registran: se explican.
 */
export function logProblem(operation: string, error: unknown): void {
  const problem = problemFrom(error);
  if (problem !== null && problem.status < 500 && !PROGRAM_ERRORS.has(problem.code)) return;
  console.warn(`MDM ${operation}:`, error);
}
