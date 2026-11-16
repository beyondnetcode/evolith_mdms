import { BRAND_TEXTS } from '@suite/header';

/**
 * Pie institucional de S-01 y S-02 (anexo A1 §11.6, M-08): la firma de Organización S.A. centrada al pie del
 * contenido, `body-small` en `on-surface-variant` (≥ 4,5:1 en ambos temas). En `compact` va en dos líneas;
 * el texto es el mismo, literal, en todos los tamaños. No va en el shell de SIL, que ya es denso.
 */
export function InstitutionalFooter() {
  return (
    <footer className="mt-auto pt-8 text-center text-body-small text-on-surface-variant">
      <p>
        {BRAND_TEXTS.signature.rights}
        <span className="hidden medium:inline">{' · '}</span>
        <br className="medium:hidden" />
        {BRAND_TEXTS.signature.motto}
      </p>
    </footer>
  );
}
