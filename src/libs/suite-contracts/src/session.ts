import { SITES, isSite, isSystemCode, type Site, type SystemCode } from './systems.ts';
import { isTenantCode, type SignInTenant } from './tenants.ts';

/** Perfil activo de una persona en un sistema. En el portal real lo publica UMS (G-107). */
export interface SuiteProfile {
  readonly profileId: string;
  readonly system: SystemCode;
  /** Para SIL, un `Rol` de `@sil/contracts`; para los demás sistemas, texto libre que no se interpreta. */
  readonly role: string;
  /**
   * La sede del perfil, o `null` si el perfil no tiene sede concreta: es `context.branch` de UMS, nulo en un perfil
   * `OrgWide`. Un sistema que admite todas las sedes lo lee como «Todas las sedes» (D-030); uno que no —SIL, MDM—,
   * como un usuario sin sede registrada, que no ingresa (US-SIL-004 escenario 4).
   */
  readonly site: Site | null;
}

export interface SuiteUser {
  readonly id: string;
  readonly fullName: string;
  readonly firstName: string;
  readonly initials: string;
}

/**
 * Sesión de la suite del prototipo (anexo A1, §7.1). Inmutable y SIN credenciales ni tokens: es
 * un contrato de mock que reemplaza el portal real (G-124, G-176). No lleva `menuAccess`,
 * `scopes` ni `featureFlags` (G-125).
 */
export interface SuiteSession {
  readonly version: 1;
  readonly sessionId: string;
  readonly user: SuiteUser;
  /** El inquilino con el que se inició sesión (D-029): acota todo lo que la sesión concede. */
  readonly tenant: SignInTenant;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly profiles: readonly SuiteProfile[];
  readonly currentProfileBySystem: Readonly<Partial<Record<SystemCode, string>>>;
  /** La sede de trabajo elegida en S-02, o `null` para trabajar en todas (D-030). Siempre una sede de la sesión. */
  readonly currentSite: Site | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' && value.length <= 200 ? value : null;
}

function instant(value: unknown): string | null {
  const t = text(value);
  return t !== null && Number.isFinite(Date.parse(t)) ? t : null;
}

function parseUser(value: unknown): SuiteUser | null {
  if (!isObject(value)) return null;
  const id = text(value.id);
  const fullName = text(value.fullName);
  const firstName = text(value.firstName);
  const initials = text(value.initials);
  if (id === null || fullName === null || firstName === null || initials?.length !== 2) return null;
  return { id, fullName, firstName, initials };
}

/** La sede de UMS: una del catálogo, `null` si el usuario no tiene sede, `undefined` si el dato no es válido. */
function siteOf(value: unknown): Site | null | undefined {
  if (value === null) return null;
  return isSite(value) ? value : undefined;
}

function parseTenant(value: unknown): SignInTenant | null {
  if (!isObject(value)) return null;
  const name = text(value.name);
  if (!isTenantCode(value.code) || name === null) return null;
  return { code: value.code, name };
}

function parseProfile(value: unknown): SuiteProfile | null {
  if (!isObject(value)) return null;
  const profileId = text(value.profileId);
  const role = text(value.role);
  const site = siteOf(value.site);
  if (profileId === null || role === null || !isSystemCode(value.system) || site === undefined) return null;
  return { profileId, system: value.system, role, site };
}

function parseProfiles(value: unknown): SuiteProfile[] | null {
  if (!Array.isArray(value)) return null;
  const profiles: SuiteProfile[] = [];
  for (const raw of value as unknown[]) {
    const profile = parseProfile(raw);
    if (profile === null) return null;
    profiles.push(profile);
  }
  return profiles;
}

function parseCurrentProfiles(value: unknown, profiles: readonly SuiteProfile[]): Partial<Record<SystemCode, string>> | null {
  if (!isObject(value)) return null;
  const current: Partial<Record<SystemCode, string>> = {};
  for (const [code, id] of Object.entries(value)) {
    // Un perfil vigente que la sesión no concede no es una preferencia: es una sesión alterada.
    if (!isSystemCode(code) || typeof id !== 'string' || !profiles.some((p) => p.profileId === id && p.system === code)) return null;
    current[code] = id;
  }
  return current;
}

