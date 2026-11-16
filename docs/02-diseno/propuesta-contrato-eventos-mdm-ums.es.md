# Propuesta de contrato de integración MDM → UMS — organización, establecimiento y relación

<p align="right">
  <img src="https://img.shields.io/badge/ORG%20S.A.-Operador_Log%C3%ADstico_Aduanero-0f3e67?style=for-the-badge&logoColor=white" alt="Organización S.A.">
  <img src="https://img.shields.io/badge/Estado-Borrador-825500?style=flat-square" alt="Estado">
  <img src="https://img.shields.io/badge/Versi%C3%B3n-0.1.0-042139?style=flat-square" alt="Versión">
</p>

> **Para:** equipo de `organizacion-ums`
> **De:** Arquitectura MDM (aarroyo)
> **Motivo:** [D-043](../../DECISIONS.md#decisiones-locales) cambia lo que MDM publicaría a UMS ([G-553](../../GAPS.md)). Es una **propuesta para acordar**, no un contrato vigente: MDM no publica nada todavía ([G-312](../../GAPS.md)).
> **Modelo de origen:** [DOM-MDM-002](./modelo-dominio-organizacion-erp-mdm-002.es.md) §6 y §7 · **Hub del área:** [MDM — Datos Maestros](./hub-mdm.es.md)

---

## 1. Lo que hay hoy en UMS

Medido el 2026-10-24 sobre `organizacion-ums` (rama `fix/g483-handlers-alcance`, commit `d95f7dc8`), solo lectura:

| Pieza | Estado |
| :--- | :--- |
| Contrato `TenantEvent` (`src/apps/ums.api/Organización.Ums.Infrastructure/MasterData/Contracts/TenantEvent.cs`) | Envoltura tipo CloudEvents con `Subject`, `Sequence` y `Data(TenantId, Code, Name, Status, Version)`; `Source` por defecto `mms`. Vive en el repositorio del **consumidor**. No hay evento de sucursal |
| `TenantProjectionConsumer` | `MERGE` en `masterdata.tenant_projection` por `Subject`; actualiza solo si `Sequence` es mayor; inserta si no existe. Inbox de EF y reintento exponencial. Cola `ums.tenant-projection` |
| Uso de la proyección | **Ningún código de producción la lee**: no toca la entidad `Tenant` de UMS |
| Identificadores | `Tenant.Create` **admite** un `Guid` externo, pero los dos llamantes no lo pasan; `Branch.Create` genera siempre su `Guid` |
| Planes de UMS | `organizacion-ums#G-576` (migrar a Kafka, en curso) y `organizacion-ums#G-577` (topics `mdm.inquilino.evento` y `mdm.inquilino.estado`, clave `tenantId`); `organizacion-ums#G-571` (el alta de inquilino tiene dos escritores) |

**Conclusión:** cambiar el contrato ahora es barato. Nada en producción depende de la proyección, y el plan de Kafka de UMS todavía no tiene productor.

## 2. Qué cambia con D-043

| Antes (D-031) | Ahora (D-043) |
| :--- | :--- |
| MDM es dueño del Tenant y lo publica como `TenantEvent` | MDM es dueño de la **organización** (Party) y de sus **establecimientos**; UMS es dueño del **Tenant** y de la **sucursal** |
| UMS proyecta el Tenant | UMS proyecta organizaciones y establecimientos, y **decide** cuáles son Tenant y cuáles sucursal |
| Sin evento de sede | `EstablishmentEvent` |
| Jerarquía en `ParentTenantId` | `PartyRelationshipEvent` de tipo `PARENT_OF` |

## 3. Propuesta

### 3.1 Tres eventos de transferencia de estado

Mismo patrón que hoy: estado completo tras el cambio, `subject` = identificador del agregado, `sequence` = su versión, el consumidor aplica solo secuencias estrictamente mayores.

| Evento | `subject` | `data` mínimo para UMS |
| :--- | :--- | :--- |
| `PartyEvent` (`party.changed`) | `PartyId` | `type`, `code`, `name`, `status`, `primaryIdentifier`, `roles[]` vigentes |
| `EstablishmentEvent` (`establishment.changed`) | `EstablishmentId` | `partyId`, `code`, `name`, `kindCode`, `isActive`, `isClosed` |
| `PartyRelationshipEvent` (`party-relationship.changed`) | `RelationshipId` | `fromPartyId`, `toPartyId`, `kindCode`, `validFrom`, `validTo` |

Ejemplos completos en [DOM-MDM-002 §7](./modelo-dominio-organizacion-erp-mdm-002.es.md#7-eventos-de-dominio-y-contrato-de-integración).

### 3.2 Mismo `Guid`

- El Tenant de UMS se crea **sobre** una Party organización con `TenantId = PartyId`. `Tenant.Create` ya lo admite; falta que el comando lo reciba.
- La sucursal se crea sobre un establecimiento con `BranchId = EstablishmentId`. `Branch.Create` debe aceptar un `Guid` externo.
- UMS deja de crear organizaciones y sedes que no vengan del maestro (resuelve el doble escritor de `organizacion-ums#G-571`).

### 3.3 Qué conserva UMS

`IdpStrategy`, `ShowOnLogin`, `IsManagementOwner`, `IsSubtreeOwner`, `DefaultSystemSuiteId`, proveedores de identidad, parámetros del inquilino, permisos por sucursal y, mientras no se decida otra cosa, el geofencing ([G-326](../../GAPS.md)).

### 3.4 Transporte y domicilio del contrato

- El contrato pasa al repositorio del **emisor**, MDM ([ADR-0097](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0097-integracion-entre-sistemas-suite-eventos-xms.es.md) D6), con AsyncAPI; UMS lo cita por versión.
- Si el bus es Kafka (ADR-0249, aceptado en `develop` de `organizacion_arch` y aún no en el estándar que vincula este satélite, [G-312](../../GAPS.md)), proponemos topics por agregado con clave = `subject`: `mdm.party.estado`, `mdm.establishment.estado`, `mdm.party-relationship.estado` (compactados). Sustituyen a los `mdm.inquilino.*` de `organizacion-ums#G-577`.
- `source` = `mdm`, no `mms` ([ADR-0225](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0225-el-sistema-de-data-maestra-se-llama-mdm.es.md), `Borrador`).

## 4. Preguntas para UMS

| # | Pregunta |
| :--- | :--- |
| U-01 | ¿Aceptan `TenantId = PartyId` y `BranchId = EstablishmentId`? |
| U-02 | ¿Cómo marcan qué Party es Tenant: alta explícita en UMS sobre la proyección, o una regla (por ejemplo, rol `INTERNAL_COMPANY` o `CUSTOMER` con portal)? |
| U-03 | ¿Necesitan proyectar todas las Parties o solo las que son Tenant? Si solo esas, ¿filtran al consumir o prefieren un topic aparte? |
| U-04 | ¿Qué pasa con un usuario cuya sucursal se **cierra** en MDM? ¿UMS reacciona al evento, o MDM debe consultar antes de cerrar? |
| U-05 | ¿Qué hace UMS si MDM no responde o el evento llega tarde (S-42)? |
| U-06 | ¿Cómo se concilian los inquilinos y sucursales que ya existen en UMS con el maestro, conservando `Guid` y `Code` ([G-313](../../GAPS.md))? |
| U-07 | ¿Reemplazamos los topics de `organizacion-ums#G-577` por los de §3.4 o conviven durante la migración? |

## 5. Registro de la consulta

| Fecha | Acción | Resultado |
| :--- | :--- | :--- |
| 2026-10-24 | Propuesta redactada y consulta abierta a `organizacion-ums` como _issue_ | Ver [G-553](../../GAPS.md) |

## 6. Historial de cambios

| Versión | Fecha | Autor | Cambios |
| :--- | :--- | :--- | :--- |
| 0.1.0 | 2026-10-24 | aarroyo, con el agente `organizacion-architect` | Versión inicial tras medir el contrato y el consumidor actuales de UMS |

---

<p align="center">
  <strong>© Organización S.A.</strong> · RUC 20100412447 · Operador Logístico Aduanero desde 1978
</p>
