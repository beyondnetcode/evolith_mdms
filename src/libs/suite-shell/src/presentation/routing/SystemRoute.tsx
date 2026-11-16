import { systemAccess, type SystemContext, type SystemModule } from '@suite/contracts';
import { useMemo } from 'react';
import { SuiteFrame } from '../layout/SuiteFrame.tsx';
import { useSuite, useSuiteSession } from '../session/SuiteContext.tsx';
import { NoSystemAccess } from './NoSystemAccess.tsx';

/**
 * Guarda genérica de un sistema montado (D-026): sin un perfil del sistema con un rol que el sistema reconozca y
 * una sede registrada en UMS no se monta nada (US-SIL-004 escenarios 3 y 4); con él, el sistema recibe su
 * `SystemContext` y gestiona el resto de la dirección. Cambiar de perfil (sede) cambia el contexto: el sistema
 * decide volver a montarse por perfil (ADR-0156 §2.6).
 */
export function SystemRoute({ module }: { readonly module: SystemModule }) {
  const session = useSuiteSession();
  const { settings, chooseProfile } = useSuite();
  const access = systemAccess(session, module);
  const currentProfile = access.type === 'granted' ? access.profile : null;
  const context = useMemo<SystemContext | null>(
    () =>
      currentProfile === null
        ? null
        : { session, currentProfile, selectProfile: (profileId) => chooseProfile(module.code, profileId), networkSettings: settings },
    [session, currentProfile, chooseProfile, module.code, settings],
  );
  if (context === null) {
    return (
      <SuiteFrame withAccount>
        <NoSystemAccess systemCode={module.code} reason={access.type === 'no-site' ? 'no-site' : 'no-role'} />
      </SuiteFrame>
    );
  }
  const { Entry } = module;
  return <Entry context={context} />;
}
