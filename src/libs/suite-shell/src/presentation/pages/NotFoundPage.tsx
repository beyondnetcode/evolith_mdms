import { buttonStyles, useDocumentTitle } from '@sil/ui';
import { Link } from 'react-router';
import { SuiteFrame } from '../layout/SuiteFrame.tsx';
import { SUITE_TITLE } from '../suite-title.ts';
import { NOT_FOUND_TEXTS } from '../suite-texts.ts';
import { useFocusOnTitle } from '../use-focus-on-title.ts';

/** 404 de la suite: una dirección que no es de la suite ni de ningún sistema montado. */
export function NotFoundPage() {
  useDocumentTitle(NOT_FOUND_TEXTS.title, SUITE_TITLE);
  const title = useFocusOnTitle();
  return (
    <SuiteFrame withAccount>
      <section aria-labelledby="no-encontrada" className="mx-auto flex w-full max-w-xl flex-col items-start gap-4 px-4 py-8 medium:px-6">
        <h1 ref={title} tabIndex={-1} id="no-encontrada" className="text-headline-small outline-none">
          {NOT_FOUND_TEXTS.title}
        </h1>
        <p className="text-body-large">{NOT_FOUND_TEXTS.body}</p>
        <Link to="/" className={buttonStyles('filled')}>
          Volver al portal
        </Link>
      </section>
    </SuiteFrame>
  );
}
