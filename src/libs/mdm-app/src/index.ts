// API pública de MDM: solo el módulo montable. Nada más se importa de forma estática, para que la entrada
// quede en su propio chunk (D-026, D-044).
export { mdmModule } from './mdm-module.ts';
