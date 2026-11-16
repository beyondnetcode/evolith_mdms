/*
 * Costuras de prueba de MDM para el arnés de composición del anfitrión: el almacén y el gateway del mock. No se
 * importan en producción.
 */
export { MdmTestDataContext, type MdmTestData } from '../infrastructure/MockMdmGatewayProvider.tsx';
export { renderMdm, mdmTestSession, type MdmRenderOptions } from './mdm-harness.tsx';
export { installDialogPolyfill } from './dialog-polyfill.ts';
export { overrideGateway } from './override-gateway.ts';
