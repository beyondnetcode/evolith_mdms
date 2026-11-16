# suite-header (`@suite/header`) — cabecera común de la suite

> **Estado:** provisional | **Fase:** 3 — Construcción (prototipo del primer corte)

Paquete de la cabecera común que comparten la suite y los sistemas que monta, como prevé ADR-0245 ([G-124](../../../GAPS.md)). Tag Nx `scope:suite-api`: lo pueden importar la suite, SIL y MDM; él solo depende de `@suite/contracts` y de las librerías compartidas ([D-026](../../../DECISIONS.md)).

| Pieza | Qué es |
| :--- | :--- |
| `BrandLink`, `SuiteLogo` | Marca de la barra (anexo A1 §11.6, M-05) |
| `NotificationsButton` y su hoja, lista y elemento | Campana y notificaciones (anexo A1 §10) |
| `AccountMenu`, `HelpButton` | Cuenta, «Tema» y «Cerrar sesión»; «Ayuda» (anexo A1 §3) |
| `SitePickerDialog` | S-03, genérico por sistema (anexo A1 §4) |
| `SuiteHeaderContext` | **Interfaz** que el anfitrión implementa: persona, cerrar sesión y notificaciones |
| `HeaderThemeContext` | Esquema efectivo y control «Tema» que aporta el anfitrión |
| `SystemFrame`, `SystemNavigation` | Marco común de un sistema (ADR-0245 D4.1): cabecera, riel (`medium` contraído, 224 dp desde `expanded`), cajón en `compact` y FAB de la acción principal. SIL y MDM le pasan sus destinos (`NavDestination`) y su acción (`PrimaryAction`) |
| `SystemFrameContext` | Hueco de la barra de `compact` para la cabecera de la pantalla y apertura del cajón |
| `LeaveGuardContext` | Contrato de salida protegida: lo registra quien tiene cambios sin guardar (SIL) y lo consume la cabecera |

La cabecera no conoce la sesión ni el gateway de la suite: los recibe por contexto. Por eso el mismo paquete servirá cuando SIL sea un remote de Module Federation ([G-241](../../../GAPS.md)).
