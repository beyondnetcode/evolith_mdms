import { safeReturnPath } from '@suite/contracts';
import { Navigate, Outlet, useLocation } from 'react-router';
import { SuiteHeaderProvider } from '../header/SuiteHeaderProvider.tsx';
import { SuiteFrame } from '../layout/SuiteFrame.tsx';
import { SessionExpiredDialog } from '../session/SessionExpiredDialog.tsx';
import { useSuite } from '../session/SuiteContext.tsx';

/**
 * Guarda de toda dirección menos S-01 (anexo A1 §1): sin sesión vigente se va a S-01 conservando la
 * dirección pedida en `volver`, solo si es una ruta relativa válida (SU-35). Es comodidad: el
 * servidor real vuelve a autorizar cada petición (P-SEC-01). Con sesión, monta la cabecera común
 * (notificaciones y cuenta) para la suite y para los sistemas montados.
 */
export function RequireSession() {
  const { session } = useSuite();
  const location = useLocation();
  if (session === null) {
    const back = safeReturnPath(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate to={back === null || back === '/' ? '/acceso' : `/acceso?volver=${encodeURIComponent(back)}`} replace />;
  }
  return (
    <SuiteHeaderProvider>
      <Outlet />
      <SessionExpiredDialog />
    </SuiteHeaderProvider>
  );
}

/** Cabecera de la suite con cuenta y el contenido de S-02 debajo. */
export function SuiteLayout() {
  return (
    <SuiteFrame withAccount>
      <Outlet />
    </SuiteFrame>
  );
}
