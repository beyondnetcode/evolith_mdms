import type { ComponentType } from 'react';
import type { NetworkSettings } from './network-settings.ts';
import { profilesOf, type SuiteProfile, type SuiteSession } from './session.ts';
import type { Site, SystemCode } from './systems.ts';

/**
 * Frontera entre la suite (anfitrión) y un sistema que monta, como SIL (D-026). Es la interfaz que
 * mañana separa un remote de Module Federation: el sistema solo recibe un `SystemContext` y nunca
 * importa la suite. Es deliberadamente mínima: lo que el sistema necesita y nada más.
 */

/** Lo que la suite sabe de un sistema sin cargar su código: su sigla y cómo nombrar sus roles. */
export interface SystemDescriptor {
  readonly code: SystemCode;
  /**
   * Etiqueta visible de un rol del sistema («Customer Service»), o `null` si el sistema no lo reconoce:
   * un perfil con un rol desconocido no abre el sistema (frontera validada).
   */
  readonly roleLabel: (role: string) => string | null;
  /**
   * Etiqueta de un rol de UMS que el sistema nombra pero NO deja ingresar (p. ej. los de transporte en el
   * Sprint 1 de SIL, D-018): solo para que el portal no muestre el código interno. No concede acceso.
   */
  readonly otherRoleLabel?: (role: string) => string | null;
  /**
   * El sistema admite perfiles de todas las sedes (`OrgWide` en UMS, D-030). Si no —SIL y MDM—, un perfil sin
   * sede no lo abre: es el «sin sede registrada en UMS» de la US-SIL-004 (escenario 4), y se nombra «sin sede».
   */
  readonly acceptsAllSites?: boolean;
}

/** Perfil con el que se ingresa a un sistema: además de un rol reconocido, una sede registrada en UMS. */
export type GrantedProfile = SuiteProfile & { readonly site: Site };

/** Lo que el anfitrión entrega al sistema al montarlo. */
export interface SystemContext {
  /** Sesión vigente de la suite (sin credenciales ni tokens). */
  readonly session: SuiteSession;
  /** Perfil vigente del sistema: la guarda del anfitrión ya comprobó que existe, que su rol es conocido y que tiene sede. */
  readonly currentProfile: GrantedProfile;
  /** Cambia el perfil vigente del sistema (la sede de SIL): el anfitrión vuelve a montar el sistema con él. */
  readonly selectProfile: (profileId: string) => void;
  /** Ajustes de red y simulaciones del prototipo (`?sim=`). */
  readonly networkSettings: NetworkSettings;
}

export interface SystemEntryProps {
  readonly context: SystemContext;
}

/** Un sistema montable: el anfitrión monta cada raíz de ruta con `/*` y entrega el resto a `Entry`. */
export interface SystemModule extends SystemDescriptor {
  /** Primer segmento de cada dirección del sistema, sin barras (`'solicitudes'`). Las URLs no cambian. */
  readonly routeRoots: readonly string[];
  /** Punto de entrada, cargado con `React.lazy(import())`: es lo que se convertirá en el remote. */
  readonly Entry: ComponentType<SystemEntryProps>;
}

/** Perfiles de la sesión en el sistema cuyo rol el sistema reconoce. */
// Un perfil sin sede de un sistema que no admite todas las sedes se concede igual: `systemAccess` lo bloquea con
// su motivo propio («sin sede», escenario 4 de la US-SIL-004) en vez de confundirlo con la falta de rol.
export function grantedProfiles(session: SuiteSession, system: SystemDescriptor): SuiteProfile[] {
  return profilesOf(session, system.code).filter((profile) => system.roleLabel(profile.role) !== null);
}

/** Perfil vigente del sistema: el elegido en la sesión o, a falta de él, el primero concedido. */
export function currentGrantedProfile(session: SuiteSession, system: SystemDescriptor): SuiteProfile | null {
  const profiles = grantedProfiles(session, system);
  const id = session.currentProfileBySystem[system.code];
  return profiles.find((profile) => profile.profileId === id) ?? profiles[0] ?? null;
}

/**
 * Resultado de pedir el ingreso a un sistema (US-SIL-004). Cada bloqueo lleva su motivo para que la pantalla
 * muestre el mensaje exacto de la historia; solo `granted` monta el sistema.
 */
export type SystemAccess =
  | { readonly type: 'granted'; readonly profile: GrantedProfile }
  /** Sin perfil del sistema, o con un rol que el sistema no reconoce (escenario 3). */
  | { readonly type: 'no-role' }
  /** Con rol del sistema pero sin sede registrada en UMS (escenario 4). */
  | { readonly type: 'no-site' };

/**
 * Decide el ingreso con el perfil vigente del sistema. El rol se comprueba antes que la sede, en el orden del
 * diagrama de la US-SIL-004. Es comodidad de interfaz: el servidor vuelve a autorizar cada petición (P-SEC-01).
 */
export function systemAccess(session: SuiteSession, system: SystemDescriptor): SystemAccess {
  const profile = currentGrantedProfile(session, system);
  if (profile === null) return { type: 'no-role' };
  const { site } = profile;
  if (site === null) return { type: 'no-site' };
  return { type: 'granted', profile: { ...profile, site } };
}

/** Rol visible: el que da el sistema si lo conoce; si no, el texto tal cual (sistemas sin descriptor). */
export function roleText(profile: SuiteProfile, systems: readonly SystemDescriptor[]): string {
  const system = systems.find((candidate) => candidate.code === profile.system);
  return system?.roleLabel(profile.role) ?? system?.otherRoleLabel?.(profile.role) ?? profile.role;
}

/** Cómo se nombra la ausencia de sede: un perfil de todas las sedes, o la sede de trabajo sin elegir (D-030). */
export const ALL_SITES = 'Todas las sedes';

/** «Callao», o «Todas las sedes» si no hay sede. */
export function siteText(site: Site | null): string {
  return site ?? ALL_SITES;
}

/**
 * La sede de un perfil como se muestra. Sin sede, depende del sistema: el que se monta y no admite todas las sedes
 * (SIL, MDM) dice «sin sede» (US-SIL-004 escenario 4); los demás, «Todas las sedes» (`OrgWide` de UMS, D-030).
 */
export function profileSiteText(profile: SuiteProfile, systems: readonly SystemDescriptor[]): string {
  if (profile.site !== null) return profile.site;
  const system = systems.find((candidate) => candidate.code === profile.system);
  return system !== undefined && system.acceptsAllSites !== true ? 'sin sede' : ALL_SITES;
}

/** «{Rol} · {Sede}». */
export function profileLabel(profile: SuiteProfile, systems: readonly SystemDescriptor[]): string {
  return `${roleText(profile, systems)} · ${profileSiteText(profile, systems)}`;
}

/** Línea de apoyo de una tarjeta del lanzador: «Negocio · Piura»; con roles distintos, separados por «; ». */
export function profilesSummary(profiles: readonly SuiteProfile[], systems: readonly SystemDescriptor[]): string {
  const sitesByRole = new Map<string, string[]>();
  for (const profile of profiles) {
    const role = roleText(profile, systems);
    sitesByRole.set(role, [...(sitesByRole.get(role) ?? []), profileSiteText(profile, systems)]);
  }
  return [...sitesByRole].map(([role, sites]) => `${role} · ${sites.join(', ')}`).join('; ');
}
