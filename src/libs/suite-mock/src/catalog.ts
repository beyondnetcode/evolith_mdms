import type { CatalogSystem } from '@suite/contracts';

/** Dirección de entrada de MDM: P-MDM-01 «Organizaciones». */
export const MDM_PATH = '/mdm/organizaciones';

/**
 * Sistemas lanzables del mock. MDM es el único sistema de este repositorio.
 * El resto se declara fuera del alcance y sin enlace.
 */
export function mockCatalog(maintenance: boolean): readonly CatalogSystem[] {
  return [
    { code: 'CMS', name: 'Sistema de Gestión Comercial', availability: 'FUERA_DE_ALCANCE' },
    { code: 'CNS', name: 'Sistema de Contenedores', availability: 'FUERA_DE_ALCANCE' },
    { code: 'DT', name: 'Sistema de Depósito Temporal', availability: 'FUERA_DE_ALCANCE' },
    maintenance
      ? { code: 'MDM', name: 'Sistema de Datos Maestros', availability: 'EN_MANTENIMIENTO' }
      : { code: 'MDM', name: 'Sistema de Datos Maestros', availability: 'DISPONIBLE', path: MDM_PATH },
    { code: 'UMS', name: 'Sistema de Usuarios', availability: 'FUERA_DE_ALCANCE' },
    { code: 'YMS', name: 'Sistema de Patios', availability: 'FUERA_DE_ALCANCE' },
  ];
}
