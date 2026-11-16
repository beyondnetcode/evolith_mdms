import { formatCivilDate, formatDate } from '@sil/ui';

/** Microcopy de P-MDM-02 y sus diálogos (UX-MDM-001 §5.4, §5.6, §6.2 y §6.4). Propuesta sin validar (SU-MDM-15). */
export const PARTY_TEXTS = {
  loadingSubject: 'la organización',
  /** `common.not_found` (UX-MDM-001 §6.1). */
  notFound: 'No encontramos la organización. Puede que el enlace esté mal.',
  back: 'Organizaciones',
  actions: 'Acciones',
  sections: 'Secciones de la organización',
  noPrimary: 'Sin identificador primario vigente',
  noRoles: 'Sin roles vigentes',
  roles: (names: string) => `Roles: ${names}`,
  // Avisos de estado (§5.4).
  suspendedTitle: 'Organización suspendida.',
  suspendedBody: 'No se pueden asignar ni reactivar roles, ni abrir ni reactivar establecimientos.',
  archived: (instant: string) => `Organización archivada el ${formatDate(instant)}. Se muestra en solo lectura.`,
  merged: 'Organización fusionada. Se muestra en solo lectura.',
  activate: 'Activar',
  activated: (code: string) => `${code} activada.`,
  // Menú de acciones.
  rename: 'Editar nombres',
  suspend: 'Suspender',
  archive: 'Archivar',
} as const;

export const SECTION_TEXTS = {
  general: 'Datos generales',
  identifiers: 'Identificadores',
  generalHeading: (code: string) => `Datos generales de ${code}`,
  identifiersHeading: (code: string) => `Identificadores de ${code}`,
  roles: 'Roles',
  rolesHeading: (code: string) => `Roles de ${code}`,
  establishments: 'Establecimientos',
  establishmentsHeading: (code: string) => `Establecimientos de ${code}`,
  relationships: 'Relaciones',
  relationshipsHeading: (code: string) => `Relaciones de ${code}`,
  references: 'Referencias externas',
  referencesHeading: (code: string) => `Referencias externas de ${code}`,
  history: 'Historial',
  historyHeading: (code: string) => `Historial de ${code}`,
} as const;

/**
 * Explicación visible de una acción bloqueada por la organización suspendida (UX-MDM-001 §5.4; contrato §6.2).
 * Propuesta: UX pide el texto de apoyo, no lo redacta.
 */
export const BLOCKED_TEXTS = {
  party_suspended: 'No disponible mientras la organización esté suspendida.',
} as const;

/** Sección «Roles» (UX-MDM-001 §5.4 y §6.4; UI-MDM-001 §2.2). */
export const ROLE_TEXTS = {
  showHistorical: 'Mostrar históricos',
  showHistoricalHelp: 'Incluye los roles terminados y los que ya vencieron.',
  assign: 'Asignar rol',
  /** §6.4. */
  none: 'Esta organización no tiene roles. Asigna uno para indicar si es cliente, proveedor, transportista u otro.',
  /** Propuesta: todos sus roles son históricos y están ocultos. */
  noneVisible: 'Esta organización no tiene roles vigentes, futuros ni suspendidos.',
  /** Propuesta: «Mostrar históricos» encendido y ninguno lo es. */
  noHistorical: 'Esta organización no tiene roles históricos.',
  type: 'Tipo',
  status: 'Estado',
  from: 'Desde',
  to: 'Hasta',
  rowActions: 'Acciones',
  open: 'Indefinido',
  typeName: (name: string, code: string) => (name === code ? code : `${name} (${code})`),
  // Estado derivado (UI-MDM-001 §2.2).
  current: 'Vigente',
  future: (date: string) => `Fuera de vigencia · empieza el ${formatCivilDate(date)}`,
  expired: (date: string | null) => (date === null ? 'Fuera de vigencia' : `Fuera de vigencia · venció el ${formatCivilDate(date)}`),
  suspended: 'Suspendido',
  terminated: 'Terminado',
  moreActions: (name: string) => `Más acciones del rol ${name}`,
  suspend: 'Suspender',
  activate: 'Reactivar',
  terminate: 'Terminar',
  // Snackbars de las acciones de un clic (UX-MDM-001 §5.1): propuesta, §6 no las redacta.
  suspendedOk: (name: string) => `Rol ${name} suspendido.`,
  activatedOk: (name: string) => `Rol ${name} reactivado.`,
} as const;

