# Fase 1 — Concepción y Descubrimiento

> **Hub de fase.** Puerta de salida: **Aprobación de Negocio**.
> Este satélite conserva los PRD de datos maestros (MDM).

## PRDs

### PRD-MDM-001 — Maestro de organizaciones y partes (MDM)

MDM vive en este satélite ([D-027](../../DECISIONS.md#decisiones-locales), [G-257](../../GAPS.md)). Su PRD se elaboró a posteriori: el diseño y parte de la construcción existían antes; el PRD ordena la cadena y pasa a ser su referencia de negocio.

| Documento | Descripción | Exigencia | Versión | Estado |
| :--- | :--- | :--- | :--- | :--- |
| [PRD-MDM-001](./prd-mdm-001.es.md) | Maestro de organizaciones y partes de la suite: organizaciones, roles con vigencia, establecimientos, relaciones, referencias al ERP y catálogo de tipos de rol | Obligatorio | 0.1.0 | Borrador |
| [Historias de usuario US-MDM-001 a 014](../02-diseno/especificacion-ux-mdm-001.es.md#3-historias-de-usuario) | Las historias de MDM viven en la §3 de la especificación UX (UX-MDM-001); el PRD las traza en su [§11](./prd-mdm-001.es.md#11-trazabilidad) | Obligatorio | 0.2.0 | Borrador |
| [Hub de MDM](../02-diseno/hub-mdm.es.md) | Punto de entrada al área: ruta de lectura del PRD al código, estado y gaps | Complementario | — | Activo |
| [Cuestionario para TI sobre el ERP](../02-diseno/cuestionario-erp-estructura-organizativa-mdm.es.md) | Qué ERP es y cómo está organizado; confirma los supuestos del PRD sobre el ERP ([G-545](../../GAPS.md)) | Complementario | 0.1.0 | Sin enviar |

### PRD-MDM-002 — Geografía de la suite

Deriva de `PRD-MDM-001`: aporta el «dónde» al que apuntan las direcciones de organizaciones, establecimientos y clientes.

| Documento | Descripción | Exigencia | Versión | Estado |
| :--- | :--- | :--- | :--- | :--- |
| [PRD-MDM-002](./prd-mdm-002.es.md) | Geografía de la suite: países ISO 3166-1, escalera de niveles por país con ubigeo e ISO 3166-2, lugares de comercio exterior UN/LOCODE, códigos postales y coordenadas por etapas | Obligatorio | 0.1.0 | Borrador |
| [Análisis de fuentes y requisitos de geografía](./fuentes/analisis-geografia-mdm.es.md) | Estándares, consumidores, casos peruanos, requisitos candidatos R-GEO y preguntas P-GEO que fundamentan el PRD | Complementario | 0.1.0 | Borrador |
| [Hub de MDM](../02-diseno/hub-mdm.es.md) | Punto de entrada al área: ruta de lectura del PRD al código, estado y gaps | Complementario | — | Activo |

## Estado de la fase

Puerta de salida **Aprobación de Negocio**: pendiente. Los artefactos de `PRD-MDM-001` y `PRD-MDM-002` están en `Borrador`.
