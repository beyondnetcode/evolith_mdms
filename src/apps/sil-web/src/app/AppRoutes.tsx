import { NotFoundPage, NotificationsPage, RequireSession, SignInPage, SuiteHomePage, SuiteLayout, SystemRoute } from '@suite/shell';
import { Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { SYSTEM_REGISTRY } from '../system-registry.ts';

function Loading() {
  return (
    <p role="status" className="py-8 text-body-large text-on-surface-variant">
      Cargando pantalla…
    </p>
  );
}

/**
 * Rutas del anfitrión (D-026). La suite (mock, anexo A1 de UX-SIL-001): `/acceso` es S-01, `/` es S-02 y
 * `/notificaciones` la pantalla completa. Cada sistema registrado se monta en sus raíces con `/*` detrás de la
 * guarda de sesión y de la guarda genérica de sistema; el resto de la dirección es del sistema. Lo que no es
 * de la suite ni de ningún sistema es el 404 de la suite. Las URLs no cambian.
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="acceso" element={<SignInPage />} />
        <Route element={<RequireSession />}>
          <Route element={<SuiteLayout />}>
            <Route index element={<SuiteHomePage />} />
          </Route>
          <Route path="notificaciones" element={<NotificationsPage />} />
          {SYSTEM_REGISTRY.flatMap((module) =>
            module.routeRoots.map((root) => <Route key={`${module.code}-${root}`} path={`${root}/*`} element={<SystemRoute module={module} />} />),
          )}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
