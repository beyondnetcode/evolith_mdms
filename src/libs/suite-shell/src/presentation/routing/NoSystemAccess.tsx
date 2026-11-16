import { NoAccessPage, buttonStyles, useDocumentTitle } from '@sil/ui';
import { Link } from 'react-router';
import { SUITE_TITLE } from '../suite-title.ts';
import { noSystemAccessTexts, type NoAccessReason } from '../suite-texts.ts';
import { useFocusOnTitle } from '../use-focus-on-title.ts';

/**
 * Dirección de un sistema sin acceso: página completa bajo la cabecera de la suite; el sistema no se monta ni
 * revela si existe (anexo A1 §5, P-SEC-01). Sin rol del sistema o sin sede en UMS, el mensaje exacto de la
 * US-SIL-004.
 */
export function NoSystemAccess({ systemCode, reason }: { readonly systemCode: string; readonly reason: NoAccessReason }) {
  const texts = noSystemAccessTexts(systemCode);
  useDocumentTitle(texts.title, SUITE_TITLE);
  const title = useFocusOnTitle();
  return (
    <NoAccessPage
      headingId={`sin-acceso-${systemCode.toLowerCase()}`}
      headingRef={title}
      title={texts.title}
      message={texts.body[reason]}
      announce
      className="mx-auto px-4 medium:px-6"
      action={
        <Link to="/" className={buttonStyles('filled')}>
          Volver al portal
        </Link>
      }
    />
  );
}
