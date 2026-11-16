/**
 * Catálogo de sistemas del lanzador de la suite (anexo A1 de UX-SIL-001, §7.3). Las siglas y los
 * nombres canónicos salen del Catálogo de Sistemas de la Suite; qué sistema es lanzable y su
 * disponibilidad son supuestos del mock (SU-31, SU-32, G-174).
 */
export const SYSTEM_CODES = ['CMS', 'CNS', 'DT', 'MDM', 'SIL', 'UMS', 'YMS'] as const;
export type SystemCode = (typeof SYSTEM_CODES)[number];

export function isSystemCode(value: unknown): value is SystemCode {
  return typeof value === 'string' && (SYSTEM_CODES as readonly string[]).includes(value);
}

export const SITES = ['Callao', 'Piura'] as const;
export type Site = (typeof SITES)[number];

export function isSite(value: unknown): value is Site {
  return typeof value === 'string' && (SITES as readonly string[]).includes(value);
}

export const AVAILABILITIES = ['DISPONIBLE', 'EN_MANTENIMIENTO', 'FUERA_DE_ALCANCE'] as const;
export type Availability = (typeof AVAILABILITIES)[number];

/** Una entrada del catálogo. `ruta` solo existe donde hay enlace: lo no disponible no lleva dirección. */
export interface CatalogSystem {
  readonly code: SystemCode;
  readonly name: string;
  readonly availability: Availability;
  readonly path?: string;
}