/** Sección «Establecimientos» (UX-MDM-001 §5.4 y §6.4; UI-MDM-001 §2.3 y §3.3). */
export const ESTABLISHMENT_TEXTS = {
  filter: 'Filtrar establecimientos por estado',
  filters: { active: 'Activos', inactive: 'Inactivos', closed: 'Cerrados', all: 'Todos' },
  open: 'Abrir establecimiento',
  /** §6.4. */
  noneActive: 'No hay establecimientos activos.',
  noneInactive: 'No hay establecimientos inactivos.',
  noneClosed: 'No hay establecimientos cerrados.',
  /** Propuesta: «Todos» sin ninguno. */
  noneAll: 'Esta organización no tiene establecimientos.',
  loadingSubject: 'los establecimientos',
  list: (code: string) => `Establecimientos de ${code}`,
  detail: (code: string) => `Establecimiento ${code}`,
  code: 'Código',
  kind: 'Tipo',
  name: 'Nombre',
  taxCode: 'Anexo SUNAT',
  noTaxCode: 'Sin anexo',
  address: 'Dirección',
  ubigeo: 'Ubigeo',
  postalCode: 'Código postal',
  reference: 'Referencia',
  status: 'Estado',
  closedBy: 'Cerrado por',
  // Estado (UI-MDM-001 §2.3).
  active: 'Activo',
  inactive: 'Inactivo',
  closedOn: (instant: string | null) => (instant === null ? 'Cerrado' : `Cerrado el ${formatDate(instant)}`),
  principal: 'Principal',
  moreActions: (code: string) => `Más acciones del establecimiento ${code}`,
  edit: 'Editar',
  deactivate: 'Desactivar',
  reactivate: 'Reactivar',
  close: 'Cerrar',
  // Snackbars de las acciones de un clic: propuesta, §6 no las redacta.
  deactivatedOk: (code: string) => `Establecimiento ${code} desactivado.`,
  reactivatedOk: (code: string) => `Establecimiento ${code} reactivado.`,
} as const;

export const GENERAL_TEXTS = {
  type: 'Tipo',
  organization: 'Organización',
  code: 'Código',
  legalName: 'Razón social',
  tradeName: 'Nombre comercial',
  status: 'Estado',
  created: 'Registrada',
  updated: 'Última actualización',
  audit: (when: string, who: string) => `${when} · ${who}`,
} as const;

export const IDENTIFIER_TEXTS = {
  showExpired: 'Mostrar vencidos',
  showExpiredHelp: 'Incluye los identificadores cuya vigencia terminó.',
  add: 'Agregar identificador',
  noExpired: 'Esta organización no tiene identificadores vencidos.',
  none: 'Esta organización no tiene identificadores vigentes.',
  country: 'País',
  scheme: 'Esquema',
  value: 'Valor',
  primary: 'Primario',
  from: 'Desde',
  to: 'Hasta',
  status: 'Estado',
  rowActions: 'Acciones',
  current: 'Vigente',
  expiredOn: (date: string) => `Vencido el ${formatCivilDate(date)}`,
  startsOn: (date: string) => `Vigente desde ${formatCivilDate(date)}`,
  moreActions: (scheme: string, value: string) => `Más acciones del identificador ${scheme} ${value}`,
  expire: 'Vencer',
  open: 'Indefinido',
} as const;

