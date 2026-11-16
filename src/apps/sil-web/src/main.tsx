import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import './styles.css';

const root = document.getElementById('raiz');
if (root === null) throw new Error('Falta el elemento #raiz en index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
