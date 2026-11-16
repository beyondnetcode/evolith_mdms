# Fase 2 — Diseño y Arquitectura

> **Hub de fase.** Puerta de salida: **Baseline de Diseño Aprobado**.
> Este satélite conserva el diseño de datos maestros (MDM).

## MDM — Datos maestros

**[→ Abrir el hub de MDM](./hub-mdm.es.md)**: ruta de lectura, estado y gaps del área. **Pendiente de revisión:** el [cuestionario para TI sobre el ERP](./cuestionario-erp-estructura-organizativa-mdm.es.md). MDM no tiene todavía un ADR propio fuera de este satélite ([G-323](../../GAPS.md)).

| Documento | Descripción | Exigencia | Tipo |
| :--- | :--- | :--- | :--- |
| [Hub de MDM](./hub-mdm.es.md) | Punto de entrada del área | Complementario | Hub |
| [Modelo de dominio base de MDM](./modelo-dominio-organizacion-erp-mdm-002.es.md) | `DOM-MDM-002` v0.1.0 (Borrador): Party con roles, establecimientos y relaciones; correspondencia con el ERP en agregado aparte; estructura organizativa alineada a los dos ejes del ERP; Tenant y sucursal en UMS ([D-043](../../DECISIONS.md#decisiones-locales)) | Complementario | Modelo de dominio |
| [Especificación UX de la geografía](./especificacion-ux-geografia-mdm-001.es.md) | `UX-MDM-002` (Borrador): países, lugares, ubigeo, comercio exterior, zonas postales, importaciones y sucesiones ([D-049](../../DECISIONS.md#decisiones-locales)) | Complementario | Especificación UX |
| [Especificación UI de la geografía](./especificacion-ui-geografia-mdm-001.es.md) | `UI-MDM-002` (Borrador): estados, anatomía y componentes Material 3 | Complementario | Especificación UI |
| [Modelo de datos de la geografía](./modelo-datos-geografia-mdm-003.es.md) | `MD-MDM-003` (Borrador): esquema `mdm_geo` en SQL Server | Complementario | Modelo de datos |
| [Especificación UX de MDM](./especificacion-ux-mdm-001.es.md) | `UX-MDM-001` v0.1.0 (Borrador): historias, flujos, pantallas y diálogos de la interfaz web de MDM ([D-044](../../DECISIONS.md#decisiones-locales)) | Complementario | Especificación UX |
| [Especificación UI de MDM](./especificacion-ui-mdm-001.es.md) | `UI-MDM-001` v0.1.0 (Borrador): tokens, anatomía, estados y componentes Material 3 | Complementario | Especificación UI |
| [Propuesta de contrato MDM → UMS](./propuesta-contrato-eventos-mdm-ums.es.md) | Eventos de organización, establecimiento y relación con el mismo `Guid` ([G-553](../../GAPS.md)) | Complementario | Contrato (propuesta) |
| [Cuestionario para TI sobre el ERP](./cuestionario-erp-estructura-organizativa-mdm.es.md) | Qué ERP es, su estructura organizativa y sus interfaces ([G-545](../../GAPS.md)); sin enviar | Complementario | Cuestionario |
| [Modelo de dominio del rol Cliente](./modelo-dominio-cliente-mdm-001.es.md) | `DOM-MDM-001` v0.2.0 (Borrador, en realineación): el Cliente pasa a ser el rol `CUSTOMER` de una Party; su §0 dice qué sigue vigente. Supuestos en [G-530](../../GAPS.md) a [G-544](../../GAPS.md) | Complementario | Modelo de dominio |

## Estado de la fase

Puerta de salida **Baseline de Diseño Aprobado**: pendiente. Los artefactos de MDM siguen en borrador.
