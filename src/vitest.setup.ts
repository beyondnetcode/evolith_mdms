import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Bajo la puerta en paralelo (lint, build y pruebas a la vez) un `findBy` de 1 s no alcanza a ver el
// resultado de una acción del formulario: se espera hasta 5 s.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
});