/** Diálogos (§5.6 y §6.2). */
export const DIALOG_TEXTS = {
  renameTitle: 'Editar nombres',
  identifiers: 'Identificadores vigentes',
  save: 'Guardar',
  renamed: 'Nombres actualizados.',
  currentValue: (value: string) => `Valor actual: ${value === '' ? 'sin nombre comercial' : value}`,
  addIdentifierTitle: 'Agregar identificador',
  addSubmit: 'Agregar',
  isPrimary: 'Es primario',
  replacesPrimary: 'Reemplaza al primario actual',
  replacesPrimaryHelp: (current: string) => `El primario vigente es ${current}. Quedará vencido el día anterior al «Vigente desde» del nuevo.`,
  validFrom: 'Vigente desde',
  identifierAdded: 'Identificador agregado.',
  identifierReplaced: (date: string) => `Identificador agregado. El anterior quedó vencido el ${formatCivilDate(date)}.`,
  expireTitle: (scheme: string, value: string) => `¿Vencer el identificador ${scheme} ${value}?`,
  expireBody: 'Dejará de estar vigente desde el día siguiente a la fecha indicada. No se edita ni se borra: si estaba mal, agrega uno nuevo.',
  expireDate: 'Vence el',
  reason: 'Motivo (opcional)',
  expireConfirm: 'Vencer',
  expired: 'Identificador vencido.',
  suspendTitle: (code: string) => `¿Suspender ${code}?`,
  suspendBody: 'Mientras esté suspendida no se podrán asignar ni reactivar roles, ni abrir ni reactivar establecimientos. Podrás activarla de nuevo.',
  suspendedList: ['Asignar roles', 'Reactivar roles', 'Abrir establecimientos', 'Reactivar establecimientos'],
  suspendConfirm: 'Suspender',
  suspended: (code: string) => `${code} suspendida.`,
  archiveTitle: (code: string) => `¿Archivar ${code}?`,
  archiveConfirm: 'Archivar',
  archived: (code: string) => `${code} archivada.`,
  // D-MDM-04 (§5.6).
  assignRoleTitle: 'Asignar rol',
  assignSubmit: 'Asignar',
  roleType: 'Tipo de rol',
  roleFrom: 'Desde',
  roleFromHelp: 'Si lo dejas vacío, desde hoy.',
  roleTo: 'Hasta (opcional)',
  roleToHelp: 'Vacío, sin fecha de fin. La fecha es inclusiva.',
  roleAssigned: 'Rol asignado.',
  // Aviso de solape en vivo (UI-MDM-001 §3.5): propuesta; el texto de campo es el de UX-MDM-001 §6.3.
  overlapWarning: 'Las fechas se cruzan con un rol que ya tiene.',
  overlapDetail: (label: string, from: string, to: string | null) =>
    `${label}: del ${formatCivilDate(from)} ${to === null ? 'sin fecha de fin' : `al ${formatCivilDate(to)}`}. Cambia las fechas o termina ese rol antes.`,
  // D-MDM-10 (§6.2).
  terminateTitle: (name: string) => `¿Terminar el rol ${name}?`,
  terminateBody: 'El rol dejará de estar vigente desde el día siguiente a la fecha de término y no se podrá reactivar. Para volver a tenerlo habrá que asignarlo de nuevo.',
  currentValidity: (from: string, to: string | null) => `Vigencia actual: del ${formatCivilDate(from)} ${to === null ? 'sin fecha de fin' : `al ${formatCivilDate(to)}`}`,
  terminateDate: 'Termina el',
  terminateConfirm: 'Terminar rol',
  terminated: (name: string, date: string) => `Rol ${name} terminado el ${formatCivilDate(date)}.`,
  // D-MDM-05 (§5.6).
  openEstablishmentTitle: 'Abrir establecimiento',
  editEstablishmentTitle: (code: string) => `Editar el establecimiento ${code}`,
  openSubmit: 'Abrir',
  establishmentGroup: 'Establecimiento',
  establishmentCode: 'Código',
  establishmentKind: 'Tipo',
  establishmentName: 'Nombre',
  addressGroup: 'Dirección',
  codeHelp: 'No se podrá cambiar ni reutilizar, aunque el establecimiento se cierre.',
  immutableCode: (code: string) => `Código ${code} (no se puede cambiar)`,
  taxCode: 'Anexo SUNAT (opcional)',
  taxCodeHelp: 'Código de establecimiento anexo: 4 dígitos.',
  isPrincipal: 'Principal',
  principalHelp: 'Solo puede haber un establecimiento principal activo.',
  /** §6.3: aviso, no error. */
  principalWarning: (code: string) => `El principal actual es ${code}. Si guardas, el servidor lo rechazará; quita antes su marca.`,
  line1: 'Dirección',
  line2: 'Dirección, línea 2',
  ubigeo: 'Ubigeo',
  ubigeoHelp: 'Solo en Perú: 6 dígitos.',
  department: 'Departamento',
  province: 'Provincia',
  district: 'Distrito',
  postalCode: 'Código postal',
  country: 'País',
  countryHelp: 'Código de 2 letras: PE para Perú.',
  reference: 'Referencia',
  establishmentOpened: 'Establecimiento abierto.',
  establishmentSaved: 'Cambios guardados.',
  // D-MDM-09 (§6.2).
  closeTitle: (code: string) => `¿Cerrar el establecimiento ${code}?`,
  closeBody: (code: string) => `El cierre es definitivo: no se puede reabrir y el código ${code} no podrá volver a usarse en esta organización.`,
  closePrincipal: 'Es el establecimiento principal; la organización quedará sin principal.',
  closeReferences: (count: number) => `Tiene ${count} ${count === 1 ? 'referencia externa vinculada' : 'referencias externas vinculadas'}.`,
  closeConfirm: 'Cerrar establecimiento',
  closed: (code: string) => `Establecimiento ${code} cerrado.`,
} as const;

