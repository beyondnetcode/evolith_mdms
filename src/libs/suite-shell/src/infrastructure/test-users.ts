import { TEST_PASSWORD, TEST_USERS } from '@suite/mock';
import type { VisibleTestUser } from '../application/suite-services.ts';

/*
 * Usuarios de prueba de S-01 y su clave, ÚNICAMENTE para el botón «Usar» (anexo A1 §2). La clave
 * nunca se muestra ni se registra. Al sustituir el mock por el portal real este archivo se elimina.
 */
export const VISIBLE_TEST_USERS: readonly VisibleTestUser[] = TEST_USERS.map((u) => ({
  id: u.id,
  name: u.fullName,
  description: u.description,
  tenant: u.tenant,
}));

export function testPassword(): string {
  return TEST_PASSWORD;
}
