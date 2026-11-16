import type { PlaceStatus, TradeFunction, UneceStatus } from './geography.ts';

/**
 * Reglas de la geografía que el contrato publica (API-MDM-003 §2, §3.6 y §5) y que la interfaz anticipa. El
 * servidor sigue siendo quien decide; aquí solo se evita enviar lo que se sabe inválido.
 */

/** Código oficial normalizado: recorte, mayúsculas invariantes y sin espacios internos (`pe cll` → `PECLL`). */
export function normalizeGeoCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Nombre normalizado para buscar: recorte, espacios colapsados, mayúsculas y sin diacríticos (NFD y descarte de
 * marcas): `Áncash` → `ANCASH`, `Ñuñoa` → `NUNOA`. El nombre oficial se guarda y se muestra tal cual (RNF-GEO-03).
 */
export function normalizePlaceName(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Longitudes del contrato. */
export const PLACE_NAME_MAX = 200;
export const GEO_REASON_MAX = 500;
export const SEARCH_NAME_MIN = 2;
export const SEARCH_NAME_MAX = 100;
export const MAX_LADDER_LEVELS = 6;

/** Estados UNECE utilizables en documentos. SUPUESTO hasta confirmarlo con operaciones y aduanas (G-628). */
export const USABLE_UNECE_STATUSES: readonly UneceStatus[] = ['AM', 'RL', 'AA', 'AC', 'AF', 'AI', 'AS', 'AQ'];

/** Funciones que no hacen utilizable un lugar en documentos (RN-GEO-08). */
const USABLE_FUNCTION_EXCLUSIONS: readonly TradeFunction[] = ['BORDER_CROSSING', 'NOT_OFFICIAL'];

/** `BORDER_CROSSING` solo llega por importación: no se asigna a mano (`geo.trade_location.function_deprecated`). */
export const ASSIGNABLE_TRADE_FUNCTIONS: readonly TradeFunction[] = [
  'SEAPORT',
  'RAIL',
  'ROAD',
  'AIRPORT',
  'POSTAL',
  'MULTIMODAL',
  'FIXED_TRANSPORT',
  'INLAND_WATERWAY',
  'SPECIAL_ECONOMIC_ZONE',
  'NOT_OFFICIAL',
];

/**
 * «Válido para documentos» (§3.6, RN-GEO-08): `Active`, estado UNECE utilizable y alguna función distinta de paso de
 * frontera y de no oficial. Lo deriva el servidor; la interfaz lo usa solo para explicar.
 */
export function isUsableInTradeDocuments(status: PlaceStatus, uneceStatus: UneceStatus | null, functions: readonly TradeFunction[]): boolean {
  if (status !== 'Active' || uneceStatus === null || !USABLE_UNECE_STATUSES.includes(uneceStatus)) return false;
  return functions.some((item) => !USABLE_FUNCTION_EXCLUSIONS.includes(item));
}