/** Sección «Relaciones» y D-MDM-06 y 11 (UX-MDM-001 §5.4, §5.6, §6.2 y §6.4; UI-MDM-001 §2.5). */
export const RELATIONSHIP_TEXTS = {
  currentOnly: 'Solo vigentes',
  currentOnlyHelp: 'Apágalo para ver también las terminadas y las que ya vencieron.',
  start: 'Nueva relación',
  /** §6.4. */
  noneCurrent: 'No hay relaciones vigentes con otras organizaciones.',
  /** Propuesta: «Solo vigentes» apagado y ninguna. */
  none: 'Esta organización no tiene relaciones con otras organizaciones.',
  loadingSubject: 'las relaciones',
  /** Más de una página (el contrato pagina de 100 en 100): no se presenta como completa. */
  truncated: (shown: number, total: number) => `Se muestran las primeras ${shown} de ${total} relaciones.`,
  table: (code: string) => `Relaciones de ${code}`,
  direction: 'Sentido',
  other: 'Otra organización',
  kind: 'Tipo',
  from: 'Desde',
  to: 'Hasta',
  status: 'Estado',
  rowActions: 'Acciones',
  open: 'Indefinido',
  /** «Es matriz de», «Es filial de»: el papel de la organización de la ficha (C-04). */
  sentence: (label: string) => `Es ${label.toLocaleLowerCase('es')} de`,
  /** Sin catálogo: el código y el extremo. */
  sentenceFallback: (code: string, side: 'from' | 'to') => (side === 'from' ? `${code} (origen)` : `${code} (destino)`),
  kindName: (name: string, code: string) => (name === code ? code : `${name} (${code})`),
  /** Mientras se resuelve el nombre de la otra organización (P-03 por id, G-566). */
  resolving: 'Cargando nombre…',
  unresolved: 'Organización sin nombre disponible',
  current: 'Vigente',
  future: (date: string) => `Fuera de vigencia · empieza el ${formatCivilDate(date)}`,
  expired: (date: string | null) => (date === null ? 'Fuera de vigencia' : `Fuera de vigencia · venció el ${formatCivilDate(date)}`),
  ended: 'Terminada',
  moreActions: (other: string) => `Más acciones de la relación con ${other}`,
  end: 'Terminar',
  // D-MDM-06.
  startTitle: 'Nueva relación',
  startSubmit: 'Registrar',
  kindField: 'Tipo de relación',
  side: 'Sentido',
  sideOption: (code: string, label: string) => `${code} es ${label.toLocaleLowerCase('es')} de la otra organización`,
  sideHelp: 'El tipo fija el sentido: elige qué papel tiene esta organización.',
  chooseKindFirst: 'Elige primero el tipo de relación.',
  /** Frase de sentido en vivo (UI-MDM-001 §3.5): «ACME es matriz de…». */
  sentencePreview: (code: string, label: string, other: string | null) => `${code} es ${label.toLocaleLowerCase('es')} de ${other ?? '…'}`,
  otherParty: 'Otra organización',
  otherPartyHelp: 'Busca por código, razón social, nombre comercial o RUC (11 dígitos).',
  /** §6.4. */
  noMatches: 'Ninguna organización coincide. Solo se pueden elegir organizaciones activas o suspendidas.',
  matches: (count: number) => (count === 1 ? '1 organización encontrada.' : `${count} organizaciones encontradas.`),
  suspendedOption: (code: string, name: string) => `${code} · ${name} (suspendida)`,
  validFrom: 'Desde',
  validFromHelp: 'Si lo dejas vacío, desde hoy.',
  validTo: 'Hasta (opcional)',
  validToHelp: 'Vacío, sin fecha de fin. La fecha es inclusiva.',
  overlapWarning: 'Ya hay una relación de este tipo y sentido con esa organización en fechas que se cruzan.',
  /** §6.1 `party_relationship.overlap`, con el tipo del borrador. */
  overlapField: (kind: string) => `Ya existe una relación «${kind}» entre estas organizaciones en esas fechas. Cambia las fechas o termina la relación existente.`,
  started: 'Relación registrada.',
  // D-MDM-11 (§6.2).
  endTitle: '¿Terminar la relación?',
  endBody: (from: string, label: string, to: string) =>
    `${from} dejará de ser ${label.toLocaleLowerCase('es')} de ${to} desde el día siguiente a la fecha de término. No se puede deshacer.`,
  endDate: 'Termina el',
  reason: 'Motivo (opcional)',
  endConfirm: 'Terminar relación',
  endedOk: 'Relación terminada.',
  /** D-MDM-14 de una relación (propuesta: §6.1 solo redacta el de la organización). */
  conflict: 'Otra persona cambió esta relación mientras la revisabas.',
} as const;

