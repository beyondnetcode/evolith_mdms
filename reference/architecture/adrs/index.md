# Índice ADR — Registros de Decisiones Arquitectónicas SIL

> **Estándar padre:** [Organización — ADR Registry](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/README.md)

Decisiones arquitectónicas locales del Sistema de Servicios Logísticos (SIL). SIL hereda la línea base de `organizacion_arch` y la especializa para su contexto; toda decisión local se funda en un ADR `Aceptado` del núcleo (S-06) y se identifica como `ADR-SIL-NNN` (S-15). Los ADR de `mdm-api`, el backend de MDM que este repositorio aloja de forma provisional ([D-027](../../../DECISIONS.md#decisiones-locales), [D-031](../../../DECISIONS.md#decisiones-locales)), se identifican como `ADR-MDM-NNN` y viajan con él si se traslada ([G-257](../../../GAPS.md)). El estado de cada fila es el del front-matter `estado:` del propio ADR.

| ADR | Título | Estado |
| --- | --- | --- |
| [ADR-SIL-001](./SIL-001-integracion-sil-tms-logaware.es.md) | Integración de SIL con el TMS LOGAWARE a partir de la orden de transporte de Planificación | Borrador |
| [ADR-SIL-002](./SIL-002-frontera-contexto-sil-en-la-suite.es.md) | Frontera del contexto acotado de SIL en la suite | Borrador |
| [ADR-SIL-003](./SIL-003-excepcion-motor-persistencia-sql-server-2016.es.md) | Excepción de versión del motor de persistencia — SIL fija SQL Server 2016 | Borrador |
| [ADR-SIL-004](./SIL-004-persistencia-proyeccion-compartida-y-outbox-por-contexto.es.md) | Persistencia de SIL — esquema `proyeccion` compartido, referencias sin FK y outbox por contexto | Borrador |
| [ADR-SIL-005](./SIL-005-nomenclatura-y-conceptos-no-portables-del-modelo-fisico.es.md) | Modelo físico en SQL Server 2016 — nomenclatura en español y `PascalCase`, y los conceptos no portables | Borrador |
| [ADR-SIL-006](./SIL-006-agregados-consistencia-eventual-y-bitacora-como-libro-mayor.es.md) | Los agregados de la Fase 1 de SIL — una Solicitud que lleva el ID de operación y el estado, una transacción por caso de uso y la bitácora como libro mayor | Borrador |
| [ADR-SIL-007](./SIL-007-herencia-especificacion-y-extension-por-tipo-de-operacion.es.md) | La Solicitud por tipo de operación — tabla por tipo con discriminador y FK compuesta, especificación por catálogo y código, y extensiones sin tocar lo existente | Borrador |
| [ADR-MDM-001](./MDM-001-nomenclatura-y-conceptos-no-portables-de-mdm.es.md) | Modelo físico de `mdm-api` en SQL Server — esquema `mdm`, nomenclatura en inglés y `PascalCase`, y los conceptos no portables del maestro de organización y sede | Borrador |
| [ADR-MDM-002](./MDM-002-modelo-geografico-de-la-suite.es.md) | Modelo geográfico de la suite — niveles por país, lugares con códigos oficiales, sucesión, UN/LOCODE y coordenadas por etapas | Borrador |

---

<p align="center">
  <strong>© Organización S.A.</strong> · RUC 20100412447 · Operador Logístico Aduanero desde 1978
</p>
