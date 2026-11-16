import type { NetworkSettings, SystemDescriptor } from '@suite/contracts';
import type { SessionStorageAdapter } from '@suite/mock';
import { SnackbarProvider } from '@sil/ui';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { SuiteServicesContext, type SuiteServices } from './application/suite-services.ts';
import type { ThemeStore } from './application/theme-preferences.ts';
import { browserThemeStore } from './infrastructure/browser-theme-store.ts';
import { createSuiteGateway, type SuiteGatewayOptions } from './infrastructure/mock-suite-gateway.ts';
import { createQueryClient } from './infrastructure/query-client.ts';
import { testPassword, VISIBLE_TEST_USERS } from './infrastructure/test-users.ts';
import { SuiteProvider } from './presentation/session/SuiteContext.tsx';
import { SystemsContext } from './presentation/systems/SystemsContext.tsx';
import { ThemeProvider } from './presentation/theme/ThemeContext.tsx';

/** Costuras de prueba: sustituyen la infraestructura sin tocar la presentación. */
export interface SuiteTestingOptions extends SuiteGatewayOptions {
  readonly storage?: SessionStorageAdapter;
  readonly themeStore?: ThemeStore;
  readonly queryClient?: QueryClient;
}

interface Props {
  readonly settings: NetworkSettings;
  /** Los sistemas que el anfitrión registra: la suite solo usa su descriptor. */
  readonly systems: readonly SystemDescriptor[];
  readonly testing?: SuiteTestingOptions;
  readonly children: ReactNode;
}

/**
 * Raíz de composición de la suite (D-026): cablea la infraestructura (gateway mock, almacén del tema, usuarios
 * de prueba) con la presentación y monta los proveedores globales: sesión, tema (por usuario de la sesión),
 * estado de servidor de la suite y avisos. Los de cada sistema los monta su propia entrada.
 */
export function SuiteProviders({ settings, systems, testing, children }: Props) {
  const [gateway] = useState(() => createSuiteGateway(settings, testing));
  const [services] = useState<SuiteServices>(() => ({
    themeStore: testing?.themeStore ?? browserThemeStore(),
    testUsers: VISIBLE_TEST_USERS,
    testPassword,
  }));
  const [queryClient] = useState(() => testing?.queryClient ?? createQueryClient());
  return (
    <SuiteServicesContext value={services}>
      <SystemsContext value={systems}>
        <SuiteProvider gateway={gateway} settings={settings}>
          <ThemeProvider>
            <QueryClientProvider client={queryClient}>
              <SnackbarProvider>{children}</SnackbarProvider>
            </QueryClientProvider>
          </ThemeProvider>
        </SuiteProvider>
      </SystemsContext>
    </SuiteServicesContext>
  );
}
