import { isMdmRole } from '@mdm/contracts';
import type { NetworkSettings, SystemEntryProps } from '@suite/contracts';
import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useMemo, useState, type ReactNode } from 'react';
import { MdmSessionContext, createMdmSession } from './application/session-context.ts';
import { MockMdmGatewayProvider } from './infrastructure/MockMdmGatewayProvider.tsx';
import { createMdmQueryClient } from './infrastructure/query-client.ts';
import { MdmRoutes } from './presentation/MdmRoutes.tsx';
import { MdmShell } from './presentation/shell/MdmShell.tsx';
// Tokens de componente locales (anchos de panel, SU-UI-MDM-01): viajan con la entrada perezosa de MDM.
import './mdm-tokens.css';

function Loading() {
  return (
    <p role="status" className="py-8 text-body-large text-on-surface-variant">
      Cargando pantalla…
    </p>
  );
}

/**
 * Entrada de MDM y raíz de composición (D-026, D-044): recibe el `SystemContext` del anfitrión, cablea la
 * infraestructura (gateway mock validado en la frontera y caché de servidor propia) y monta el marco y las rutas.
 * Se carga con `React.lazy(import())`: es el punto que se convertirá en el remote de Module Federation.
 */
export default function MdmEntry({ context }: SystemEntryProps) {
  const role = context.currentProfile.role;
  const displayName = context.session.user.fullName;
  const session = useMemo(() => (isMdmRole(role) ? createMdmSession(role, displayName) : null), [role, displayName]);
  // La guarda del anfitrión ya descartó los perfiles con un rol que MDM no conoce: aquí no hay nada que montar.
  if (session === null) return null;
  return (
    <MdmSessionContext value={session}>
      {/* El `key` por perfil reinicia la caché de servidor al cambiar de perfil (ADR-0156 §2.6). */}
      <MdmProviders key={context.currentProfile.profileId} settings={context.networkSettings} actor={context.session.user.id}>
        <MdmShell site={context.currentProfile.site}>
          <Suspense fallback={<Loading />}>
            <MdmRoutes />
          </Suspense>
        </MdmShell>
      </MdmProviders>
    </MdmSessionContext>
  );
}

function MdmProviders({ settings, actor, children }: { readonly settings: NetworkSettings; readonly actor: string; readonly children: ReactNode }) {
  const [queryClient] = useState(createMdmQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <MockMdmGatewayProvider settings={settings} actor={actor}>
        {children}
      </MockMdmGatewayProvider>
    </QueryClientProvider>
  );
}
