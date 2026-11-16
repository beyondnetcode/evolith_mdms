import { readNetworkSettings } from '@suite/contracts';
import { SuiteProviders } from '@suite/shell';
import { useState } from 'react';
import { BrowserRouter } from 'react-router';
import { SYSTEM_REGISTRY } from '../system-registry.ts';
import { AppRoutes } from './AppRoutes.tsx';

/**
 * Anfitrión de composición (D-026): lee los ajustes de red una sola vez, monta los proveedores globales de la
 * suite con los sistemas registrados y el enrutador. Los proveedores de cada sistema los monta su entrada.
 */
export function App() {
  const [settings] = useState(() => readNetworkSettings(window.location.search));
  return (
    <SuiteProviders settings={settings} systems={SYSTEM_REGISTRY}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SuiteProviders>
  );
}
