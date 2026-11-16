# suite-shell (`@suite/shell`) — la suite (SCM) del prototipo

> **Estado:** provisional | **Fase:** 3 — Construcción (prototipo del primer corte)

Inicio de sesión (S-01), lanzador (S-02), notificaciones a pantalla completa, tema, marca, guardas y 404 de la suite, según el [anexo A1 de UX-SIL-001](../../../docs/02-diseno/especificacion-ux-suite-acceso-sil-001.es.md). Tag Nx `scope:suite`: nunca importa `scope:sil` ([D-026](../../../DECISIONS.md)); conoce los sistemas solo por su `SystemDescriptor` y los monta con la guarda genérica `SystemRoute`.

Capas (Clean Architecture, [D-025](../../../DECISIONS.md)):

| Carpeta | Contenido |
| :--- | :--- |
| `domain/` | Preferencia de tema: valores, validación y esquema efectivo (TypeScript puro) |
| `application/` | Puertos (`ThemeStore`, `SuiteServices`), consultas del lanzador y sondeo de notificaciones |
| `infrastructure/` | Gateway mock de la suite, almacén del tema en `localStorage`, usuarios de prueba y caché de servidor |
| `presentation/` | Páginas, marcos, guardas, sesión, tema, marca y la implementación de `SuiteHeaderContext` |

`suite-providers.tsx` es la raíz de composición: cablea la infraestructura con la presentación. Al llegar el portal real se sustituye `infrastructure/` sin tocar el resto ([G-124](../../../GAPS.md), [G-176](../../../GAPS.md)).
