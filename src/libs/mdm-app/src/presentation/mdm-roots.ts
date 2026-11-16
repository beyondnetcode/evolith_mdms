/** Raíz de dirección de MDM (D-026, SU-MDM-13): el anfitrión la monta con `/*`. Son URLs y van en español. */
export const MDM_ROOT = 'mdm';

export const MDM_ROUTE_ROOTS: readonly string[] = [MDM_ROOT];

export const ORGANIZATIONS_PATH = `/${MDM_ROOT}/organizaciones`;
export const NEW_ORGANIZATION_PATH = `${ORGANIZATIONS_PATH}/nueva`;

/** P-MDM-04 «Tipos de rol» (D-046). */
export const ROLE_TYPES_PATH = `/${MDM_ROOT}/tipos-de-rol`;

/** Explorador del catálogo geográfico (API-MDM-003). */
export const GEOGRAPHY_PATH = `/${MDM_ROOT}/geografia`;

export function placePath(placeId: string): string {
  return `${GEOGRAPHY_PATH}/lugares/${encodeURIComponent(placeId)}`;
}

export function countryPath(countryCode: string): string {
  return `${GEOGRAPHY_PATH}/paises/${encodeURIComponent(countryCode)}`;
}

export function organizationPath(partyId: string): string {
  return `${ORGANIZATIONS_PATH}/${encodeURIComponent(partyId)}`;
}

/** Sufijo del título del documento de cada pantalla de MDM (WCAG 2.4.2). */
export const MDM_TITLE_SUFFIX = 'MDM · Suite';
