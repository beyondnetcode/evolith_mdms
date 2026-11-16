import { useDocumentTitle } from '@sil/ui';
import { MDM_TITLE_SUFFIX, ORGANIZATIONS_PATH } from '../mdm-roots.ts';
import { BackLink } from './BackLink.tsx';

/** `common.not_found` y direcciones desconocidas dentro de MDM (UX-MDM-001 §6.1). */
export function NotFound({ message }: { readonly message: string }) {
  useDocumentTitle('Página no encontrada', MDM_TITLE_SUFFIX);
  return (
    <div className="flex flex-col gap-4 py-4">
      <BackLink to={ORGANIZATIONS_PATH}>Volver a Organizaciones</BackLink>
      <h1 className="text-headline-small">Página no encontrada</h1>
      <p className="max-w-prose text-body-large text-on-surface-variant">{message}</p>
    </div>
  );
}