/** `undefined` si es inválida: una sede de trabajo que ningún perfil concede no es una preferencia, es una sesión alterada. */
function parseCurrentSite(value: unknown, profiles: readonly SuiteProfile[]): Site | null | undefined {
  if (value === null) return null;
  return isSite(value) && sitesOf({ profiles }).includes(value) ? value : undefined;
}

/**
 * Lo guardado en `sessionStorage` es entrada no confiable (ADR-0109 P-FE-06): se valida campo a
 * campo y cualquier incoherencia descarta la sesión entera; nunca se completa a ojo.
 */
/** Lo que la sesión trae de su emisión: identificador, persona, inquilino e instantes. */
function parseIssue(value: Record<string, unknown>): Pick<SuiteSession, 'sessionId' | 'user' | 'tenant' | 'issuedAt' | 'expiresAt'> | null {
  const sessionId = text(value.sessionId);
  const user = parseUser(value.user);
  const tenant = parseTenant(value.tenant);
  const issuedAt = instant(value.issuedAt);
  const expiresAt = instant(value.expiresAt);
  if (sessionId === null || user === null || tenant === null || issuedAt === null || expiresAt === null) return null;
  return { sessionId, user, tenant, issuedAt, expiresAt };
}

export function parseSession(value: unknown): SuiteSession | null {
  if (!isObject(value) || value.version !== 1) return null;
  const issue = parseIssue(value);
  const profiles = parseProfiles(value.profiles);
  if (issue === null || profiles === null) return null;
  const currentProfileBySystem = parseCurrentProfiles(value.currentProfileBySystem, profiles);
  if (currentProfileBySystem === null) return null;
  const currentSite = parseCurrentSite(value.currentSite, profiles);
  if (currentSite === undefined) return null;
  return { version: 1, ...issue, profiles, currentProfileBySystem, currentSite };
}

/** Texto crudo (p. ej. de `sessionStorage`) a sesión; el JSON inválido es «sin sesión». */
export function parseRawSession(raw: string | null): SuiteSession | null {
  if (raw === null) return null;
  try {
    return parseSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function profilesOf(session: SuiteSession, system: SystemCode): readonly SuiteProfile[] {
  return session.profiles.filter((p) => p.system === system);
}

/** Perfil con el que se abre el sistema: el vigente de la sesión o, si no hay, el primero concedido. */
export function currentProfileOf(session: SuiteSession, system: SystemCode): SuiteProfile | null {
  const granted = profilesOf(session, system);
  const id = session.currentProfileBySystem[system];
  return granted.find((p) => p.profileId === id) ?? granted[0] ?? null;
}

/** Las sedes concretas de los perfiles, en el orden del catálogo; los perfiles de todas las sedes no suman ninguna. */
export function sitesOf(session: Pick<SuiteSession, 'profiles'>): Site[] {
  return SITES.filter((site) => session.profiles.some((p) => p.site === site));
}

/**
 * S-02 deja elegir la sede de trabajo solo si la persona tiene perfiles en más de una (D-030): con una sola,
 * los perfiles de todas las sedes no cambian lo que ve, y elegir sería una pregunta sin consecuencia.
 */
export function canChooseSite(session: Pick<SuiteSession, 'profiles'>): boolean {
  return sitesOf(session).length > 1;
}

/** La sede de trabajo con la que abre una sesión nueva: la única que tiene; con varias o ninguna, todas. */
export function initialSite(profiles: readonly SuiteProfile[]): Site | null {
  const sites = sitesOf({ profiles });
  return sites.length === 1 ? (sites[0] ?? null) : null;
}

/** Los perfiles que valen en la sede de trabajo: los de esa sede y los de todas las sedes; sin sede elegida, todos. */
export function profilesInSite(profiles: readonly SuiteProfile[], site: Site | null): SuiteProfile[] {
  return profiles.filter((p) => site === null || p.site === null || p.site === site);
}
