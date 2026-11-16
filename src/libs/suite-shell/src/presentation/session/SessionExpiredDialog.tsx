import { safeReturnPath } from '@suite/contracts';
import { Button, ModalDialog } from '@sil/ui';
import { useLocation, useNavigate } from 'react-router';
import { useSuite } from './SuiteContext.tsx';
import { SUITE_TEXTS } from '../suite-texts.ts';

/**
 * Diálogo «Tu sesión terminó» (anexo A1 §2): modal, un solo botón; `Escape` no lo descarta: hace lo mismo que el botón (ADR-0110 P-UX-08). No vacía
 * lo que hay detrás: lo no guardado se conserva en la página (SU-16). La acción lleva a S-01 con
 * `motivo=expirada` y `volver` con la dirección en curso.
 */
export function SessionExpiredDialog() {
  const { expired } = useSuite();
  const location = useLocation();
  const navigate = useNavigate();

  function signIn(): void {
    const back = safeReturnPath(`${location.pathname}${location.search}${location.hash}`);
    const destination = back === null || back === '/' ? '/acceso?motivo=expirada' : `/acceso?motivo=expirada&volver=${encodeURIComponent(back)}`;
    // S-01 vacía la sesión: ver `SignInPage`.
    void navigate(destination, { replace: true, state: { exit: 'expired' } });
  }

  return (
    <ModalDialog
      open={expired}
      closable={false}
      onEscape={signIn}
      onClose={() => undefined}
      title={SUITE_TEXTS.expired.title}
      actions={
        <Button data-autofocus="" onClick={signIn}>
          Iniciar sesión
        </Button>
      }
    >
      <p className="text-body-medium">{SUITE_TEXTS.expired.body}</p>
    </ModalDialog>
  );
}
