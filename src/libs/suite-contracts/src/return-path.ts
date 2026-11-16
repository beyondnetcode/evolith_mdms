const FICTITIOUS_SOURCE = 'http://suite.invalido';
/** No se vuelve a la pantalla de acceso: sería un bucle. */
const SIGN_IN_SCREEN = '/acceso';

// eslint-disable-next-line no-control-regex -- justificación: los caracteres de control son justo lo que se rechaza.
const FORBIDDEN_CHARACTERS = /[\u0000-\u001f\u007f\\]/;

function isSimpleRelativePath(value: string): boolean {
  if (value.length === 0 || value.length > 2000) return false;
  // Una sola `/` inicial: `//host` y `/\host` son direcciones de otro origen para el navegador.
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  return !FORBIDDEN_CHARACTERS.test(value);
}

/**
 * `volver` solo acepta una ruta relativa que empiece por una sola `/` (SU-35, SU-36): sin
 * redirector abierto (ADR-0165 P-SEC-01). Se rechaza `//host`, `/\host`, esquemas, saltos de línea
 * y cualquier carácter de control; el resto se descarta y se usa el inicio de la suite.
 */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (value === null || value === undefined || !isSimpleRelativePath(value)) return null;
  let destination: URL;
  try {
    destination = new URL(value, FICTITIOUS_SOURCE);
  } catch {
    return null;
  }
  if (destination.origin !== FICTITIOUS_SOURCE || destination.pathname === SIGN_IN_SCREEN) return null;
  return `${destination.pathname}${destination.search}${destination.hash}`;
}
