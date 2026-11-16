import type { SuiteProfile, SuiteSession, Site } from '@suite/contracts';
import { DEFAULT_TENANT_CODE, initialSite } from '@suite/contracts';
import { findActiveTenant } from './tenants.ts';
import { findTestUser, userProfiles } from './test-users.ts';

/** Clave de `sessionStorage` donde el mock guarda la sesión de la suite (solo mock, anexo A1 §7.1). */
export const MOCK_SESSION_KEY = 'suite.sesion.v1';
/** Clave de la última actividad, para la inactividad de la sesión (SU-30). */
export const MOCK_ACTIVITY_KEY = 'suite.actividad.v1';

export const WORKDAY_VALIDITY_MS = 8 * 60 * 60 * 1000;
export const INACTIVITY_MS = 30 * 60 * 1000;
/** `?sim=expira` acorta ambas a 20 s (anexo A1 §7.4). */
export const SHORT_VALIDITY_MS = 20_000;

const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Instante ISO 8601 con desfase de Lima (`-05:00`), que es como se muestra la hora (anexo A1 §7.1). */
export function toLimaIso(ms: number): string {
  return `${new Date(ms - LIMA_OFFSET_MS).toISOString().slice(0, 19)}-05:00`;
}

export interface TestSessionOptions {
  /** Usuario de prueba del catálogo del mock (`carlos.vega`); si falta, se crea uno sintético. */
  readonly user?: string;
  /** Sin `usuario`: rol de SIL del perfil sintético (un `Rol` de `@sil/contracts`). */
  readonly role?: string;
  /** Sin `usuario`: sede del perfil sintético. Por defecto Callao; `null`, un usuario sin sede en UMS. */
  readonly site?: Site | null;
  /** `profileId` de SIL con el que se abre; por defecto el primero concedido. */
  readonly currentSilProfile?: string;
  /** Sede de trabajo de S-02 (`null`: todas); por defecto, la única de la persona o todas (D-030). */
  readonly currentSite?: Site | null;
  /** Sin `user`: código de un inquilino activo de la tabla del mock; por defecto ORG. Con `user`, el de la cuenta. */
  readonly tenant?: string;
  readonly now?: number;
  readonly validityMs?: number;
}

const NAME_BY_ROLE: Readonly<Record<string, { fullName: string; firstName: string; initials: string }>> = {
  CUSTOMER_SERVICE: { fullName: 'Ana Pérez', firstName: 'Ana', initials: 'AP' },
  NEGOCIO: { fullName: 'Carlos Vega', firstName: 'Carlos', initials: 'CV' },
  ASISTENTE_TRANSPORTE: { fullName: 'Luis Rojas', firstName: 'Luis', initials: 'LR' },
};

interface Holder {
  readonly id: string;
  readonly names: { readonly fullName: string; readonly firstName: string; readonly initials: string };
  readonly profiles: SuiteProfile[];
}

function holderOf(options: TestSessionOptions): Holder {
  if (options.user !== undefined) {
    const defined = findTestUser(options.user);
    if (defined === undefined) throw new Error(`Usuario de prueba desconocido: ${options.user}`);
    return { id: defined.id, names: defined, profiles: userProfiles(defined) };
  }
  const role = options.role ?? 'CUSTOMER_SERVICE';
  const site = options.site === undefined ? 'Callao' : options.site;
  const id = `prueba.${role.toLowerCase()}`;
  return {
    id,
    names: NAME_BY_ROLE[role] ?? { fullName: 'Persona de Prueba', firstName: 'Persona', initials: 'PP' },
    profiles: [{ profileId: `${id}:SIL:${site?.toUpperCase() ?? 'SIN-SEDE'}`, system: 'SIL', role, site }],
  };
}

/** Perfil con el que abre cada sistema: el primero concedido, salvo el de SIL que se pida. */
function currentOf(profiles: readonly SuiteProfile[], ofSil: string | undefined): Partial<Record<SuiteProfile['system'], string>> {
  const current: Partial<Record<SuiteProfile['system'], string>> = {};
  for (const profile of profiles) current[profile.system] ??= profile.profileId;
  if (ofSil !== undefined) current.SIL = ofSil;
  return current;
}

/**
 * AYUDANTE DE PRUEBAS (anexo A1 §7.5, G-176): construye una sesión de la suite sin pasar por S-01,
 * para sembrarla en las pruebas de componente y de extremo a extremo. No contiene credenciales:
 * la sesión no las lleva. No debe usarse en código de producción.
 */
export function createTestSession(options: TestSessionOptions = {}): SuiteSession {
  const now = options.now ?? Date.now();
  const holder = holderOf(options);
  // El usuario de prueba trae su inquilino; el sintético usa el pedido o ORG.
  const code = options.user === undefined ? (options.tenant ?? DEFAULT_TENANT_CODE) : (findTestUser(options.user)?.tenant ?? DEFAULT_TENANT_CODE);
  const tenant = findActiveTenant(code);
  if (tenant === undefined) throw new Error(`Inquilino de prueba desconocido: ${code}`);
  return {
    version: 1,
    sessionId: `mock-prueba-${holder.id}`,
    user: {
      id: holder.id,
      fullName: holder.names.fullName,
      firstName: holder.names.firstName,
      initials: holder.names.initials,
    },
    tenant: { code: tenant.code, name: tenant.name },
    issuedAt: toLimaIso(now),
    expiresAt: toLimaIso(now + (options.validityMs ?? WORKDAY_VALIDITY_MS)),
    profiles: holder.profiles,
    currentProfileBySystem: currentOf(holder.profiles, options.currentSilProfile),
    currentSite: options.currentSite === undefined ? initialSite(holder.profiles) : options.currentSite,
  };
}
