import type { SuiteProfile, Site, SystemCode, SuiteUser } from '@suite/contracts';

/**
 * CLAVE DE PRUEBA del prototipo (anexo A1 §7.1, SU-28). Vive SOLO aquí: ningún documento, README ni
 * variable de entorno publicada la repite, y no se registra en logs. Al sustituir el mock por el
 * portal real esta constante y la lista de usuarios de prueba se eliminan (G-175). No protege nada:
 * el prototipo no tiene datos reales.
 */
export const TEST_PASSWORD = 'Suite-Prueba-2026';

interface TestGrant {
  readonly system: SystemCode;
  readonly role: string;
  /**
   * `null`: el perfil no tiene sede concreta (`OrgWide` en UMS). Vale en todas las sedes en los sistemas que lo admiten
   * (D-030); en SIL, que no, es el usuario sin sede registrada que no ingresa (US-SIL-004 escenario 4).
   */
  readonly site: Site | null;
}

export interface TestUser extends SuiteUser {
  /** Cuenta bloqueada de origen (SU-29): no concede nada aunque se desbloqueara. */
  readonly lockedFromSource: boolean;
  /** Texto de la lista «Usuarios de prueba» de S-01: qué demuestra la cuenta. */
  readonly description: string;
  /** El inquilino de la tabla del mock al que pertenece la cuenta (D-029). Ficticio: el real lo publica UMS (G-269). */
  readonly tenant: string;
  /**
   * El caso de ORG del que la cuenta es variante en otro inquilino (`ana.perez`); en los casos de ORG,
   * su propio `id`. Las variantes heredan concesiones, descripción, bloqueo y notificaciones de su caso.
   */
  readonly caseOf: string;
  readonly grants: readonly TestGrant[];
}

const SIL_CS: TestGrant = { system: 'SIL', role: 'CUSTOMER_SERVICE', site: 'Callao' };

/**
 * Los casos de prueba, en ORG (SU-36, anexo A1 §7.2). Sin PII. Cubren los casos de ingreso de US-SIL-004:
 * Customer Service (edita), Negocio (solo lectura, y consultor de MDM), Asistente de Transporte (rol que SIL
 * nombra pero no deja ingresar en el Sprint 1, D-028), un usuario con rol de SIL pero sin sede en UMS, la
 * analista de datos maestros de MDM (D-044), uno sin SIL y una cuenta bloqueada.
 */
const ORG_CASES: readonly TestUser[] = [
  {
    id: 'ana.perez',
    caseOf: 'ana.perez',
    fullName: 'Ana Pérez',
    firstName: 'Ana',
    initials: 'AP',
    lockedFromSource: false,
    description: 'Customer Service · Callao',
    tenant: 'ORG',
    grants: [SIL_CS, { system: 'DT', role: 'Consulta', site: 'Callao' }, { system: 'CNS', role: 'Consulta', site: 'Callao' }],
  },
  {
    id: 'carlos.vega',
    caseOf: 'carlos.vega',
    fullName: 'Carlos Vega',
    firstName: 'Carlos',
    initials: 'CV',
    lockedFromSource: false,
    description: 'Negocio · Piura (solo lectura) · cambia de sede',
    tenant: 'ORG',
    // El caso «cambia de sede» de D-030: SIL y MDM solo en Piura; DT también en Callao, y CMS, UMS y YMS en todas
    // las sedes (`OrgWide`). Con dos sedes, S-02 le deja elegir la sede de trabajo.
    grants: [
      { system: 'SIL', role: 'NEGOCIO', site: 'Piura' },
      { system: 'CMS', role: 'Consulta', site: null },
      { system: 'DT', role: 'Consulta', site: 'Piura' },
      { system: 'DT', role: 'Consulta', site: 'Callao' },
      // Rol de MDM reconocido por `mdm-app` (SU-MDM-01): consulta en solo lectura.
      { system: 'MDM', role: 'CONSULTOR', site: 'Piura' },
      { system: 'UMS', role: 'Consulta', site: null },
      { system: 'YMS', role: 'Consulta', site: null },
    ],
  },
  {
    id: 'luis.rojas',
    caseOf: 'luis.rojas',
    fullName: 'Luis Rojas',
    firstName: 'Luis',
    initials: 'LR',
    lockedFromSource: false,
    description: 'Asistente de Transporte · Callao',
    tenant: 'ORG',
    grants: [{ system: 'SIL', role: 'ASISTENTE_TRANSPORTE', site: 'Callao' }, { system: 'DT', role: 'Consulta', site: 'Callao' }],
  },
  {
    id: 'rosa.diaz',
    caseOf: 'rosa.diaz',
    fullName: 'Rosa Díaz',
    firstName: 'Rosa',
    initials: 'RD',
    lockedFromSource: false,
    description: 'Customer Service sin sede asignada',
    tenant: 'ORG',
    grants: [{ system: 'SIL', role: 'CUSTOMER_SERVICE', site: null }],
  },
  {
    id: 'rosa.medina',
    caseOf: 'rosa.medina',
    fullName: 'Rosa Medina',
    firstName: 'Rosa',
    initials: 'RM',
    lockedFromSource: false,
    description: 'Analista de datos maestros (MDM) · Callao',
    tenant: 'ORG',
    grants: [{ system: 'MDM', role: 'ANALISTA_DATOS_MAESTROS', site: 'Callao' }],
  },
  {
    id: 'diego.salas',
    caseOf: 'diego.salas',
    fullName: 'Diego Salas',
    firstName: 'Diego',
    initials: 'DS',
    lockedFromSource: false,
    description: 'Sin acceso a SIL · todas las sedes',
    tenant: 'ORG',
    grants: [{ system: 'DT', role: 'Consulta', site: null }],
  },
  {
    id: 'cuenta.bloqueada',
    caseOf: 'cuenta.bloqueada',
    fullName: 'Usuario bloqueado',
    firstName: 'Usuario',
    initials: 'UB',
    lockedFromSource: true,
    description: 'Cuenta bloqueada',
    tenant: 'ORG',
    grants: [],
  },
];

