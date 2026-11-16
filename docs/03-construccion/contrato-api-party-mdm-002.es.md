# Contrato de la API — maestro de partes (Party) de MDM

<p align="right">
  <img src="https://img.shields.io/badge/ORG%20S.A.-Operador_Log%C3%ADstico_Aduanero-0f3e67?style=for-the-badge&logoColor=white" alt="Organización S.A.">
  <img src="https://img.shields.io/badge/Estado-Borrador-825500?style=flat-square" alt="Estado">
  <img src="https://img.shields.io/badge/Versi%C3%B3n-0.2.0-042139?style=flat-square" alt="Versión">
</p>

> **Código:** `API-MDM-002`
> **Fase:** 3 — Construcción (diseño de contrato; **sin implementación**)
> **Sistema:** MDM, alojado provisionalmente en este satélite ([D-027](../../DECISIONS.md#decisiones-locales), [G-257](../../GAPS.md))
> **Decisiones que lo enmarcan:** [D-043](../../DECISIONS.md#decisiones-locales) (MDM centrado en Party), [D-044](../../DECISIONS.md#decisiones-locales) (interfaz web contra un mock de este contrato) y [D-046](../../DECISIONS.md#decisiones-locales) (mantenimiento del catálogo de tipos de rol)
> **Diseño de dominio:** [DOM-MDM-002](../02-diseno/modelo-dominio-organizacion-erp-mdm-002.es.md)
> **Documento máquina:** [OpenAPI 3.1](./openapi-party-mdm-002.yaml), fuente del mock `mdm-mock` del frontend
> **Estado:** Borrador. El backend de Party **no se escribe** hasta que el satélite vincule la versión del estándar que publique ADR-0264 y ADR-0265 ([G-552](../../GAPS.md), [G-554](../../GAPS.md)). Hub del área: [MDM — Datos Maestros](../02-diseno/hub-mdm.es.md)

---

**Convención de idioma.** La prosa está en español (SD-08). Rutas, campos JSON, enumeraciones, eventos y valores de `code` van en inglés ([D-025](../../DECISIONS.md#decisiones-locales)).

**Fuente de verdad.** Este documento fija las reglas y su porqué; el [OpenAPI](./openapi-party-mdm-002.yaml) fija la forma exacta (tipos, longitudes, enumeraciones). Si discrepan, es un defecto de este Borrador y se corrigen los dos a la vez.

**Evidencia y supuestos.** Lo que no está en DOM-MDM-002 y este contrato añade está marcado como **propuesta** y tiene su gap en §12.

## 1. Alcance

Primera entrega, según [D-044](../../DECISIONS.md#decisiones-locales):

| Dentro | Fuera |
| :--- | :--- |
| Party `ORGANIZATION`: alta, consulta, búsqueda, edición de nombres y ciclo de vida (`Active` ⇄ `Suspended`, `Archived`) | Party `PERSON`: el alta se **rechaza** con `422` `party.person_not_supported` hasta cerrar [G-534](../../GAPS.md) (Ley 29733) |
| Identificadores `(countryCode, schemeCode, value)` con vigencia y uno primario | Fusión de duplicados y estado `Merged`: se lee, no se produce ([G-537](../../GAPS.md)) |
| Roles con vigencia: asignar, suspender, reactivar, terminar | Datos comerciales del rol (crédito, tarifario): son de CMS o del ERP ([DOM-MDM-002 §4.2](../02-diseno/modelo-dominio-organizacion-erp-mdm-002.es.md#42-datos-del-rol-lo-mínimo)) |
| Establecimientos `HEAD_OFFICE`, `BRANCH`, `PLANT`: abrir, editar, desactivar, reactivar, cerrar | Establecimientos `WAREHOUSE` ([G-547](../../GAPS.md)): `422` `establishment.kind_not_supported` |
| Relaciones entre Parties con vigencia | Administración de los catálogos de esquemas, tipos de establecimiento y tipos de relación ([G-555](../../GAPS.md)): solo lectura |
| Referencias externas (correspondencia con el ERP): vincular, consultar, desvincular | Acuse de sincronización desde XMS ([G-574](../../GAPS.md)) y publicación de eventos ([G-312](../../GAPS.md), [G-553](../../GAPS.md)) |
| Lectura de los cuatro catálogos y mantenimiento del de tipos de rol: alta, edición, desactivar y reactivar ([D-046](../../DECISIONS.md#decisiones-locales)) | Tenant y sucursal: son de UMS ([DOM-MDM-002 §6](../02-diseno/modelo-dominio-organizacion-erp-mdm-002.es.md#6-relación-con-ums-tenant-y-sucursal)) |

## 2. Reglas comunes

Se conservan las del [contrato de Tenant y Branch](./contrato-api-organizacion-sede-mdm-001.es.md) salvo donde §10 dice lo contrario.

| Regla | Contrato |
| :--- | :--- |
| Prefijo | `/api/v1` |
| Formato | `application/json` en UTF-8, campos en `camelCase`. Instantes en ISO 8601 con milisegundos y desfase (`2026-10-24T15:04:05.123+00:00`); fechas de vigencia como `date` (`2026-10-24`) |
| Identificadores | `partyId`, `identifierId`, `roleId`, `establishmentId`, `relationshipId` y `externalReferenceId` son UUID asignados por el servidor. Una ruta con un valor que no es UUID no coincide y responde `404`. El tipo de rol se identifica por su `code` (§5.4) |
| Autenticación y autorización | §8 |
| Errores | Problem Details ([RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)) con `type`, `title`, `status`, `detail`, `instance` y la extensión **`code`**. Los `400` de validación añaden `errors`: un objeto con **un solo campo** (el de la primera regla rota) y la lista con su código `validation.*`, p. ej. `{"legalName": ["validation.legal_name_required"]}` |
| Respuestas de escritura | Alta: `201` + `Location` + `ETag` y cuerpo `{ "id": "…", "version": n }`. Resto: `204` + `ETag` nuevo |
| Motivo | Las acciones (`suspend`, `activate`, `terminate`, `deactivate`, `reactivate`, `end`, `DELETE`) aceptan un cuerpo opcional `{ "reason": "…" }` de hasta 500 caracteres tras recortar (`400` `validation.reason_too_long`). Dónde se guarda sigue abierto ([G-331](../../GAPS.md)) |
| Normalización de `code` | Recorte, mayúsculas invariantes y espacios por `_`; 1 a 100 caracteres; inmutable y no reutilizable (regla 1 de [D-031](../../DECISIONS.md#decisiones-locales), conservada por [DOM-MDM-002](../02-diseno/modelo-dominio-organizacion-erp-mdm-002.es.md#43-invariantes) `INV-PTY-07` e `INV-PTY-08`) |
| Normalización de `value` del identificador | Recorte, mayúsculas, sin espacios ni guiones ([DOM-MDM-001 §3.3](../02-diseno/modelo-dominio-cliente-mdm-001.es.md#33-validación-de-taxidentifier)) |
| Vigencias | Intervalo cerrado `[validFrom, validTo]`; `validTo` `null` es indefinido. «Vigente» se calcula contra la fecha de hoy en `America/Lima` (supuesto, [G-575](../../GAPS.md)) y se publica como `isCurrent` |

### 2.1 Concurrencia optimista: qué versión protege cada escritura

La regla viene de [DOM-MDM-002 §4.1](../02-diseno/modelo-dominio-organizacion-erp-mdm-002.es.md#41-agregados) y [§8](../02-diseno/modelo-dominio-organizacion-erp-mdm-002.es.md#8-frontera-transaccional): **una transacción, un agregado**, y toda mutación sube la `version` del agregado, que es su `ETag` y la `sequence` de sus eventos ([ADR-0098](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0098-comunicacion-entre-agregados-intra-servicio.es.md), `Aceptado`; [ADR-MDM-001](../../reference/architecture/adrs/MDM-001-nomenclatura-y-conceptos-no-portables-de-mdm.es.md#d4) D4, `Borrador` local, que se conserva como regla de D-031).

| Agregado | Recursos HTTP que lo mutan | `ETag` |
| :--- | :--- | :--- |
| `Party` | `/parties/{partyId}` y **todos** sus subrecursos: `identifiers`, `roles`, `establishments` | `version` de la Party. Identificadores, roles y establecimientos **no tienen versión propia**: cambiar un establecimiento invalida el `ETag` de los roles de la misma Party. Es lo que protege `INV-PTY-03`, `05` y `09`, que cruzan entidades |
| `PartyRelationship` | `/party-relationships/{relationshipId}` | `version` propia. Crear o terminar una relación **no** sube la versión de ninguna Party: si lo hiciera, editar una relación bloquearía a las dos Parties |
| `ExternalReference` | `/external-references/{externalReferenceId}` | `version` propia. Un acuse del ERP no debe subir la versión de la Party ([G-551](../../GAPS.md)) |
| `PartyRoleType` | `/catalogs/party-role-types/{code}` y sus acciones `deactivate` y `activate` (§3.6) | `version` propia **por tipo**. Escribir un tipo no sube la versión de ninguna Party ni la de otro tipo ([D-046](../../DECISIONS.md#decisiones-locales)) |
| Resto de catálogos | Solo lectura en esta versión | `ETag` del catálogo completo, para `304` |

Reglas de `If-Match`, idénticas a las de Tenant:

- Toda escritura sobre un recurso existente exige `If-Match` con el `ETag` vigente del agregado de la tabla. Las únicas sin `If-Match` son las que **crean un agregado**: `POST /parties`, `POST /party-relationships`, `POST /external-references` y `POST /catalogs/party-role-types`. El alta de identificador, rol o establecimiento **sí** lo exige, porque escribe en la Party.
- Sin `If-Match`, vacío o `*`: `428` `precondition.required`. Débil (`W/"7"`), sin comillas, lista, no numérico o `"0"`: `400` `validation.failed` con `errors["If-Match"]`. Bien formado pero distinto, o si otra escritura confirma antes: `412` `precondition.failed`. Nunca se escribe nada.
- `If-Match` se evalúa antes que el cuerpo.
- `GET` con `If-None-Match` igual al `ETag` (o `*`) responde `304` sin cuerpo; comparación débil.

### 2.2 Orden de evaluación

`401` → `428` → `400` (forma, `If-Match` mal formado) → `404` (recurso de la ruta) → `412` → `422` (valor que el catálogo o la regla semántica no admite) → `409` (conflicto con el estado o con la unicidad). Si una petición rompe varias reglas del mismo nivel, el contrato no promete cuál se informa.

## 3. Endpoints

`If-Match` indica **de qué agregado** es la versión exigida. Todos responden además `401`, y `403` cuando exista autorización (§8).

### 3.1 Party

| # | Método y ruta | Propósito | `If-Match` | Éxito | Errores |
| :--- | :--- | :--- | :--- | :--- | :--- |
| P-01 | `GET /parties` | Lista y búsqueda (§4) | — | `200` | `400` |
| P-02 | `POST /parties` | Alta de una organización con su identificador primario y, opcionalmente, roles | No | `201` | `400`, `409`, `422` |
| P-03 | `GET /parties/{partyId}` | Ficha completa: identificadores, roles y establecimientos | — | `200` + `ETag`; `304` | `404` |
| P-04 | `PUT /parties/{partyId}` | Cambia `legalName` y `tradeName` | Party | `204` | `400`, `404`, `409`, `412`, `428` |
| P-05 | `POST /parties/{partyId}/suspend` | Suspende | Party | `204` | `404`, `409`, `412`, `428` |
| P-06 | `POST /parties/{partyId}/activate` | Reactiva una suspendida | Party | `204` | `404`, `409`, `412`, `428` |
| P-07 | `DELETE /parties/{partyId}` | **Archiva** (terminal, borrado lógico) | Party | `204` | `404`, `409`, `412`, `428` |

**`PUT` y no `PATCH`.** Solo hay dos campos editables y los dos se envían siempre; `PUT` conserva la semántica de D-031 y evita definir JSON Merge Patch. `type`, `code` e identificadores no forman parte del cuerpo: son inmutables o tienen su verbo.

### 3.2 Identificadores

| # | Método y ruta | Propósito | `If-Match` | Éxito | Errores |
| :--- | :--- | :--- | :--- | :--- | :--- |
| P-08 | `GET /parties/{partyId}/identifiers` | Identificadores, vigentes y vencidos | — | `200` + `ETag`; `304` | `404` |
| P-09 | `POST /parties/{partyId}/identifiers` | Añade un identificador; con `isPrimary: true` y `replacesPrimary: true` vence el primario anterior en la misma transacción | Party | `201` | `400`, `404`, `409`, `412`, `422`, `428` |
| P-10 | `POST /parties/{partyId}/identifiers/{identifierId}/expire` | Vence un identificador con `validTo` (por defecto, hoy) | Party | `204` | `400`, `404`, `409`, `412`, `428` |

Un identificador **no se edita ni se borra**: se corrige venciéndolo y añadiendo otro. Su valor nunca viaja en la ruta, para que no quede en los registros de acceso cuando lleguen los documentos de persona (§8).

### 3.3 Roles

| # | Método y ruta | Propósito | `If-Match` | Éxito | Errores |
| :--- | :--- | :--- | :--- | :--- | :--- |
| P-11 | `GET /parties/{partyId}/roles` | Roles, en cualquier estado | — | `200` + `ETag`; `304` | `404` |
| P-12 | `POST /parties/{partyId}/roles` | Asigna un rol con su vigencia; exige la Party `Active` | Party | `201` | `400`, `404`, `409`, `412`, `422`, `428` |
| P-13 | `POST /parties/{partyId}/roles/{roleId}/suspend` | Suspende | Party | `204` | `404`, `409`, `412`, `428` |
| P-14 | `POST /parties/{partyId}/roles/{roleId}/activate` | Reactiva un rol suspendido (propuesta, [G-570](../../GAPS.md)) | Party | `204` | `404`, `409`, `412`, `428` |
| P-15 | `POST /parties/{partyId}/roles/{roleId}/terminate` | Termina (terminal); fija `validTo` (por defecto, hoy) | Party | `204` | `400`, `404`, `409`, `412`, `428` |

### 3.4 Establecimientos

| # | Método y ruta | Propósito | `If-Match` | Éxito | Errores |
| :--- | :--- | :--- | :--- | :--- | :--- |
| P-16 | `GET /parties/{partyId}/establishments?status=` | Establecimientos; `status` ∈ {`active`, `inactive`, `closed`}; ausente, todos | — | `200` + `ETag`; `304` | `400`, `404` |
| P-17 | `GET /parties/{partyId}/establishments/{establishmentId}` | Un establecimiento | — | `200` + `ETag`; `304` | `404` |
| P-18 | `POST /parties/{partyId}/establishments` | Abre; exige la Party `Active` | Party | `201` | `400`, `404`, `409`, `412`, `422`, `428` |
| P-19 | `PUT /parties/{partyId}/establishments/{establishmentId}` | Cambia `name`, `kindCode`, `taxEstablishmentCode`, `isPrincipal` y `address` | Party | `204` | `400`, `404`, `409`, `412`, `422`, `428` |
| P-20 | `POST /parties/{partyId}/establishments/{establishmentId}/deactivate` | Desactiva (reversible) | Party | `204` | `404`, `409`, `412`, `428` |
| P-21 | `POST /parties/{partyId}/establishments/{establishmentId}/reactivate` | Reactiva; exige la Party `Active` | Party | `204` | `404`, `409`, `412`, `428` |
| P-22 | `DELETE /parties/{partyId}/establishments/{establishmentId}` | **Cierra** (terminal) | Party | `204` | `404`, `409`, `412`, `428` |

### 3.5 Relaciones, referencias externas y catálogos

| # | Método y ruta | Propósito | `If-Match` | Éxito | Errores |
| :--- | :--- | :--- | :--- | :--- | :--- |
| R-01 | `GET /party-relationships` | Lista; filtros `partyId` (en cualquier extremo), `fromPartyId`, `toPartyId`, `kindCode`, `currentOnly` | — | `200` | `400` |
| R-02 | `POST /party-relationships` | Inicia una relación | No | `201` | `400`, `409`, `422` |
| R-03 | `GET /party-relationships/{relationshipId}` | Una relación | — | `200` + `ETag`; `304` | `404` |
| R-04 | `POST /party-relationships/{relationshipId}/end` | Termina con `validTo` (por defecto, hoy) | Relación | `204` | `400`, `404`, `409`, `412`, `428` |
| X-01 | `GET /external-references` | Lista; filtros `mdmObjectType` + `mdmObjectId`, `partyId`, `systemCode`, `systemInstance`, `externalObjectType`, `externalKey`, `syncStatus` | — | `200` | `400` |
| X-02 | `POST /external-references` | Vincula un objeto de MDM con su clave externa | No | `201` | `400`, `409`, `422` |
| X-03 | `GET /external-references/{externalReferenceId}` | Una referencia | — | `200` + `ETag`; `304` | `404` |
| X-04 | `DELETE /external-references/{externalReferenceId}` | **Desvincula** (`syncStatus` = `Unlinked`, terminal, borrado lógico) | Referencia | `204` | `404`, `409`, `412`, `428` |
| C-01 | `GET /catalogs/identifier-schemes` | Esquemas de identificador; filtros `countryCode`, `partyType`, `includeInactive` | — | `200` + `ETag`; `304` | `400` |
| C-02 | `GET /catalogs/party-role-types` | Tipos de rol con su código UN/EDIFACT 3035; filtros `partyType`, `includeInactive` | — | `200` + `ETag`; `304` | `400` |
| C-03 | `GET /catalogs/establishment-kinds` | Tipos de establecimiento; `isSupported` dice si la primera entrega lo admite | — | `200` + `ETag`; `304` | `400` |
| C-04 | `GET /catalogs/relationship-kinds` | Tipos de relación | — | `200` + `ETag`; `304` | `400` |

Los catálogos son pequeños y se devuelven completos, sin paginar: `{ "items": [ … ] }`. La administración y la carga inicial de esquemas, tipos de establecimiento y tipos de relación no tienen dueño ([G-555](../../GAPS.md)); los tipos de rol se administran desde MDM (§3.6). Los valores de los ejemplos son **ilustrativos**.

### 3.6 Catálogo de tipos de rol (D-046)

El catálogo `PartyRoleType` deja de ser fijo ([D-046](../../DECISIONS.md#decisiones-locales), que amplía [D-044](../../DECISIONS.md#decisiones-locales)): MDM lo mantiene. Cada tipo es su propio agregado, con versión propia; la ruta lleva su `code`.

| # | Método y ruta | Propósito | `If-Match` | Éxito | Errores |
| :--- | :--- | :--- | :--- | :--- | :--- |
| C-05 | `POST /catalogs/party-role-types` | Alta de un tipo de rol; nace activo y con versión 1 | No | `201` | `400`, `403`, `409`, `422` |
| C-06 | `PUT /catalogs/party-role-types/{code}` | Cambia `name`, `description`, `unEdifact3035Code`, `allowedPartyTypes` y `requiresFiscalIdentifier`; el `code` no cambia | Tipo | `204` | `400`, `403`, `404`, `412`, `422`, `428` |
| C-07 | `POST /catalogs/party-role-types/{code}/deactivate` | Desactiva (reversible): no se asigna a roles nuevos y los existentes se conservan | Tipo | `204` | `403`, `404`, `409`, `412`, `428` |
| C-08 | `POST /catalogs/party-role-types/{code}/activate` | Reactiva un tipo desactivado | Tipo | `204` | `403`, `404`, `409`, `412`, `428` |

Reglas del catálogo:

- **El código es inmutable y no se reutiliza.** No hay borrado: desactivar conserva el tipo, así que un código que existió, aunque esté desactivado, responde `409` `party_role_type.code_duplicate`.
- **Desactivar no toca los roles.** Los roles existentes de un tipo desactivado conservan su estado y su vigencia; P-02 y P-12 rechazan un tipo desactivado con `409` `party_role_type.inactive`. Es `409` y no `422` porque reactivar el tipo convierte la misma petición en éxito (§6.1). Un tipo inexistente sigue siendo `422` `party.role.type_unknown`.
- **Autorización supuesta.** Administran el analista y el responsable de datos maestros; el resto consulta. Es un supuesto hasta que UMS conceda el permiso ([G-555](../../GAPS.md), [G-560](../../GAPS.md)); el `403` `auth.forbidden` se reserva como en el resto del contrato (§8).
- **Código UN/EDIFACT 3035 como código.** Se guarda el calificador de parte (dos letras), no la estructura del segmento `NAD`, como fija D-046 (ADR-0264 D7 se cita como contexto, [G-554](../../GAPS.md)). Los de la carga inicial se verifican contra el directorio oficial antes de producción (consecuencia 4 de D-046).

## 4. Listado y búsqueda de Parties (P-01)

| Parámetro | Regla |
| :--- | :--- |
| `search` | Texto contenido en `code`, `legalName` o `tradeName`; hasta 200 caracteres tras recortar. Sin distinguir mayúsculas, sujeto a la intercalación (como en Tenant, [G-328](../../GAPS.md)) |
| `roleTypeCode` | Parties con un rol **vigente** de ese tipo (estado `Active` e `isCurrent`) |
| `status` | `Active`, `Suspended`, `Archived` o `Merged`, sin distinguir mayúsculas; ausente, todos menos `Archived` y `Merged` |
| `type` | `ORGANIZATION` o `PERSON`; hoy solo existen organizaciones |
| `countryCode` + `schemeCode` + `identifierValue` | Búsqueda exacta por identificador, **los tres juntos** o ninguno (`400` `validation.identifier_filter_incomplete`). `identifierValue` se normaliza como en el alta. Encuentra también identificadores vencidos y Parties archivadas, porque `INV-PTY-02` las incluye |
| `sortBy` | `code` (defecto), `legalName`, `createdAt`, `updatedAt` |
| `sortOrder` | `asc` (defecto) o `desc`. El desempate es siempre por `id` |
| `page`, `pageSize` | Desde 1 (defecto 1); 1 a 100 (defecto 20) |

**Paginación por desplazamiento, como Tenant.** El encargo pedía cursor si su ADR estaba aceptado; ni el ADR de paginación por cursor ni el de `If-Match` que se esperaban (`core/0261-*`, `core/0259-*`) existen en la versión vinculada del plugin (`organizacion-core` 1.107.0), así que no hay norma que adoptar y se conserva la forma vigente con su umbral de revisión ([G-327](../../GAPS.md), [G-571](../../GAPS.md)). La respuesta es `{ "items", "page", "pageSize", "totalCount", "totalPages" }` y cada elemento es un `PartySummary`: `id`, `type`, `code`, `legalName`, `tradeName`, `status`, `primaryIdentifier`, `currentRoleTypeCodes`, `version`, `updatedAt`.

## 5. Recursos y DTO

Longitudes, formatos y obligatoriedad exactos en el [OpenAPI](./openapi-party-mdm-002.yaml) (`components/schemas`).

### 5.1 Alta de Party (P-02)

```json
{
  "type": "ORGANIZATION",
  "code": "TRANSPORTES-ANDINOS",
  "legalName": "TRANSPORTES ANDINOS S.A.C.",
  "tradeName": "Transandinos",
  "primaryIdentifier": {
    "countryCode": "PE",
    "schemeCode": "PE-RUC",
    "value": "20100412447",
    "validFrom": "2026-10-24"
  },
  "roles": [
    { "roleTypeCode": "CUSTOMER", "validFrom": "2026-10-24", "validTo": null },
    { "roleTypeCode": "CARRIER", "validFrom": "2026-11-01", "validTo": null }
  ]
}
```

| Campo | Regla |
| :--- | :--- |
| `type` | Obligatorio; `ORGANIZATION`. `PERSON` es `422` `party.person_not_supported`; otro valor, `400` |
| `code` | Obligatorio; normalizado, 1 a 100; único entre todas las Parties, incluidas las archivadas (`INV-PTY-07`) |
| `legalName` | Obligatorio; 1 a 200 tras recortar |
| `tradeName` | Opcional; hasta 200 |
| `primaryIdentifier` | Obligatorio (`INV-PTY-03`). `validFrom` opcional, por defecto hoy |
| `roles` | Opcional; cada elemento como en P-12. Cada rol emite su propio evento |

El RUC del ejemplo es el de Organización porque es el único con dígito verificador comprobado en [DOM-MDM-001 §3.3](../02-diseno/modelo-dominio-cliente-mdm-001.es.md#33-validación-de-taxidentifier); el resto de datos es ilustrativo.

### 5.2 Ficha de Party (P-03)

```json
{
  "id": "0b9c7e0e-2f4a-4c39-9a51-1f0d7a3e9c11",
  "type": "ORGANIZATION",
  "code": "ORG",
  "legalName": "ORG S.A.",
  "tradeName": "Organización",
  "status": "Active",
  "version": 7,
  "identifiers": [
    {
      "identifierId": "5f1d2b8a-90c4-4a7e-8d3b-6a2e1c9f0b47",
      "countryCode": "PE",
      "schemeCode": "PE-RUC",
      "value": "20100412447",
      "isPrimary": true,
      "validFrom": "1978-01-01",
      "validTo": null,
      "isCurrent": true
    }
  ],
  "roles": [
    {
      "roleId": "c3a8e1f2-7b6d-4e59-a0c1-2d4f6b8e9a10",
      "roleTypeCode": "INTERNAL_COMPANY",
      "status": "Active",
      "validFrom": "1978-01-01",
      "validTo": null,
      "isCurrent": true
    }
  ],
  "establishments": [
    {
      "id": "7e2c4a91-3d5b-4f60-8a17-b9c0d2e4f681",
      "partyId": "0b9c7e0e-2f4a-4c39-9a51-1f0d7a3e9c11",
      "code": "CALLAO",
      "kindCode": "BRANCH",
      "name": "Sede Callao",
      "taxEstablishmentCode": "0001",
      "isPrincipal": true,
      "isActive": true,
      "isClosed": false,
      "closedAt": null,
      "closedBy": null,
      "address": {
        "line1": "Av. Ejemplo 123",
        "line2": null,
        "ubigeo": "070101",
        "department": "Callao",
        "province": "Callao",
        "district": "Callao",
        "postalCode": null,
        "countryCode": "PE",
        "reference": null
      }
    }
  ],
  "createdAt": "2026-10-24T15:02:11.400+00:00",
  "createdBy": "aarroyo",
  "updatedAt": "2026-10-24T16:10:00.000+00:00",
  "updatedBy": "aarroyo"
}
```

La ficha incluye establecimientos porque una Party tiene pocos ([DOM-MDM-002 §8](../02-diseno/modelo-dominio-organizacion-erp-mdm-002.es.md#8-frontera-transaccional), umbral de unos 50 en [G-550](../../GAPS.md)); si se supera, salen de la ficha y quedan solo en P-16. Los datos del establecimiento son ilustrativos.

### 5.3 Cuerpos de los subrecursos

| Operación | Cuerpo | Reglas |
| :--- | :--- | :--- |
| P-04 | `{ "legalName", "tradeName" }` | Como en el alta; un `tradeName` ausente lo deja vacío |
| P-09 | `{ "countryCode", "schemeCode", "value", "isPrimary", "replacesPrimary", "validFrom" }` | `countryCode` ISO 3166-1 alfa-2; `schemeCode` del catálogo y del mismo país; `value` hasta 50 y validado por el patrón del esquema y, si es RUC, por su dígito verificador (`INV-PTY-04`). `replacesPrimary` solo vale con `isPrimary: true`: vence el primario anterior con `validTo = validFrom − 1 día` (propuesta, [G-570](../../GAPS.md)) |
| P-10 | `{ "validTo", "reason" }` | `validTo` ≥ `validFrom` del identificador |
| P-12 | `{ "roleTypeCode", "validFrom", "validTo" }` | `validFrom` por defecto hoy; `validTo` ≥ `validFrom` |
| P-15 | `{ "validTo", "reason" }` | `validTo` ≥ `validFrom` del rol y ≤ su `validTo` vigente |
| P-18 | `{ "code", "kindCode", "name", "taxEstablishmentCode", "isPrincipal", "address" }` | `code` como el de la Party, único dentro de ella y no reutilizable (`INV-PTY-08`); `name` 1 a 200; `taxEstablishmentCode` cuatro dígitos (supuesto, [G-576](../../GAPS.md)); `address` con `line1` y `countryCode` obligatorios, mismas longitudes que la dirección de [DOM-MDM-001](../02-diseno/modelo-dominio-cliente-mdm-001.es.md) |
| P-19 | Igual que P-18 sin `code` | `code` es inmutable |
| R-02 | `{ "fromPartyId", "toPartyId", "kindCode", "validFrom", "validTo" }` | El sentido lo fija el tipo: `PARENT_OF` va de la matriz a la filial |
| R-04 | `{ "validTo", "reason" }` | Como P-15 |
| X-02 | `{ "systemCode", "systemInstance", "externalObjectType", "externalKey", "mdmObjectType", "mdmObjectId" }` | `mdmObjectType` ∈ {`PARTY`, `ESTABLISHMENT`}; la respuesta añade `partyId` (el dueño del establecimiento) y nace con `syncStatus` `Linked` |

### 5.4 Tipo de rol (C-02, C-05 a C-08)

| Campo | Regla |
| :--- | :--- |
| `code` | Solo en C-05. Se normaliza (recorte, mayúsculas invariantes, espacios y guiones por `_`) y debe cumplir `^[A-Z][A-Z0-9_]{1,49}$`: si no, `422` `party_role_type.code_invalid`; vacío, `400`. Único entre todos los tipos, activos o no (`409` `party_role_type.code_duplicate`) |
| `name` | Obligatorio; 1 a 200 tras recortar |
| `description` | Opcional; hasta 500; vacío tras recortar es `null` |
| `unEdifact3035Code` | Opcional; se recorta y pasa a mayúsculas; dos letras (`422` `party_role_type.edifact_invalid`) |
| `allowedPartyTypes` | Al menos uno de `ORGANIZATION` y `PERSON`, sin repetir (`400`) |
| `requiresFiscalIdentifier` | Obligatorio; con `true`, P-02 y P-12 exigen un identificador fiscal vigente (`INV-PTY-06`) |

La lectura (C-02) devuelve además `isActive`, `version` y la auditoría (`createdAt`, `createdBy`, `updatedAt`, `updatedBy`). La respuesta de C-05 es `{ "code": "…", "version": 1 }` con `Location` y `ETag`.

Lectura de relación: `id`, `fromPartyId`, `toPartyId`, `kindCode`, `validFrom`, `validTo`, `isCurrent`, `status` (`Active` o `Ended`), `version` y auditoría. Lectura de referencia externa: los campos de X-02 más `id`, `partyId`, `syncStatus` (`Linked`, `PendingSync`, `SyncFailed`, `Unlinked`), `lastSyncedVersion`, `version` y auditoría.

## 6. Errores de negocio

### 6.1 Catálogo de `code`

Formato `<recurso>.<regla>` o `<recurso>.<subrecurso>.<regla>`, segmentos en `snake_case`, como los `code` publicados para Tenant (`tenant.code_not_unique`). Un `code` publicado no cambia de significado.

| `code` | HTTP | Invariante o regla | Cuándo |
| :--- | :--- | :--- | :--- |
| `party.person_not_supported` | `422` | [G-534](../../GAPS.md) | Alta con `type` = `PERSON` |
| `party.code_not_unique` | `409` | `INV-PTY-07` | El `code` ya existe, aunque la Party esté archivada |
| `party.archived` · `party.merged` | `409` | `INV-PTY-11` | Cualquier escritura sobre una Party terminal o sus subrecursos |
| `party.already_active` · `party.already_suspended` | `409` | Ciclo de vida | `activate` sobre `Active`; `suspend` sobre `Suspended` |
| `party.not_active` | `409` | Política de estado (§6.2) | Asignar o reactivar un rol, abrir o reactivar un establecimiento con la Party `Suspended` |
| `party.identifier.scheme_unknown` | `422` | `INV-PTY-04` | Esquema inexistente, inactivo o de otro país |
| `party.identifier.scheme_not_allowed` | `422` | `INV-PTY-04` | Esquema no admitido para el `type` de la Party (p. ej. un DNI en una organización) |
| `party.identifier.invalid_format` | `422` | `INV-PTY-04` | El valor no cumple el patrón del esquema |
| `party.identifier.check_digit_invalid` | `422` | `INV-PTY-04` | RUC con dígito verificador incorrecto |
| `party.identifier.duplicate` | `409` | `INV-PTY-02` | El identificador ya pertenece a otra Party (o a esta), incluso vencido, archivada o fusionada |
| `party.identifier.primary_exists` | `409` | `INV-PTY-03` | Primario nuevo sin `replacesPrimary` cuando ya hay uno vigente |
| `party.identifier.primary_required` | `409` | `INV-PTY-03` | Vencer el primario vigente sin sucesor |
| `party.identifier.fiscal_required` | `409` | `INV-PTY-06` | Vencer el último identificador fiscal vigente con `INTERNAL_COMPANY` vigente |
| `party.identifier.already_expired` | `409` | Vigencia | Vencer un identificador ya vencido |
| `party.role.type_unknown` | `422` | Catálogo | Tipo de rol inexistente |
| `party.role.type_not_allowed` | `422` | `INV-PTY-06` | Tipo de rol no admitido para el `type` de la Party |
| `party.role.fiscal_identifier_required` | `409` | `INV-PTY-06` | `INTERNAL_COMPANY` sin identificador fiscal vigente |
| `party.role.overlap` | `409` | `INV-PTY-05` | Otro rol del mismo tipo, no terminado, se solapa en vigencia |
| `party.role.already_active` · `party.role.already_suspended` · `party.role.terminated` | `409` | Ciclo del rol | Transición no válida |
| `establishment.kind_unknown` | `422` | Catálogo | Tipo inexistente o inactivo |
| `establishment.kind_not_supported` | `422` | [G-547](../../GAPS.md) | `WAREHOUSE` en la primera entrega |
| `establishment.code_not_unique` | `409` | `INV-PTY-08` | El `code` ya existe en la Party, aunque esté cerrado |
| `establishment.principal_exists` | `409` | `INV-PTY-09` | Otro establecimiento activo ya es el principal |
| `establishment.already_active` · `establishment.already_inactive` · `establishment.closed` | `409` | `INV-PTY-10` | Transición no válida o escritura sobre uno cerrado |
| `party_relationship.self_reference` | `422` | `INV-PTY-12` | `fromPartyId` = `toPartyId` |
| `party_relationship.kind_unknown` | `422` | Catálogo | Tipo de relación inexistente o inactivo |
| `party_relationship.party_not_found` | `422` | Referencia por id | Una de las Parties del cuerpo no existe |
| `party_relationship.party_not_active` | `409` | `INV-PTY-11` | Una de las Parties está archivada o fusionada |
| `party_relationship.overlap` | `409` | `INV-PTY-12` | Ya hay una relación del mismo tipo y sentido con vigencia solapada |
| `party_relationship.already_ended` | `409` | Ciclo | Terminar una relación ya terminada |
| `external_reference.target_not_found` | `422` | Referencia por id | El objeto de MDM no existe |
| `external_reference.target_not_active` | `409` | `INV-PTY-11`, `INV-PTY-10` | Party archivada o fusionada, o establecimiento cerrado |
| `external_reference.key_duplicate` | `409` | `INV-PTY-13` | La clave externa ya apunta a un objeto, aunque esté desvinculada ([G-574](../../GAPS.md)) |
| `external_reference.already_unlinked` | `409` | Ciclo | Desvincular una ya desvinculada |
| `party_role_type.code_duplicate` | `409` | Código no reutilizable (D-046) | C-05 con un código que ya existe, aunque el tipo esté desactivado |
| `party_role_type.code_invalid` | `422` | Formato del código (D-046) | El código normalizado no cumple `^[A-Z][A-Z0-9_]{1,49}$` |
| `party_role_type.edifact_invalid` | `422` | UN/EDIFACT 3035 (D-046) | El código UN/EDIFACT no son dos letras mayúsculas |
| `party_role_type.inactive` | `409` | Tipo desactivado (D-046) | P-02 o P-12 con un tipo de rol desactivado |
| `party_role_type.already_active` · `party_role_type.already_inactive` | `409` | Ciclo del tipo | C-08 sobre un tipo activo; C-07 sobre uno desactivado |

Códigos transversales, heredados sin cambio del contrato de Tenant: `validation.failed` y `request.malformed` (`400`), `auth.unauthenticated` y `auth.user_required` (`401`), `auth.forbidden` (`403`), `common.not_found` (`404`), `request.method_not_allowed` (`405`), `precondition.failed` (`412`), `request.unsupported_media_type` (`415`), `precondition.required` (`428`) y `server.unexpected_error` (`500`).

**`422` frente a `409`.** `422` es «el valor no es admisible» —lo decide el catálogo o una regla sin estado—; `409` es «choca con el estado actual o con otro dato». Repetir la petición tras cambiar el estado puede convertir un `409` en éxito; un `422`, nunca.

### 6.2 Política de estado de la Party sobre sus partes

| Estado de la Party | Admite | Rechaza |
| :--- | :--- | :--- |
| `Active` | Todo | — |
| `Suspended` | Editar nombres, añadir y vencer identificadores, suspender y terminar roles, editar, desactivar y cerrar establecimientos, `activate`, archivar | Asignar o reactivar roles, abrir o reactivar establecimientos: `409` `party.not_active` |
| `Archived`, `Merged` | Solo lectura | Toda escritura: `409` `party.archived` o `party.merged` |

`Archived` es más estricto que el Tenant archivado, que aún admitía desactivar y cerrar sedes: `INV-PTY-11` dice que no se modifica. Archivar **no** termina roles ni cierra establecimientos en cascada; los consumidores leen el `status` de la Party. Si debe cascadear sigue abierto ([G-572](../../GAPS.md)).

### 6.3 Ejemplo

```http
POST /api/v1/parties/0b9c7e0e-2f4a-4c39-9a51-1f0d7a3e9c11/roles HTTP/1.1
Authorization: Bearer <portador>
If-Match: "7"
Content-Type: application/json

{ "roleTypeCode": "CUSTOMER", "validFrom": "2026-11-01", "validTo": null }
```

```http
HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{
  "type": "https://httpwg.org/specs/rfc9110.html#status.409",
  "title": "El rol se solapa con otro del mismo tipo",
  "status": 409,
  "detail": "La Party ya tiene un rol CUSTOMER vigente en ese periodo.",
  "instance": "/api/v1/parties/0b9c7e0e-2f4a-4c39-9a51-1f0d7a3e9c11/roles",
  "code": "party.role.overlap"
}
```

## 7. Estados HTTP

| Estado | Cuándo |
| :--- | :--- |
| `200` | Lectura correcta |
| `201` | Alta de Party, identificador, rol, establecimiento, relación, referencia externa o tipo de rol |
| `204` | Escritura correcta sin cuerpo; devuelve el `ETag` nuevo |
| `304` | `If-None-Match` coincide |
| `400` | Forma inválida (`validation.failed`), JSON ilegible (`request.malformed`) o `If-Match` mal formado |
| `401` | Sin portador válido, o escritura sin claim `sub` |
| `403` | Reservado para la autorización (§8) |
| `404` | El recurso de la **ruta** no existe; un id inexistente en el **cuerpo** es `422` |
| `405`, `415` | Los emite el framework |
| `409` | Conflicto con el estado o con la unicidad (§6.1) |
| `412` | La versión cambió |
| `422` | Valor que el catálogo o una regla sin estado no admite (§6.1) |
| `428` | Falta `If-Match` |
| `500` | Error no controlado |

## 8. Seguridad

- **Autenticación.** Portador JWT **RS256** contra el JWKS de UMS ([ADR-0157](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0157-firma-asimetrica-portador-ums-jwks.es.md), `Aceptado`), con emisor y audiencia explícitos y desfase de 30 s, igual que hoy. El emisor real sigue sin confirmar ([G-315](../../GAPS.md)). El actor de auditoría es el claim `sub`.
- **Autorización: pendiente.** Basta estar autenticado, lo que hoy deja a todo portador válido escribir en el maestro de la suite. Faltan el permiso por operación y el ámbito por organización ([G-314](../../GAPS.md)) y la regla ABAC por establecimiento, con un permiso aparte para vincular el ERP ([G-536](../../GAPS.md)), a conceder por UMS ([ADR-0230](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0230-sesion-por-portador-carril-satelite-ums.es.md) y [ADR-0010](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0010-estrategia-arquitectura-multitenant.es.md), `Aceptado`). `403` `auth.forbidden` queda reservado. Mientras falte, la búsqueda por identificador y el `409` `party.identifier.duplicate` revelan qué identificadores existen ([G-577](../../GAPS.md)).
- **Sin datos personales en los registros** ([ADR-0193](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0193-el-dato-personal-no-llega-al-log.es.md), `Aceptado`). No se registran cuerpos de petición ni de respuesta, ni los parámetros `identifierValue`, `search` y `externalKey`; el valor de un identificador nunca viaja en la ruta (§3.2). Hoy solo hay organizaciones, pero la regla se fija ya para que habilitar `PERSON` no obligue a cambiar el contrato.

## 9. Trazabilidad: endpoint → invariante → evento

Los eventos de dominio son los de [DOM-MDM-002 §7](../02-diseno/modelo-dominio-organizacion-erp-mdm-002.es.md#7-eventos-de-dominio-y-contrato-de-integración); cada uno lleva el id y la `version` posterior. Los marcados como **propuesta** no están en DOM-MDM-002 ([G-570](../../GAPS.md), [G-574](../../GAPS.md)). Nada se publica hasta que haya outbox ([G-312](../../GAPS.md)).

| Endpoint | Invariantes que comprueba | Evento de dominio |
| :--- | :--- | :--- |
| P-02 | `INV-PTY-01`, `02`, `03`, `04`, `05`, `06`, `07` | `PartyRegistered` (+ `PartyRoleAssigned` por rol inicial) |
| P-04 | `INV-PTY-11` | `PartyRenamed` |
| P-05 · P-06 | `INV-PTY-11` | `PartySuspended` · `PartyActivated` |
| P-07 | `INV-PTY-11` | `PartyArchived` |
| P-09 | `INV-PTY-02`, `03`, `04`, `11` | `PartyIdentifierAdded` (+ `PartyIdentifierExpired` si `replacesPrimary`) |
| P-10 | `INV-PTY-03`, `06`, `11` | `PartyIdentifierExpired` |
| P-12 | `INV-PTY-05`, `06`, `11` | `PartyRoleAssigned` |
| P-13 | `INV-PTY-11` | `PartyRoleSuspended` |
| P-14 | `INV-PTY-05`, `11` | `PartyRoleReactivated` (**propuesta**) |
| P-15 | `INV-PTY-11` | `PartyRoleTerminated` |
| P-18 | `INV-PTY-08`, `09`, `11` | `EstablishmentOpened` |
| P-19 | `INV-PTY-09`, `10`, `11` | `EstablishmentChanged` |
| P-20 · P-21 | `INV-PTY-09`, `10`, `11` | `EstablishmentDeactivated` · `EstablishmentReactivated` |
| P-22 | `INV-PTY-10`, `11` | `EstablishmentClosed` |
| R-02 | `INV-PTY-12` (+ Parties existentes y no terminales, lectura no transaccional) | `PartyRelationshipStarted` |
| R-04 | — | `PartyRelationshipEnded` |
| X-02 | `INV-PTY-13` | `ExternalReferenceLinked` (**propuesta**) |
| X-04 | — | `ExternalReferenceUnlinked` (**propuesta**) |
| C-05 · C-06 | Código no reutilizable, formato del código y del UN/EDIFACT (D-046) | Sin evento: el catálogo no publica eventos en esta versión |
| C-07 · C-08 | — | Sin evento |

## 10. Qué conserva y qué cambia respecto del contrato de Tenant y Branch

| Aspecto | Se conserva | Cambia |
| :--- | :--- | :--- |
| Base | `/api/v1`, `camelCase`, instantes con milisegundos, portador RS256, `sub` como actor | — |
| Errores | Problem Details con `code` y `errors` de un solo campo; códigos transversales | Prefijos `party.*`, `establishment.*`, `party_relationship.*`, `external_reference.*`; aparece **`422`** para valores inadmisibles, que Tenant resolvía con `400` (`tenant.parent_not_found`) |
| Concurrencia | `ETag` = versión entera fuerte; `428`, `400` y `412`; `If-None-Match` → `304`; el hijo comparte la versión del padre (sede ↔ establecimiento) | Relaciones y referencias externas tienen **versión propia** |
| Borrado | `DELETE` archiva la Party y cierra el establecimiento, ambos terminales | `DELETE` de una referencia externa la desvincula |
| Claves | `code` normalizado, ≤ 100, inmutable y no reutilizable; nombres ≤ 200 | `name` → `legalName` + `tradeName` |
| Modelo | — | `organizationType` → roles con vigencia; `companyReference` → identificadores y referencias externas; `parentTenantId` → `PartyRelationship` `PARENT_OF` |
| Estado | `Active` ⇄ `Suspended`; activo e inactivo independientes de cerrado | Una Party archivada no admite **ninguna** escritura (§6.2); ya no se exige desactivar establecimientos antes de suspender |
| Paginación | Desplazamiento con `page`/`pageSize`, `sortBy`/`sortOrder` | Filtros nuevos: rol, tipo e identificador |
| Altas | `201` + `Location` + `ETag` con `{ id, version }` | — |

## 11. Trazabilidad a ADR

| ADR | Estado | Qué sostiene aquí |
| :--- | :--- | :--- |
| [ADR-0041](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/dotnet/0041-arquitectura-backend-canonica-dotnet.es.md) | `Aceptado` | Backend .NET con Minimal API y Problem Details |
| [ADR-0098](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0098-comunicacion-entre-agregados-intra-servicio.es.md) | `Aceptado` | Un agregado por transacción; versiones separadas de relación y referencia |
| [ADR-0097](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0097-integracion-entre-sistemas-suite-eventos-xms.es.md) | `Aceptado` | El ERP queda detrás del ACL de XMS; el contrato es del emisor |
| [ADR-0157](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0157-firma-asimetrica-portador-ums-jwks.es.md) | `Aceptado` | Portador RS256 con JWKS |
| [ADR-0193](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0193-el-dato-personal-no-llega-al-log.es.md) | `Aceptado` | Sin datos personales en registros |
| [ADR-0230](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0230-sesion-por-portador-carril-satelite-ums.es.md) · [ADR-0010](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0010-estrategia-arquitectura-multitenant.es.md) | `Aceptado` | La autorización la concede UMS; la sucursal es contexto de autorización |
| [ADR-MDM-001](../../reference/architecture/adrs/MDM-001-nomenclatura-y-conceptos-no-portables-de-mdm.es.md) | `Borrador` (local) | Versión entera como `ETag`; no vincula, se conserva como regla de D-031 |
| [ADR-0164](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0164-el-borrado-es-logico-y-la-clave-natural-no-se-reutiliza.es.md) | `Borrador` | No vincula; el borrado lógico es regla local de D-031 ([G-324](../../GAPS.md)) |

ADR-0264 y ADR-0265 están aceptados en `develop` de `organizacion_arch` pero **no** en la versión vinculada del plugin; se citan como contexto de D-043, no como norma ([G-554](../../GAPS.md)).

## 12. Gaps propuestos

| Gap | Resumen |
| :--- | :--- |
| [G-570](../../GAPS.md) | El contrato añade a DOM-MDM-002 identidad local para identificadores y roles, reactivar rol (`PartyRoleReactivated`) y reemplazo atómico del primario |
| [G-571](../../GAPS.md) | No existen en el plugin vinculado los ADR de paginación por cursor ni de `If-Match` que se esperaban; el listado de Parties pagina por desplazamiento |
| [G-572](../../GAPS.md) | Política de estado de la Party sobre roles y establecimientos (cascada al archivar, suspender con establecimientos activos) sin decidir en DOM-MDM-002 |
| [G-573](../../GAPS.md) | `422` y los nuevos prefijos de `code` no son regla escrita de MDM |
| [G-574](../../GAPS.md) | Referencia externa sin eventos, sin endpoint de acuse de XMS y sin regla de re-vinculación |
| [G-575](../../GAPS.md) | Zona horaria de «hoy» y semántica inclusiva de `validTo`, supuestas |
| [G-576](../../GAPS.md) | Formato y unicidad del código de establecimiento anexo de SUNAT, supuestos |
| [G-577](../../GAPS.md) | Enumeración de identificadores sin autorización y registro de parámetros con dato personal |
| [G-578](../../GAPS.md) | El OpenAPI escrito a mano no tiene prueba de contrato contra el mock ni contra la implementación futura |
| [G-579](../../GAPS.md) | No hay verbo para prorrogar o corregir la vigencia de un rol o una relación |

## 13. Historial de cambios (bitácora)

| Versión | Fecha | Autor | Cambios |
| :--- | :--- | :--- | :--- |
| 0.2.0 | 2026-10-24 | Agente `organizacion-dev-frontend` | Mantenimiento del catálogo de tipos de rol ([D-046](../../DECISIONS.md#decisiones-locales)): §3.6 con C-05 a C-08 y versión propia por tipo, §5.4 con las reglas del tipo (`description`, `version` y auditoría en la lectura), códigos `party_role_type.*` en §6.1 y `party_role_type.inactive` al asignar un tipo desactivado; `party.role.type_unknown` queda para el tipo inexistente. OpenAPI 0.2.0 |
| 0.1.1 | 2026-10-24 | aarroyo | Aprobada por el propietario como base de la implementación de `mdm-app` contra el mock ([D-044](../../DECISIONS.md#decisiones-locales), paso 4) |
| 0.1.0 | 2026-10-24 | Agente `organizacion-dev-backend-dotnet` | Versión inicial en `Borrador`: 34 endpoints de Party, identificadores, roles, establecimientos, relaciones, referencias externas y catálogos; versión de la Party como `ETag` de todos sus subrecursos; catálogo de `code` por invariante con `422`; OpenAPI 3.1 como fuente del mock ([D-043](../../DECISIONS.md#decisiones-locales), [D-044](../../DECISIONS.md#decisiones-locales)) |

---

<p align="center">
  <strong>© Organización S.A.</strong> · RUC 20100412447 · Operador Logístico Aduanero desde 1978
</p>