/** Sección «Referencias externas» y D-MDM-07 y 12 (UX-MDM-001 §4.5, §5.4, §5.6, §6.2 y §6.4; UI-MDM-001 §2.4). */
export const REFERENCE_TEXTS = {
  link: 'Vincular',
  /** §6.4. */
  none: 'Esta organización aún no tiene claves del ERP.',
  loadingSubject: 'las referencias externas',
  truncated: (shown: number, total: number) => `Se muestran las primeras ${shown} de ${total} referencias.`,
  table: (code: string) => `Referencias externas de ${code}`,
  object: 'Objeto',
  system: 'Sistema',
  instance: 'Instancia',
  objectType: 'Tipo de objeto',
  key: 'Clave',
  syncStatus: 'Estado de sincronización',
  lastSynced: 'Última versión sincronizada',
  notSynced: '—',
  rowActions: 'Acciones',
  partyObject: (code: string) => `Organización ${code}`,
  establishmentObject: (code: string) => `Establecimiento ${code}`,
  /** Un establecimiento que ya no figura en la ficha cargada. */
  unknownEstablishment: 'Establecimiento no disponible',
  partyInSentence: (code: string) => `la organización ${code}`,
  establishmentInSentence: (code: string) => `el establecimiento ${code}`,
  unknownEstablishmentInSentence: 'un establecimiento que ya no figura en la ficha',
  moreActions: (key: string) => `Más acciones de la clave ${key}`,
  unlink: 'Desvincular',
  /** Línea de una referencia en el detalle de un establecimiento (wireframe de §5.4). */
  line: (system: string, instance: string, type: string, key: string) => `${system} / ${instance} / ${type} / ${key}`,
  establishmentReferences: 'Referencias externas',
  establishmentNone: 'Sin claves del ERP.',
  establishmentLoadError: 'No pudimos cargar sus referencias externas.',
  // D-MDM-07.
  linkTitle: 'Vincular referencia externa',
  linkSubmit: 'Vincular',
  target: 'Objeto',
  targetHelp: 'La organización o uno de sus establecimientos no cerrados.',
  targetParty: (code: string) => `La organización (${code})`,
  targetEstablishment: (code: string, name: string) => `Establecimiento ${code} · ${name}`,
  systemCode: 'Sistema',
  systemCodeHelp: 'Por ejemplo, ERP. Texto libre: escríbelo siempre igual.',
  systemInstance: 'Instancia',
  systemInstanceHelp: 'Por ejemplo, PRD-100.',
  externalObjectType: 'Tipo de objeto',
  externalObjectTypeHelp: 'Por ejemplo, COMPANY o BRANCH.',
  externalKey: 'Clave',
  linked: 'Referencia vinculada.',
  /** `key_duplicate`: dónde está la clave (X-01 por la clave completa). */
  ownerParty: (code: string) => `Está vinculada a la organización ${code}.`,
  ownerEstablishment: (code: string) => `Está vinculada a un establecimiento de la organización ${code}.`,
  ownerUnknown: 'No pudimos averiguar a qué objeto está vinculada.',
  seeOwner: 'Ver a qué está vinculada',
  // D-MDM-12 (§6.2).
  unlinkTitle: (key: string) => `¿Desvincular la clave ${key}?`,
  unlinkBody: (system: string, instance: string, object: string) =>
    `${system} ${instance} dejará de corresponder a ${object}. La clave no podrá vincularse a otro objeto.`,
  unlinkConfirm: 'Desvincular',
  unlinked: 'Referencia desvinculada.',
  conflict: 'Otra persona cambió esta referencia mientras la revisabas.',
} as const;

