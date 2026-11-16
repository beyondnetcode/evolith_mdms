# Contrato de la API — maestro de organización y sede (`mdm-api`)

<p align="right">
  <img src="https://img.shields.io/badge/ORG%20S.A.-Operador_Log%C3%ADstico_Aduanero-0f3e67?style=for-the-badge&logoColor=white" alt="Organización S.A.">
  <img src="https://img.shields.io/badge/Estado-Borrador-825500?style=flat-square" alt="Estado">
  <img src="https://img.shields.io/badge/Versi%C3%B3n-0.2.0-042139?style=flat-square" alt="Versión">
</p>

> **Sistema:** MDM, alojado provisionalmente en este satélite ([D-027](../../DECISIONS.md#decisiones-locales), [G-257](../../GAPS.md))
> **Decisión que lo autoriza:** [D-031](../../DECISIONS.md#decisiones-locales)
> **Diseño:** [especificación técnica del maestro de organización y sede](./especificacion-tecnica-organizacion-sede-mdm-001.es.md) · [ADR-MDM-001](../../reference/architecture/adrs/MDM-001-nomenclatura-y-conceptos-no-portables-de-mdm.es.md) (`Borrador`)
> **Fase:** 3 — Construcción
> **Estado:** Borrador **en revisión por [D-043](../../DECISIONS.md#decisiones-locales)**: el modelo base de MDM pasa a ser Party con roles y establecimientos ([DOM-MDM-002](../02-diseno/modelo-dominio-organizacion-erp-mdm-002.es.md)). Lo que este documento describe es el código construido bajo D-031; se rehará sobre Party cuando exista el ADR aceptado ([G-552](../../GAPS.md)). Hub del área: [MDM — Datos Maestros](../02-diseno/hub-mdm.es.md)

---

Este documento es el contrato HTTP que implementa `src/apps/mdm-api` y refleja su comportamiento tal como lo escribe el código de `Mdm.Presentation`. Las rutas, los campos y los códigos de error van en inglés, como en `organizacion-ums`; el texto, en español (SD-08). No hay todavía documento OpenAPI publicado ([G-258](../../GAPS.md)): mientras falte, **este documento es la fuente**. Las pruebas que lo ejercen contra SQL Server real aún no se han ejecutado ([G-328](../../GAPS.md)): lo que sigue está verificado contra el código, no contra un motor.

## 1. Reglas comunes

| Regla | Contrato |
| :--- | :--- |
| Prefijo | `/api/v1`, agrupado con `MapGroup` |
| Formato | `application/json` en UTF-8; instantes en ISO 8601 con milisegundos y desfase (`2026-10-21T15:04:05.123+00:00`) |
| Autenticación | Portador JWT RS256 contra el JWKS de UMS ([ADR-0157](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0157-firma-asimetrica-portador-ums-jwks.es.md)): solo RS256, emisor y audiencia explícitos, desfase de reloj de 30 s. Toda ruta, incluso una desconocida, exige portador (política por defecto «usuario autenticado»): sin portador válido, `401` `auth.unauthenticated`; con portador válido, una ruta desconocida responde `404`. `/health` es anónimo. El emisor real está por confirmar ([G-315](../../GAPS.md)) |
| Actor | El actor de auditoría es el claim `sub` del portador. Sin `sub`, las escrituras responden `401` `auth.user_required` |
| Autorización | Basta estar autenticado. La autorización por permiso y por organización falta ([G-314](../../GAPS.md)); `403` `auth.forbidden` queda reservado para ella: hoy solo lo emitiría el framework |
| Identificadores | `id` y `branchId` son `Guid`; una ruta con un valor que no es `Guid` no coincide con ninguna ruta y responde `404` (con portador) |
| Errores | Problem Details ([RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)) con `type`, `title`, `status`, `detail` e `instance`, más la extensión **`code`** (§5). Los errores de validación añaden `errors`, un objeto con **un solo campo** (el de la primera regla rota) cuyo valor es la lista con el código de validación, p. ej. `{"name": ["validation.name_required"]}` |

### 1.1 Concurrencia optimista: `ETag`, `If-Match` y `If-None-Match`

- El **`ETag`** de una organización es su versión entera entre comillas: `"7"`. Es fuerte y es el mismo número que será la `Sequence` del `TenantEvent` ([ADR-MDM-001](../../reference/architecture/adrs/MDM-001-nomenclatura-y-conceptos-no-portables-de-mdm.es.md#d4) D4).
- El `ETag` de una sede es **la versión de su organización**: la sede no tiene versión propia, así que cambiar una sede invalida el `ETag` de las demás de la misma organización.
- Toda **escritura sobre un recurso que ya existe** —incluida el alta de una sede, que escribe en el agregado de su organización— exige **`If-Match`** con el `ETag` vigente:
  - sin `If-Match`, vacío o `If-Match: *`: **`428 Precondition Required`**, `code` `precondition.required`; no se escribe nada;
  - con un valor que no es un `ETag` fuerte de versión —débil (`W/"7"`), sin comillas, lista de valores o no numérico—: **`400`**, `code` `validation.failed`, con `errors["If-Match"]`; tampoco se escribe nada. Una versión `"0"` se rechaza igual;
  - con un `If-Match` bien formado que no coincide, o si otra escritura confirma antes: **`412 Precondition Failed`**, `code` `precondition.failed`; no se escribe nada.
- `If-Match` se lee **antes** que el cuerpo: una escritura sin él responde `428` aunque el cuerpo sea inválido.
- La única escritura sin `If-Match` es `POST /tenants`, que crea el agregado.
- Toda respuesta correcta de escritura (`201` y `204`) devuelve el **nuevo `ETag`**.
- `GET` de un recurso, o del listado de sedes, con `If-None-Match` igual a su `ETag` (o `*`) responde **`304 Not Modified`** sin cuerpo; la comparación es débil.

### 1.2 Paginación del listado de organizaciones

Por desplazamiento: `page` (desde 1, defecto 1) y `pageSize` (1 a 100, defecto 20). Fuera de rango o no numérico, `400` con `errors["page"]` o `errors["pageSize"]`. La respuesta envuelve los elementos:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalCount": 0,
  "totalPages": 0
}
```

Ordenación: `sortBy` ∈ {`code`, `name`, `createdAt`} (defecto `code`) y `sortOrder` ∈ {`asc`, `desc`} (defecto `asc`), ambos sin distinguir mayúsculas; el desempate es siempre por `id`. Un valor fuera de la lista es `400` con `errors["sortBy"]` o `errors["sortOrder"]`. Filtros: `status` ∈ {`Active`, `Suspended`, `Archived`}, sin distinguir mayúsculas (otro valor, `400` con `errors["status"]`), y `search` (hasta 200 caracteres tras recortar), que busca el texto contenido en `code` o en `name`. Que la búsqueda no distinga mayúsculas depende de la intercalación `Latin1_General_100_CI_AS` de las columnas ([ADR-MDM-001](../../reference/architecture/adrs/MDM-001-nomenclatura-y-conceptos-no-portables-de-mdm.es.md#d1) D1) y no está verificada contra un motor real ([G-328](../../GAPS.md)). Pasar a *keyset* si se superan unas 10 000 organizaciones ([G-327](../../GAPS.md)).

## 2. Recursos

### 2.1 Organización (`Tenant`)

| Campo | Tipo | Escritura | Regla |
| :--- | :--- | :--- | :--- |
| `id` | `Guid` | Lo asigna el servidor | Inmutable |
| `code` | `string` | Solo en el alta | Se normaliza (recorte, mayúsculas invariantes, espacios por `_`); obligatorio y de hasta 100 caracteres, sin alfabeto ni longitud mínima impuestos; **único en todo el maestro, incluidas las archivadas, y no se reutiliza** ([D-031](../../DECISIONS.md#decisiones-locales)) |
| `name` | `string` | Alta y `PUT` | Obligatorio, 1 a 200 caracteres tras recortar |
| `organizationType` | `string` | Alta y `PUT` | `INTERNAL`, `SUPPLIER` o `CLIENT`, sin distinguir mayúsculas en la entrada; la respuesta lo publica con el nombre canónico |
| `companyReference` | `string?` | Alta y `PUT` | Referencia de empresa (p. ej. RUC), opcional; si se informa no puede ir vacía y llega a 100 caracteres tras recortar. **Única entre organizaciones** (`tenant.company_reference_not_unique`); un `PUT` sin ella la deja vacía |
| `parentTenantId` | `Guid?` | Solo en el alta | Inmutable; debe existir (`400` `tenant.parent_not_found`) y no estar archivada (`409` `tenant.parent_archived`) |
| `status` | `string` | Por acción | `Active` → `Suspended` → `Active`; `Archived` es terminal |
| `version` | `long` | Lo asigna el servidor | Igual al `ETag` sin comillas |
| `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | instante, `string`, instante?, `string?` | Lo asigna el servidor | Auditoría; el actor sale del `sub` del portador. `updatedAt` y `updatedBy` son `null` hasta la primera modificación |

### 2.2 Sede (`Branch`), dentro del agregado de su organización

| Campo | Tipo | Escritura | Regla |
| :--- | :--- | :--- | :--- |
| `id` | `Guid` | Lo asigna el servidor | Inmutable |
| `tenantId` | `Guid` | De la ruta | Inmutable |
| `code` | `string` | Solo en el alta | Misma normalización que la organización; **único dentro de su organización, incluidas las cerradas, y no se reutiliza** |
| `name` | `string` | Alta y `PUT` | Obligatorio, 1 a 200 caracteres |
| `isActive` | `bool` | Por acción | Reversible con `deactivate` y `reactivate`; una sede cerrada se publica con `false` |
| `isClosed` | `bool` | Por acción | Terminal: una sede cerrada no se modifica ni se reactiva |
| `closedAt`, `closedBy` | instante?, `string?` | Al cerrar | `null` en sedes no cerradas |

La sede no publica su versión ni su auditoría (`createdAt`, `updatedAt`): su `ETag` es el de la organización (§1.1). Cada alta, desactivación, reactivación y cierre añade una entrada a la bitácora de la sede, con el motivo si el cliente lo envió; no tiene endpoint de lectura en esta versión ([G-325](../../GAPS.md)).

### 2.3 Instantes

Todo instante se serializa con milisegundos y desfase fijos, p. ej. `2026-10-21T15:04:05.123+00:00` (convertidor `Iso8601MillisecondsConverter`), en vez del formato por defecto, que omite ceros finales.

## 3. Endpoints

| # | Método y ruta | Propósito | `If-Match` | Éxito | Errores |
| :--- | :--- | :--- | :--- | :--- | :--- |
| E-01 | `GET /tenants` | Lista paginada (§1.2) | — | `200` | `400` |
| E-02 | `GET /tenants/{id}` | Consulta una organización | — | `200` + `ETag`; `304` con `If-None-Match` | `404` |
| E-03 | `POST /tenants` | Alta | No | `201` + `Location` + `ETag` | `400`, `409` |
| E-04 | `PUT /tenants/{id}` | Cambia `name`, `organizationType` y `companyReference` | Sí | `204` + `ETag` | `400`, `404`, `409`, `412`, `428` |
| E-05 | `POST /tenants/{id}/suspend` | Suspende | Sí | `204` + `ETag` | `404`, `409`, `412`, `428` |
| E-06 | `POST /tenants/{id}/activate` | Reactiva una suspendida | Sí | `204` + `ETag` | `404`, `409`, `412`, `428` |
| E-07 | `DELETE /tenants/{id}` | **Archiva** (borrado lógico, terminal) | Sí | `204` + `ETag` | `404`, `409`, `412`, `428` |
| E-08 | `GET /tenants/{id}/branches?status=` | Sedes de la organización, ordenadas por `code` y luego `id`; `status` ∈ {`active`, `inactive`, `closed`} sin distinguir mayúsculas; ausente, todas (también las cerradas). `active` e `inactive` excluyen las cerradas | — | `200` + `ETag`; `304` con `If-None-Match` | `400`, `404` |
| E-09 | `GET /tenants/{id}/branches/{branchId}` | Consulta una sede | — | `200` + `ETag`; `304` con `If-None-Match` | `404` |
| E-10 | `POST /tenants/{id}/branches` | Alta de sede; exige la organización `Active` | Sí | `201` + `Location` + `ETag` | `400`, `404`, `409`, `412`, `428` |
| E-11 | `PUT /tenants/{id}/branches/{branchId}` | Cambia `name` | Sí | `204` + `ETag` | `400`, `404`, `409`, `412`, `428` |
| E-12 | `POST /tenants/{id}/branches/{branchId}/deactivate` | Desactiva | Sí | `204` + `ETag` | `404`, `409`, `412`, `428` |
| E-13 | `POST /tenants/{id}/branches/{branchId}/reactivate` | Reactiva una desactivada | Sí | `204` + `ETag` | `404`, `409`, `412`, `428` |
| E-14 | `DELETE /tenants/{id}/branches/{branchId}` | **Cierra** (borrado lógico, terminal) | Sí | `204` + `ETag` | `404`, `409`, `412`, `428` |

Todos responden además `401` sin portador válido. `Location` apunta a E-02 o a E-09.

**Cuerpos.** E-03 lleva `code`, `name`, `organizationType`, `companyReference` y `parentTenantId`; E-04, `name`, `organizationType` y `companyReference`; E-10, `code` y `name`; E-11, `name`. `code` y `parentTenantId` no forman parte del cuerpo de un `PUT`: son inmutables. Un campo obligatorio ausente llega vacío al caso de uso y se rechaza con su `validation.*`; un JSON ilegible es `400` (§5).

**Cuerpo de un alta correcta.** E-03 y E-10 responden `201` con `{ "id": "…", "version": 1 }`: el identificador del recurso creado y la versión de la organización, que también viaja como `ETag`.

**Acciones.** Las acciones de organización (E-05 a E-07) y de sede (E-12 a E-14) aceptan un cuerpo opcional `{ "reason": "…" }`. En las de **sede** el motivo (hasta 500 caracteres tras recortar; más es `400` `validation.reason_too_long`) va a la bitácora. En las de **organización** el cuerpo se acepta pero **se ignora**: los comandos no lo llevan ([G-331](../../GAPS.md)).

**Alta duplicada.** Un `POST` cuyo `code` ya existe responde `409` sin `Location` del recurso existente ([G-332](../../GAPS.md)).

## 4. Transiciones y su código

| Operación | Estado de partida que la rechaza | Estado HTTP | `code` |
| :--- | :--- | :--- | :--- |
| Suspender | `Suspended` | `409` | `tenant.already_suspended` |
| Suspender | `Archived` | `409` | `tenant.archived` |
| Suspender | con sedes activas | `409` | `tenant.has_active_branches` |
| Reactivar | `Active` | `409` | `tenant.already_active` |
| Reactivar, modificar | `Archived` | `409` | `tenant.archived` |
| Archivar | `Archived` | `409` | `tenant.archived` |
| Dar de alta una sede | organización `Archived` | `409` | `tenant.archived` |
| Dar de alta una sede | organización `Suspended` | `409` | `tenant.not_active` |
| Modificar una sede | organización `Archived` | `409` | `tenant.archived` |
| Reactivar una sede | organización `Archived` | `409` | `tenant.archived` |
| Reactivar una sede | organización `Suspended` | `409` | `tenant.not_active` |
| Desactivar | sede inactiva | `409` | `branch.already_inactive` |
| Reactivar | sede activa | `409` | `branch.already_active` |
| Modificar, desactivar, reactivar o cerrar | sede cerrada | `409` | `branch.closed` |

**Política de estado de la organización sobre sus sedes.** Dar de alta y reactivar una sede exigen la organización `Active` (una suspendida o archivada no puede tener sedes activas). Modificar una sede exige la organización no archivada (suspendida sí vale). **Desactivar y cerrar se admiten en cualquier estado de la organización**, incluida la archivada: solo reducen actividad.

Cuando una petición incumple varias reglas a la vez, el `409` lleva la primera que el dominio comprueba; el contrato no promete un orden entre ellas. La validación del cuerpo (`400`) y la existencia (`404`) se comprueban antes que la versión (`412`), y esta antes que las reglas de dominio (`409`).

Las comprobaciones que dependen de UMS —usuarios o perfiles activos en la sede o en la organización— **no se hacen** en esta versión ([G-316](../../GAPS.md)).

## 5. Catálogo de `code`

| `code` | Estado HTTP | Cuándo |
| :--- | :--- | :--- |
| `validation.failed` | `400` | Cuerpo o parámetros inválidos, o `If-Match` mal formado; el detalle va en `errors`, con el código `validation.*` de la primera regla rota (p. ej. `validation.name_required`, `validation.organization_type_invalid`, `validation.expected_version_invalid`) |
| `request.malformed` | `400` | Cuerpo ilegible (JSON mal formado). Lo fija `ProblemDetailsDefaults`; ninguna prueba comprueba el valor de `code`, solo el `400` y `application/problem+json` |
| `auth.unauthenticated` | `401` | Sin portador, o portador inválido (firma, emisor, audiencia, caducado) |
| `auth.user_required` | `401` | Portador válido sin claim `sub` en una escritura |
| `auth.forbidden` | `403` | Reservado para la autorización por permiso ([G-314](../../GAPS.md)); hoy solo lo emitiría el framework |
| `common.not_found` | `404` | La organización o la sede de la ruta no existen, o la ruta no existe |
| `tenant.code_not_unique` | `409` | El `code` ya lo usa otra organización, aunque esté archivada |
| `tenant.company_reference_not_unique` | `409` | La `companyReference` ya la usa otra organización |
| `tenant.parent_not_found` | `400` | `parentTenantId` no existe (o es la propia organización) |
| `tenant.parent_archived` | `409` | `parentTenantId` está archivada |
| `tenant.already_active`, `tenant.already_suspended`, `tenant.archived`, `tenant.has_active_branches` | `409` | §4 |
| `tenant.not_active` | `409` | Alta o reactivación de una sede en una organización suspendida (§4) |
| `branch.code_not_unique` | `409` | El `code` ya lo usa otra sede de la misma organización, aunque esté cerrada |
| `branch.already_active`, `branch.already_inactive`, `branch.closed` | `409` | §4 |
| `precondition.required` | `428` | Escritura sin `If-Match`, vacío o `*` (§1.1) |
| `precondition.failed` | `412` | `If-Match` no coincide o la versión cambió antes de confirmar (§1.1) |
| `server.unexpected_error` | `500` | Excepción no controlada, o un código de error interno sin correspondencia HTTP (se registra como defecto) |

`ProblemDetailsDefaults` añade `request.method_not_allowed` (`405`) y `request.unsupported_media_type` (`415`) a las respuestas que genera el framework; ninguna prueba los ejerce.

Un `code` publicado no cambia de significado; si una regla cambia, nace un `code` nuevo. Ya no existen `tenant.invalid_transition` ni `tenant.branch_invalid_transition`: cada transición rechazada tiene su código propio (§4).

## 6. Ejemplo

```http
PUT /api/v1/tenants/0b9c7e0e-2f4a-4c39-9a51-1f0d7a3e9c11 HTTP/1.1
Authorization: Bearer <portador>
If-Match: "6"
Content-Type: application/json

{ "name": "Organización S.A.", "organizationType": "INTERNAL", "companyReference": "20100412447" }
```

```http
HTTP/1.1 412 Precondition Failed
Content-Type: application/problem+json

{
  "type": "https://httpwg.org/specs/rfc9110.html#status.412",
  "title": "La versión de la organización cambió",
  "status": 412,
  "detail": "La versión vigente no es la indicada en If-Match. Vuelve a leer la organización y reintenta.",
  "instance": "/api/v1/tenants/0b9c7e0e-2f4a-4c39-9a51-1f0d7a3e9c11",
  "code": "precondition.failed"
}
```

## 7. Lo que este contrato no cubre

- La publicación de `TenantEvent` y la sincronización con UMS ([G-312](../../GAPS.md), [G-313](../../GAPS.md)).
- Los atributos de identidad, que siguen en UMS ([G-317](../../GAPS.md)).
- El geofencing de la sede ([G-326](../../GAPS.md)) y la lectura de la bitácora ([G-325](../../GAPS.md)).

## 8. Historial de Cambios

| Versión | Fecha | Autor | Cambios |
| :--- | :--- | :--- | :--- |
| 0.2.0 | 2026-10-21 | aarroyo | Alineado con el comportamiento real del código: catálogo de `code` completo y sin los códigos de transición genéricos, `If-Match` mal formado como `400`, política de estado de la organización sobre sus sedes, cuerpo `{id, version}` del alta, `reason` ignorado en organización, instantes con milisegundos, longitudes reales de `code` y `companyReference` ([G-328](../../GAPS.md), [G-331](../../GAPS.md), [G-332](../../GAPS.md)) |
| 0.1.0 | 2026-10-21 | aarroyo | Versión inicial en `Borrador`: catorce endpoints de organización y sede, `ETag`/`If-Match` con `428` y `412`, Problem Details con `code`, paginación por desplazamiento y catálogo de códigos ([D-031](../../DECISIONS.md#decisiones-locales)) |

---

<p align="center">
  <strong>© Organización S.A.</strong> · RUC 20100412447 · Operador Logístico Aduanero desde 1978
</p>
