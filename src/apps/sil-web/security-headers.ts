/**
 * Cabeceras de seguridad que exige ADR-0165 §2.2 en la respuesta que sirve la aplicación. Hoy las aplica
 * `vite preview` (para probar el build bajo la política real); el servidor que sirva la SPA en producción
 * está sin decidir (G-150) y debe emitir las mismas, más `Strict-Transport-Security`, que solo tiene
 * sentido tras TLS y por eso no va aquí.
 *
 * La CSP no lleva `unsafe-inline` ni `unsafe-eval`: todo script y toda hoja vienen del propio origen
 * (el build no incrusta nada), las fuentes se autoalojan (ADR-0165 §2.8) y los estilos que React fija por
 * `style` se aplican por CSSOM, que `style-src 'self'` permite. Sin nonce ni hash: no hay nada inline que
 * firmar. Si algún día se incrusta un script, deberá entrar con hash o nonce, no relajando esta política.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};
