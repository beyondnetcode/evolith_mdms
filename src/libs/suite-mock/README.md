# suite-mock (`@suite/mock`) — datos de ejemplo de la suite

> **Estado:** provisional | **Fase:** 3 — Construcción (prototipo del primer corte)

Implementa `SuiteGateway` (de `@suite/contracts`) en memoria y sobre `sessionStorage`/`localStorage`. **No es un contrato ni un artefacto de diseño**: se separó de [`sil-mock`](../sil-mock/README.md) para que el portal real de la suite lo sustituya sin tocar el mock de SIL ([D-025](../../../DECISIONS.md)). Los supuestos SU-MOCK-23 a SU-MOCK-32 conservan su numeración.

## Inicio de sesión, lanzador y sesión

Implementa `SuiteGateway` (de `@suite/contracts`) según el [anexo A1 de UX-SIL-001](../../../docs/02-diseno/especificacion-ux-suite-acceso-sil-001.es.md) §7: usuarios de prueba ficticios (`test-users.ts`), catálogo del lanzador (`catalog.ts`), la sesión en `sessionStorage` validada al leerse (`mock-suite-gateway.ts`) y el ayudante de pruebas `createTestSession` (`test-session.ts`), que construye una sesión sin pasar por S-01. **La clave de prueba vive solo en `test-users.ts`**: no está en ningún documento y se elimina con el mock. Desaparece al sustituirlo el portal real ([G-124](../../../GAPS.md), [G-176](../../../GAPS.md)).

| ID | Supuesto |
| :--- | :--- |
| SU-MOCK-23 | Las cuentas de prueba y sus concesiones son las del anexo §7.2; `cuenta.bloqueada` está bloqueada de origen y un usuario con 5 fallos consecutivos queda bloqueado hasta cerrar la pestaña. Los intentos con usuarios inexistentes no cuentan, para no revelar qué cuentas existen ([G-175](../../../GAPS.md)) |
| SU-MOCK-24 | La sesión dura 8 h y vence a los 30 min sin actividad; con `?sim=expira`, a los 20 s de emitida, también si ya estaba abierta ([G-178](../../../GAPS.md)) |
| SU-MOCK-25 | Solo SIL es `DISPONIBLE` (con `?sim=mantenimiento`, `EN_MANTENIMIENTO`); los demás sistemas concedidos se declaran `FUERA_DE_ALCANCE` y sin ruta ([G-174](../../../GAPS.md)) |
| SU-MOCK-26 | El lanzador ordena las tarjetas por nombre canónico, no por sigla ni por disponibilidad |

## Notificaciones

En `notifications.ts` y en `mock-suite-gateway.ts`. Implementa `listNotifications`, `countUnread`, `markRead` y `markAllRead` de `SuiteGateway` según el [anexo A1 §10.7](../../../docs/02-diseno/especificacion-ux-suite-acceso-sil-001.es.md#107-contrato-mock-de-notificaciones). Los tipos, el texto exacto y la visibilidad por rol están en `@suite/contracts` (`notifications.ts`).

| ID | Supuesto |
| :--- | :--- |
| SU-MOCK-27 | Las notificaciones son una **semilla determinista por perfil de SIL** (`ana.perez:SIL:CALLAO`, etc.) relativa al reloj: no se persiste. Los `operationId`, los contenedores y los códigos de correlación salen de los escenarios de SIL (p. ej. la entrega fallida de `OP-CAL-26-000399` lleva el código que muestra P-06). Una sesión sintética de pruebas no tiene notificaciones ([G-191](../../../GAPS.md)) |
| SU-MOCK-28 | Las acciones de P-04, P-05 y P-06 **no generan** notificaciones: el anexo las trata como acción propia (snackbar y aviso en línea) y el origen real no existe ([G-186](../../../GAPS.md), [G-191](../../../GAPS.md)) |
| SU-MOCK-29 | El estado de lectura es **por usuario** y vive en `localStorage` (`organizacion.notificaciones.{usuario}`), validado al leerlo; un estado corrupto devuelve todo a «no leída». Las leídas de origen de la semilla son las que el anexo marca como tales |
| SU-MOCK-30 | El servicio entrega todos los tipos y el gateway filtra por el rol del perfil vigente de SIL; un rol desconocido no ve nada. La ventana es de 90 días y la página por defecto, de 20 |
| SU-MOCK-31 | Las horas de «hoy» no pueden ser futuras: si la más tardía (10:42) aún no llegó, las de hoy se corren hacia atrás lo mismo |
| SU-MOCK-32 | `?sim=notif-nueva`: a los 15 s de crear el gateway llega una entrega fallida (un crédito en Rojo si el rol no la ve), solo en la sede Callao; el sondeo de la insignia baja a 5 s para poder verlo |

Simulaciones: `?sim=notif-vacio`, `notif-error`, `notif-error-marcar`, `notif-nueva` y `notif-reiniciar` (borra el estado de lectura del usuario).