/** Sección «Historial» (UX-MDM-001 §5.4 y §6.4; UI-MDM-001 §3.3). Derivado: SU-MDM-11, G-565. */
export const HISTORY_TEXTS = {
  list: (code: string) => `Historial de ${code}`,
  partialTitle: 'El historial completo no está disponible.',
  partialBody:
    'Solo se muestran el alta, la última actualización y la fecha en que terminó cada elemento. No constan los cambios de nombre, las suspensiones ni las reactivaciones.',
  loadingSubject: 'el historial',
  /** §6.4. */
  onlyCreated: (date: string, user: string) => `Solo consta el alta del ${formatDate(date)} por ${user}.`,
  by: (user: string) => `por ${user}`,
  created: 'Alta de la organización',
  updated: 'Última actualización de la organización (sin detalle de qué cambió)',
  identifierExpired: (scheme: string, value: string) => `Identificador ${scheme} ${value} vencido`,
  roleTerminated: (name: string) => `Rol ${name} terminado`,
  establishmentClosed: (code: string) => `Establecimiento ${code} cerrado`,
  relationshipEnded: (sentence: string, other: string) => `Relación terminada: ${sentence.toLocaleLowerCase('es')} ${other}`,
  referenceUnlinked: (line: string) => `Referencia externa ${line} desvinculada`,
  /** Fecha civil de fin de vigencia: el contrato no da el instante. */
  onDate: (date: string) => `Vigente hasta el ${formatCivilDate(date)}`,
} as const;