/** Quién encarna cada caso en otro inquilino: otra persona ficticia, con su propio usuario. */
interface Variant {
  readonly id: string;
  readonly fullName: string;
  readonly initials: string;
}

const VARIANTS: Readonly<Record<string, Readonly<Record<string, Variant>>>> = {
  ORG_TRANSPORTES: {
    'ana.perez': { id: 'rosa.torres', fullName: 'Rosa Torres', initials: 'RT' },
    'luis.rojas': { id: 'jorge.huaman', fullName: 'Jorge Huamán', initials: 'JH' },
    'carlos.vega': { id: 'miguel.flores', fullName: 'Miguel Flores', initials: 'MF' },
    'rosa.diaz': { id: 'carmen.salazar', fullName: 'Carmen Salazar', initials: 'CS' },
    'rosa.medina': { id: 'elena.castro', fullName: 'Elena Castro', initials: 'EC' },
    'diego.salas': { id: 'patricia.leon', fullName: 'Patricia León', initials: 'PL' },
    'cuenta.bloqueada': { id: 'bloqueada.transportes', fullName: 'Usuario bloqueado', initials: 'UB' },
  },
  UNILOG: {
    'ana.perez': { id: 'sofia.ramos', fullName: 'Sofía Ramos', initials: 'SR' },
    'luis.rojas': { id: 'pedro.diaz', fullName: 'Pedro Díaz', initials: 'PD' },
    'carlos.vega': { id: 'ricardo.paredes', fullName: 'Ricardo Paredes', initials: 'RP' },
    'rosa.diaz': { id: 'teresa.nunez', fullName: 'Teresa Núñez', initials: 'TN' },
    'rosa.medina': { id: 'lucia.medina', fullName: 'Lucía Medina', initials: 'LM' },
    'diego.salas': { id: 'valeria.chavez', fullName: 'Valeria Chávez', initials: 'VC' },
    'cuenta.bloqueada': { id: 'bloqueada.unilog', fullName: 'Usuario bloqueado', initials: 'UB' },
  },
};

function variantOf(base: TestUser, tenant: string, variant: Variant): TestUser {
  return { ...base, ...variant, firstName: variant.fullName.split(' ')[0] ?? variant.fullName, tenant, caseOf: base.id };
}

/**
 * Usuarios ficticios de los tres inquilinos (D-029): los siete casos de ORG y su variante en ORG TRANSPORTES
 * y en UNILOG, con las mismas concesiones. Los usuarios son únicos en todo el mock.
 */
export const TEST_USERS: readonly TestUser[] = [
  ...ORG_CASES,
  ...Object.entries(VARIANTS).flatMap(([tenant, byCase]) =>
    ORG_CASES.flatMap((base) => {
      const variant = byCase[base.id];
      return variant === undefined ? [] : [variantOf(base, tenant, variant)];
    }),
  ),
];

export function findTestUser(id: string): TestUser | undefined {
  const normalized = id.trim().toLowerCase();
  return TEST_USERS.find((u) => u.id === normalized);
}

/** La cuenta de ese inquilino, o `undefined`: fuera de su inquilino la cuenta no existe. */
export function findTestUserIn(tenant: string, id: string): TestUser | undefined {
  const defined = findTestUser(id);
  return defined?.tenant === tenant ? defined : undefined;
}

/** El perfil del caso de ORG que corresponde a uno de una variante: así la variante hereda sus notificaciones. */
export function caseProfileId(profileId: string): string {
  const [userId = '', ...rest] = profileId.split(':');
  const defined = findTestUser(userId);
  return defined === undefined ? profileId : [defined.caseOf, ...rest].join(':');
}

export function userProfiles(user: TestUser): SuiteProfile[] {
  return user.grants.map((c) => ({
    profileId: `${user.id}:${c.system}:${c.site?.toUpperCase() ?? 'SIN-SEDE'}`,
    system: c.system,
    role: c.role,
    site: c.site,
  }));
}
