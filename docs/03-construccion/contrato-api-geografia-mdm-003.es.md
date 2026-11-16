# Contrato de la API — geografía de la suite (Geography) de MDM

<p align="right">
  <img src="https://img.shields.io/badge/ORG%20S.A.-Operador_Log%C3%ADstico_Aduanero-0f3e67?style=for-the-badge&logoColor=white" alt="Organización S.A.">
  <img src="https://img.shields.io/badge/Estado-Borrador-825500?style=flat-square" alt="Estado">
  <img src="https://img.shields.io/badge/Versi%C3%B3n-0.1.0-042139?style=flat-square" alt="Versión">
</p>

> **Código:** `API-MDM-003`
> **Fase:** 3 — Construcción (diseño de contrato; **sin implementación**)
> **Sistema:** MDM, contexto `Geography`, alojado provisionalmente en este satélite ([D-027](../../DECISIONS.md#decisiones-locales), [G-257](../../GAPS.md))
> **Deriva de:** [PRD-MDM-002](../01-concepcion/prd-mdm-002.es.md) · [ADR-MDM-002](../../reference/architecture/adrs/MDM-002-modelo-geografico-de-la-suite.es.md) (`Borrador`, detalle local de implementación) · [ADR-0266](https://github.com/organizacion-peru/organizacion-arch/blob/main/reference/architecture/adrs/core/0266-la-geografia-de-la-suite-es-un-maestro-de-mdm-con-codigos-oficiales.es.md) (`Aceptado`, núcleo)
> **Decisiones que lo enmarcan:** [D-047](../../DECISIONS.md#decisiones-locales) (alcance de la geografía) y [D-048](../../DECISIONS.md#decisiones-locales) (ubigeo INEI canónico, ISO 3166-1 alfa-2 y UN/LOCODE, revisión humana de sucesiones e importaciones, uso interno por licencias, responsable del catálogo)
> **Modelo de datos:** [MD-MDM-003](../02-diseno/modelo-datos-geografia-mdm-003.es.md)
> **Documento máquina:** [OpenAPI 3.1](./openapi-geografia-mdm-003.yaml), fuente del mock del frontend
> **Estado:** Borrador. No se construye mientras ADR-MDM-002 siga en `Borrador` ([D-047](../../DECISIONS.md#decisiones-locales), consecuencia 3). Hub del área: [MDM — Datos Maestros](../02-diseno/hub-mdm.es.md)

---

**Convención de idioma.** La prosa está en español (SD-08). Rutas, campos JSON, enumeraciones, eventos y valores de `code` van en inglés ([D-025](../../DECISIONS.md#decisiones-locales)).

**Fuente de verdad.** Este documento fija las reglas y su porqué; el [OpenAPI](./openapi-geografia-mdm-003.yaml) fija la forma exacta (tipos, longitudes, enumeraciones). Si discrepan, es un defecto de este Borrador y se corrigen los dos a la vez.

**Qué vincula.** La norma es [ADR-0266](https://github.com/organizacion-peru/organizacion-arch/blob/main/reference/architecture/adrs/core/0266-la-geografia-de-la-suite-es-un-maestro-de-mdm-con-codigos-oficiales.es.md) (`Aceptado`), con sus decisiones D1 a D8. [ADR-MDM-002](../../reference/architecture/adrs/MDM-002-modelo-geografico-de-la-suite.es.md) está en `Borrador`: sus D1 a D12 se citan como **trazabilidad de diseño**, no como norma (SD-03). Lo que este contrato añade a ambos está marcado como **propuesta** y tiene su gap en §11.

## 1. Alcance

Primera etapa de [PRD-MDM-002](../01-concepcion/prd-mdm-002.es.md) (requisitos **Must** y **Should**):

| Dentro | Fuera |
| :--- | :--- |
| Países ISO 3166-1 (alfa-2 canónico, alfa-3 y numérico) y su **política territorial**: escalera de niveles y uso del código postal | Coordenadas de cada dirección y geocodificación (RF-GEO-015, RF-GEO-016): etapa posterior, con ADR de proveedor ([G-614](../../GAPS.md)) |
| Divisiones administrativas de cualquier país; en el Perú, departamento, provincia y distrito con ubigeo INEI canónico | Búsqueda por proximidad (MDM-002 D11): reservada para la etapa posterior |
| Búsqueda por código de cualquier esquema, por nombre normalizado, por prefijo de ruta, por padre y «tal como era» en una fecha | Lugares de tipo `Locality` (centros poblados, ciudades de GeoNames): el alta responde `422` `geo.place.type_not_supported` (PRD §5.2) |
| Nombres oficiales, alternativos y transliterados por idioma | La dirección como dato de la organización (calle, número): sigue en [API-MDM-002](./contrato-api-party-mdm-002.es.md); su paso a `geoPlaceId` es [G-615](../../GAPS.md) |
| Códigos oficiales con esquema, autoridad, vigencia y fuente; correspondencias entre esquemas | Publicación de `GeoPlaceEvent` (se describe en §9; no se emite hasta que haya outbox, [G-312](../../GAPS.md)) |
| Sucesión territorial con revisión humana y lista de direcciones afectadas | Códigos propios de aduanas (aduana, depósito temporal de SUNAT), PRD §5.2 |
| Lugares de comercio exterior UN/LOCODE (funciones, estado UNECE) y lugares propios `ORG-SITE` | Exportación masiva del catálogo a terceros: la hace XMS ([ADR-0097](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0097-integracion-entre-sistemas-suite-eventos-xms.es.md), `Aceptado`) |
| Zonas postales con relación M:N a lugares | — |
| Importación de catálogos oficiales en tres capas: lote, diferencias, aprobación | — |
| Catálogo de esquemas de código y registro de fuentes con su licencia | — |

## 2. Reglas comunes

Se conservan las de [API-MDM-002](./contrato-api-party-mdm-002.es.md) §2 salvo donde esta sección dice otra cosa.

| Regla | Contrato |
| :--- | :--- |
| Prefijo | `/api/v1/geo` |
| Formato | `application/json` en UTF-8, campos en `camelCase`. Instantes en ISO 8601 con milisegundos y desfase; fechas de vigencia como `date`. La subida de un lote de importación es `multipart/form-data` (§3.8) |
| Identificadores | `placeId`, `codeId`, `nameId`, `correspondenceId`, `successionId`, `reviewId`, `postalZoneId`, `importId` y `diffId` son UUID asignados por el servidor; un valor que no es UUID en la ruta responde `404`. El país se identifica en la ruta por su **alfa-2** (`/countries/PE`); el esquema de código por su `code` (`/code-schemes/UBIGEO-INEI`) y la fuente por el suyo (`/sources/INEI`) |
| Errores | Problem Details ([RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)) con `type`, `title`, `status`, `detail`, `instance` y la extensión **`code`**; los `400` añaden `errors` con un solo campo. Prefijo `geo.` (§6) |
| Respuestas de escritura | Alta: `201` + `Location` + `ETag` y cuerpo `{ "id", "version" }`. Resto: `204` + `ETag` nuevo. Excepciones: aprobar una sucesión responde `200` con la lista de direcciones afectadas (SU-04); subir y aprobar un lote responden `202` porque el trabajo sigue en segundo plano (IM-02, IM-06) |
| Motivo | Las acciones (`deactivate`, `reactivate`, `move`, `expire`, `reject`, `resolve`) aceptan `{ "reason" }` de hasta 500 caracteres; en `move`, `reject` y la corrección del nombre oficial es **obligatorio**, porque cambian algo que otros ya usan |
| Normalización de códigos oficiales | Recorte, mayúsculas invariantes y sin espacios internos (`PE CLL` → `PECLL`). Después, el valor debe cumplir el `valuePattern` de su esquema (§5.7) |
| Normalización de nombres para buscar | Recorte, espacios colapsados, mayúsculas invariantes y **sin diacríticos** (descomposición NFD y descarte de marcas): `Áncash` → `ANCASH`, `Ñuñoa` → `NUNOA`. El nombre oficial se guarda y se devuelve **tal cual**, con tildes (RNF-GEO-03) |
| Vigencias | Intervalo cerrado `[validFrom, validTo]`; `validTo` `null` es indefinido. «Hoy» se calcula en `America/Lima` (supuesto heredado, [G-575](../../GAPS.md)) y se publica como `isCurrent` |
| Fecha de consulta | `asOf` (`date`) en las lecturas devuelve el catálogo **tal como era** ese día: lugares, códigos, nombres y padres vigentes en esa fecha (RF-GEO-009). Ausente, hoy |
| Nada se borra | No hay `DELETE` en este contrato. Un lugar se desactiva o pasa a `Historical` por sucesión; un código, un nombre, una correspondencia o una zona postal se **vencen** (RN-GEO-02) |

### 2.1 Concurrencia optimista: qué versión protege cada escritura

**Una transacción, un agregado** ([ADR-0098](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0098-comunicacion-entre-agregados-intra-servicio.es.md), `Aceptado`): toda mutación sube la `version` entera del agregado, que es su `ETag` y la `sequence` de su evento (MDM-002 D3, `Borrador`; misma regla que [ADR-MDM-001](../../reference/architecture/adrs/MDM-001-nomenclatura-y-conceptos-no-portables-de-mdm.es.md) D4, `Borrador`).

| Agregado | Recursos HTTP que lo mutan | `ETag` |
| :--- | :--- | :--- |
| `GeoPlace` (incluido el país como lugar y el lugar de comercio) | `/places/{placeId}` y sus subrecursos `official-name`, `names`, `codes`, `geo-reference`, `move`, `deactivate`, `reactivate`; `/countries/{countryCode}` (PUT); `/trade-locations/{placeId}/trade-attributes` | `version` del lugar. Nombres, códigos y funciones **no tienen versión propia** |
| `CountryTerritorialSchema` | `/countries/{countryCode}/territorial-schema` | `version` propia. Cambiar la escalera **no** sube la versión del lugar país, y viceversa (MDM-002 D2: es un agregado de política aparte) |
| `CodeScheme` | `/code-schemes/{schemeCode}` y sus acciones | `version` propia por esquema |
| `CodeCorrespondence` | `/code-correspondences/{correspondenceId}/expire` | `version` propia |
| `Succession` | `/successions/{successionId}` y sus acciones, incluida la resolución de direcciones afectadas | `version` propia. Aprobarla **no** escribe en los lugares en la misma transacción (§3.5) |
| `PostalZone` | `/postal-zones/{postalZoneId}` y sus acciones | `version` propia. Asignar lugares a una zona no sube la versión de esos lugares |
| `ImportBatch` | `/imports/{importId}` y sus acciones, incluidas las decisiones sobre diferencias | `version` propia del lote |
| `SourceLicense` | `/sources/{sourceCode}/license` | `version` propia por fuente |
| Colecciones completas (países, esquemas, fuentes) | Solo lectura | `ETag` de la colección, para `304` |

Reglas de `If-Match`, idénticas a las de API-MDM-002 §2.1:

- Toda escritura sobre un recurso existente exige `If-Match` con el `ETag` vigente del agregado de la tabla. Las que **crean un agregado** no lo llevan: `POST /countries`, `POST /places`, `POST /trade-locations`, `POST /trade-locations/{placeId}/sites`, `POST /code-correspondences`, `POST /successions`, `POST /postal-zones`, `POST /imports`, `POST /code-schemes` y `POST /sources`. Crear un lugar hijo **lee** el padre pero no lo escribe: por eso no exige el `ETag` del padre.
- **Declarar la escalera de un país por primera vez** es un `PUT` con `If-None-Match: *` (crea, `201`); cambiarla, un `PUT` con `If-Match` (`204`). Un `If-None-Match: *` sobre una escalera ya declarada responde `412` `precondition.failed`; sin ninguna de las dos cabeceras, `428`.
- Sin `If-Match`, vacío o `*`: `428` `precondition.required`. Mal formado: `400` `validation.failed` con `errors["If-Match"]`. Distinto, o si otra escritura confirma antes: `412` `precondition.failed`. `If-Match` se evalúa antes que el cuerpo.
- `GET` con `If-None-Match` igual al `ETag` responde `304`.

### 2.2 Orden de evaluación

`401` → `403` (permiso, §8) → `428` → `400` → `404` (recurso de la ruta) → `412` → `422` (valor que el catálogo o una regla sin estado no admite) → `409` (conflicto con el estado o con la unicidad). A diferencia de API-MDM-002, el `403` va antes que la forma: el permiso no depende del cuerpo.

## 3. Endpoints

Rutas relativas a `/api/v1/geo`. La columna **Permiso** usa los tres niveles de §8: **L** leer, **M** mantener, **A** aprobar (responsable del catálogo). `If-Match` indica **de qué agregado** es la versión exigida. Todos responden además `401` y `403`.

### 3.1 Países y política territorial

| # | Método y ruta | Propósito | Permiso | `If-Match` | Éxito | Errores |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CO-01 | `GET /countries` | Lista completa de países; filtros `status`, `search` | L | — | `200` + `ETag`; `304` | `400` |
| CO-02 | `POST /countries` | Alta de un país con sus tres códigos ISO 3166-1; crea el lugar de tipo `Country` | A | No | `201` | `400`, `409`, `422` |
| CO-03 | `GET /countries/{countryCode}` | Ficha del país: códigos, nombres, estado y resumen de su escalera | L | — | `200` + `ETag`; `304` | `404` |
| CO-04 | `PUT /countries/{countryCode}` | Cambia `officialName` y `englishName` | A | Lugar | `204` | `400`, `404`, `409`, `412`, `428` |
| CO-05 | `GET /countries/{countryCode}/territorial-schema` | Escalera de niveles y política de código postal | L | — | `200` + `ETag`; `304` | `404` (`geo.country.schema_not_declared` si no se declaró) |
| CO-06 | `PUT /countries/{countryCode}/territorial-schema` | Declara (`If-None-Match: *`) o cambia (`If-Match`) la escalera y la política postal | A | Escalera | `201` / `204` | `400`, `404`, `409`, `412`, `422`, `428` |

El país se busca por alfa-2 aunque esté `Historical`: un documento antiguo sigue resolviendo su país (RF-GEO-002). `countryCode` en la ruta es el alfa-2 **vigente o vencido**; un alfa-2 que nunca existió responde `404`.

### 3.2 Lugares

| # | Método y ruta | Propósito | Permiso | `If-Match` | Éxito | Errores |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PL-01 | `GET /places` | Búsqueda por nombre, prefijo de ruta, padre, país, tipo, nivel, estado y fecha (§4) | L | — | `200` | `400`, `403` (`geo.license.restricted`) |
| PL-02 | `GET /places/resolve` | Resuelve un código exacto (`scheme` opcional + `value`) a **un** lugar, aunque esté desactivado, sea histórico o el código esté vencido; devuelve sus sucesores | L | — | `200` | `400`, `403`, `404` |
| PL-03 | `POST /places` | Alta de una división administrativa con su código canónico | M | No | `201` | `400`, `409`, `422` |
| PL-04 | `GET /places/{placeId}` | Ficha con `view` = `minimal`, `path` (defecto) o `full` | L | — | `200` + `ETag`; `304` | `400`, `404` |
| PL-05 | `PUT /places/{placeId}/official-name` | Corrige el nombre oficial en un idioma; el anterior queda como nombre `Historical` vencido | M | Lugar | `204` | `400`, `404`, `409`, `412`, `428` |
| PL-06 | `GET /places/{placeId}/names` | Nombres oficiales, alternativos e históricos | L | — | `200` + `ETag`; `304` | `404` |
| PL-07 | `POST /places/{placeId}/names` | Añade un nombre alternativo, transliterado, corto o de comercio internacional | M | Lugar | `201` | `400`, `404`, `409`, `412`, `422`, `428` |
| PL-08 | `POST /places/{placeId}/names/{nameId}/expire` | Vence un nombre no oficial | M | Lugar | `204` | `400`, `404`, `409`, `412`, `428` |
| PL-09 | `POST /places/{placeId}/deactivate` | Desactiva (reversible): no se ofrece para direcciones ni documentos nuevos | M | Lugar | `204` | `404`, `409`, `412`, `428` |
| PL-10 | `POST /places/{placeId}/reactivate` | Reactiva un lugar `Inactive` | M | Lugar | `204` | `404`, `409`, `412`, `428` |
| PL-11 | `GET /places/{placeId}/history` | Histórico del lugar: bitácora de cambios con actor, fuente y lote, y sucesiones en que participa | L | — | `200` | `400`, `404` |
| PL-12 | `POST /places/{placeId}/move` | Reubica el padre para **corregir un error de carga**; solo lugares sin hijos | A | Lugar | `204` | `400`, `404`, `409`, `412`, `422`, `428` |
| PL-13 | `PUT /places/{placeId}/geo-reference` | Fija o corrige el punto de referencia (WGS 84) con su fuente | M | Lugar | `204` | `400`, `404`, `409`, `412`, `422`, `428` |

**`Historical` solo por sucesión** (propuesta, [G-621](../../GAPS.md)). Este contrato no ofrece un verbo para pasar un lugar a `Historical` directamente: lo hace la aplicación de una sucesión aprobada (§3.5), que deja la constancia de la norma legal y de los sucesores (MDM-002 D6). `Inactive` es el estado reversible que RF-GEO-007 pide y que MDM-002 D3 no nombra.

**Reubicar no es reasignar.** Un cambio territorial real (un distrito que pasa a otra provincia por ley) es una sucesión de tipo `Reassignment`. PL-12 solo corrige un padre mal cargado y exige que el lugar no tenga hijos (`409` `geo.place.has_children`): la ruta materializada de los descendientes cambiaría y eso tocaría más de un agregado.

### 3.3 Códigos oficiales del lugar

| # | Método y ruta | Propósito | Permiso | `If-Match` | Éxito | Errores |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CD-01 | `GET /places/{placeId}/codes` | Códigos del lugar, vigentes y vencidos, con autoridad, fuente y licencia | L | — | `200` + `ETag`; `304` | `404` |
| CD-02 | `POST /places/{placeId}/codes` | Añade un código de un esquema del catálogo | M | Lugar | `201` | `400`, `404`, `409`, `412`, `422`, `428` |
| CD-03 | `POST /places/{placeId}/codes/{codeId}/expire` | Vence un código con `validTo` (por defecto, hoy); el código sigue resolviendo | M; **A** si el esquema es canónico | Lugar | `204` | `400`, `404`, `409`, `412`, `428` |

Un código **no se edita ni se borra**: se corrige venciéndolo y añadiendo otro (RN-GEO-01). El par `(scheme, value)` pertenece a **un solo lugar para siempre**, incluso vencido (`409` `geo.code.duplicate`). Un lugar tiene a lo sumo **un código abierto** (`validTo` nulo) por esquema (`409` `geo.code.current_exists`).

### 3.4 Correspondencias entre códigos

| # | Método y ruta | Propósito | Permiso | `If-Match` | Éxito | Errores |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CR-01 | `GET /code-correspondences` | Lista; filtros `scheme` + `value` (en cualquier extremo), `kind`, `currentOnly` | L | — | `200` | `400` |
| CR-02 | `POST /code-correspondences` | Registra una correspondencia `Equivalent`, `PartOf` u `Overlaps` (MDM-002 D5) | M | No | `201` | `400`, `409`, `422` |
| CR-03 | `GET /code-correspondences/{correspondenceId}` | Una correspondencia | L | — | `200` + `ETag`; `304` | `404` |
| CR-04 | `POST /code-correspondences/{correspondenceId}/expire` | Vence una correspondencia | M | Correspondencia | `204` | `400`, `404`, `409`, `412`, `428` |

Ninguna correspondencia se deduce del código (RN-GEO-04): el ejemplo de RF-GEO-005 se registra así: `UBIGEO-INEI 1501` `Equivalent` `ISO-3166-2 PE-LMA`, y `ISO-3166-2 PE-LIM` `PartOf` `UBIGEO-INEI 15`.

### 3.5 Sucesiones territoriales

| # | Método y ruta | Propósito | Permiso | `If-Match` | Éxito | Errores |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SU-01 | `GET /successions` | Lista; filtros `status`, `type`, `placeId`, `effectiveFrom`, `effectiveTo` | L | — | `200` | `400` |
| SU-02 | `POST /successions` | Propone una sucesión (`Creation`, `Split`, `Merge`, `Rename`, `Recoding`, `Reassignment`) con su norma legal y fecha de efecto | M | No | `201` | `400`, `409`, `422` |
| SU-03 | `GET /successions/{successionId}` | Una sucesión con participantes y estado de aplicación | L | — | `200` + `ETag`; `304` | `404` |
| SU-04 | `POST /successions/{successionId}/approve` | Aprueba; devuelve la **lista de direcciones afectadas** para revisión | A | Sucesión | `200` + `ETag` | `404`, `409`, `412`, `428` |
| SU-05 | `POST /successions/{successionId}/reject` | Rechaza con motivo (terminal) | A | Sucesión | `204` | `400`, `404`, `409`, `412`, `428` |
| SU-06 | `GET /successions/{successionId}/affected-addresses` | Direcciones afectadas, paginadas; filtro `reviewStatus` | L | — | `200` | `400`, `404` |
| SU-07 | `POST /successions/{successionId}/affected-addresses/{reviewId}/resolve` | Registra la decisión sobre una dirección: `Reassign` a un lugar sucesor o `Keep` | A | Sucesión | `204` | `400`, `404`, `409`, `412`, `422`, `428` |

**Revisión humana, sin reasignación automática** ([ADR-0266](https://github.com/organizacion-peru/organizacion-arch/blob/main/reference/architecture/adrs/core/0266-la-geografia-de-la-suite-es-un-maestro-de-mdm-con-codigos-oficiales.es.md) D5, [D-048](../../DECISIONS.md#decisiones-locales)):

1. **Proponer** (SU-02) no cambia ningún lugar. Mientras la sucesión esté `Proposed`, los lugares que participan rechazan `move`, `deactivate`, `reactivate`, el vencimiento de su código canónico y una segunda propuesta con `409` `geo.succession.pending_review`.
2. **Aprobar** (SU-04) escribe solo la sucesión (`Approved`) y la lista de direcciones afectadas. Los sucesores deben existir y estar `Active` (`409` `geo.succession.successor_not_active`): un distrito nuevo se da de alta antes con PL-03 y `validFrom` = fecha de efecto.
3. **Aplicar** es un paso posterior, **un lugar por transacción** e idempotente: los predecesores que no continúan pasan a `Historical` con `validTo` = día anterior a la fecha de efecto y apuntan a sus sucesores; en `Recoding` se vence el código antiguo y se añade el nuevo; en `Rename`, el nombre. Cuando todos los lugares están aplicados, la sucesión pasa a `Applied`. SU-03 informa el avance (`appliedParticipantCount`).
4. **Revisar las direcciones** (SU-06, SU-07): cada dirección queda `Pending` hasta que una persona decide. La decisión se registra aquí con actor e instante; el cambio de la dirección lo ejecuta el maestro de partes con su propia versión ([API-MDM-002](./contrato-api-party-mdm-002.es.md) P-19), porque es otro agregado. Mientras las direcciones no lleven `geoPlaceId` ([G-615](../../GAPS.md)), la lista se calcula comparando el `ubigeo` de texto con los códigos `UBIGEO-INEI` de los predecesores ([G-625](../../GAPS.md)).

| Tipo | Predecesores | Sucesores | `continues` del predecesor |
| :--- | :--- | :--- | :--- |
| `Creation` | 1 o más (de los que se segrega territorio) | 1 nuevo | `true` |
| `Split` | 1 | 2 o más | `true` o `false` |
| `Merge` | 2 o más | 1 | `false` (salvo el que absorbe) |
| `Rename` · `Recoding` | — | — | Un solo participante `Subject`; la identidad no cambia |
| `Reassignment` | 1 (`Subject`) | — | Cambia de padre; solo lugares sin hijos en esta etapa (G-621) |

### 3.6 Lugares de comercio exterior y lugares propios

| # | Método y ruta | Propósito | Permiso | `If-Match` | Éxito | Errores |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TL-01 | `GET /trade-locations` | Búsqueda; filtros `countryCode`, `unLocode` (prefijo), `name`, `function`, `uneceStatus`, `usableInTradeDocuments`, `includeSites` | L | — | `200` | `400`, `403` (`geo.license.restricted`) |
| TL-02 | `POST /trade-locations` | Alta de un lugar UN/LOCODE con funciones, estado UNECE y padre administrativo | M | No | `201` | `400`, `409`, `422` |
| TL-03 | `GET /trade-locations/{placeId}` | Ficha del lugar de comercio con sus lugares propios | L | — | `200` + `ETag`; `304` | `404` |
| TL-04 | `PUT /trade-locations/{placeId}/trade-attributes` | Cambia funciones, estado UNECE, fecha del estado e IATA | M | Lugar | `204` | `400`, `404`, `409`, `412`, `422`, `428` |
| TL-05 | `POST /trade-locations/{placeId}/sites` | Alta de un lugar propio `ORG-SITE` (terminal, depósito) dentro de un lugar UN/LOCODE | M | No (crea otro agregado) | `201` | `400`, `404`, `409`, `422` |
| TL-06 | `GET /trade-locations/{placeId}/sites` | Lugares propios contenidos | L | — | `200` | `404` |

Un lugar de comercio es un `GeoPlace` de tipo `TradeLocation` (MDM-002 D7): se lee también por PL-04 y se mantienen sus nombres y códigos por §3.2 y §3.3. Su padre es una división administrativa o el país del **mismo país** que su UN/LOCODE (`422` `geo.code.country_mismatch`). Un lugar propio tiene como padre un lugar con UN/LOCODE (`422` `geo.place.parent_level_invalid`) y un código `ORG-SITE` que empieza por ese UN/LOCODE (`PECLL-DT01`): nunca un código de cinco caracteres inventado (RN-GEO-09).

**`usableInTradeDocuments`** se deriva: `true` si el lugar está `Active`, su estado UNECE es `AM`, `RL`, `AA`, `AC`, `AF`, `AI`, `AS` o `AQ`, y tiene alguna función distinta de `BORDER_CROSSING` (legado `B`) y de `NOT_OFFICIAL` (`0`). `RQ`, `RN` y `XX` nunca son utilizables (RN-GEO-08). Los lugares propios heredan el valor de su padre. El conjunto de estados es **supuesto** hasta confirmarlo con operaciones y aduanas ([G-628](../../GAPS.md)).

### 3.7 Zonas postales

| # | Método y ruta | Propósito | Permiso | `If-Match` | Éxito | Errores |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PZ-01 | `GET /postal-zones` | Lista; filtros `countryCode`, `code` (prefijo), `placeId`, `currentOnly` | L | — | `200` | `400` |
| PZ-02 | `POST /postal-zones` | Alta de una zona con su código y sus lugares | M | No | `201` | `400`, `409`, `422` |
| PZ-03 | `GET /postal-zones/{postalZoneId}` | Una zona con sus lugares | L | — | `200` + `ETag`; `304` | `404` |
| PZ-04 | `PUT /postal-zones/{postalZoneId}/places` | Reemplaza el conjunto de lugares de la zona | M | Zona | `204` | `400`, `404`, `409`, `412`, `422`, `428` |
| PZ-05 | `POST /postal-zones/{postalZoneId}/expire` | Vence la zona | M | Zona | `204` | `400`, `404`, `409`, `412`, `428` |

Un país cuya política dice `usesPostalCode: false` no admite zonas (`422` `geo.postal_zone.not_used_by_country`); uno que lo usa valida el código contra su `postalCodePattern` (`422` `geo.postal_zone.invalid_format`). El código postal es opcional en las direcciones mientras ningún consumidor lo exija (RF-GEO-013, P-GEO-07).

### 3.8 Importaciones

| # | Método y ruta | Propósito | Permiso | `If-Match` | Éxito | Errores |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| IM-01 | `GET /imports` | Lotes; filtros `status`, `sourceCode` | L | — | `200` | `400` |
| IM-02 | `POST /imports` | Sube un archivo (`multipart/form-data`) con fuente, versión de la fuente, fecha de corte y formato; queda en aterrizaje y se calculan las diferencias en segundo plano | M | No | `202` + `Location` + `ETag` | `400`, `409`, `413`, `415`, `422` |
| IM-03 | `GET /imports/{importId}` | Estado del lote y recuento de diferencias por tipo y decisión | L | — | `200` + `ETag`; `304` | `404` |
| IM-04 | `GET /imports/{importId}/diffs` | Diferencias paginadas; filtros `kind`, `requiresDecision`, `decision`, `applyStatus` | L | — | `200` | `400`, `404` |
| IM-05 | `POST /imports/{importId}/diff-decisions` | Decide en bloque (hasta 500) `Accept` o `Exclude` por diferencia | A | Lote | `204` | `400`, `404`, `409`, `412`, `422`, `428` |
| IM-06 | `POST /imports/{importId}/approve` | Aprueba el lote; la aplicación al canónico sigue en segundo plano | A | Lote | `202` + `ETag` | `404`, `409`, `412`, `428` |
| IM-07 | `POST /imports/{importId}/reject` | Rechaza con motivo (terminal); nada llega al canónico | A | Lote | `204` | `400`, `404`, `409`, `412`, `428` |

**Tres capas** (MDM-002 D10, `Borrador`; [ADR-0266](https://github.com/organizacion-peru/organizacion-arch/blob/main/reference/architecture/adrs/core/0266-la-geografia-de-la-suite-es-un-maestro-de-mdm-con-codigos-oficiales.es.md) D5): el archivo tal cual (aterrizaje), las diferencias frente al canónico (revisión) y el canónico. Ciclo del lote: `Received` → `Parsing` → `ReadyForReview` (o `Failed`) → `Approved` → `Applying` → `Applied` (o `AppliedWithErrors`); desde `ReadyForReview`, `Rejected`.

- Una diferencia es `Added`, `Changed`, `Removed`, `SuccessionProposed` o `Error`. **Exigen decisión** (`requiresDecision: true`) las `Removed` (nada se borra: se propone desactivar), las `SuccessionProposed` y las `Changed` que tocan un código canónico o un nombre oficial. Aprobar con alguna sin decidir responde `409` `geo.import.not_reviewed`.
- Una `SuccessionProposed` aceptada **no** aplica la sucesión: crea una sucesión `Proposed` (SU-02) que sigue su propia revisión.
- Si el canónico cambió desde que se calcularon las diferencias (otro lote aplicado, una edición manual de un lugar afectado), aprobar responde `409` `geo.import.stale` y hay que recalcular subiendo de nuevo el archivo.
- El mismo archivo (huella SHA-256) de la misma fuente no se sube dos veces (`409` `geo.import.duplicate_file`).
- Tamaño máximo del archivo **propuesto**: 50 MB (`413`); formatos admitidos por fuente en el catálogo de esquemas, por definir ([G-627](../../GAPS.md)).

### 3.9 Catálogo de esquemas de código y fuentes

| # | Método y ruta | Propósito | Permiso | `If-Match` | Éxito | Errores |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SC-01 | `GET /code-schemes` | Lista completa; filtros `countryCode`, `appliesTo`, `includeInactive` | L | — | `200` + `ETag`; `304` | `400` |
| SC-02 | `POST /code-schemes` | Alta de un esquema (p. ej., uno nacional de otro país) | A | No | `201` | `400`, `409`, `422` |
| SC-03 | `GET /code-schemes/{schemeCode}` | Un esquema | L | — | `200` + `ETag`; `304` | `404` |
| SC-04 | `PUT /code-schemes/{schemeCode}` | Cambia nombre, autoridad, fuente por defecto y descripción; el patrón solo si el esquema no tiene códigos | A | Esquema | `204` | `400`, `404`, `409`, `412`, `422`, `428` |
| SC-05 | `POST /code-schemes/{schemeCode}/deactivate` | Desactiva: no admite códigos nuevos; los existentes siguen resolviendo | A | Esquema | `204` | `404`, `409`, `412`, `428` |
| SC-06 | `POST /code-schemes/{schemeCode}/activate` | Reactiva | A | Esquema | `204` | `404`, `409`, `412`, `428` |
| SL-01 | `GET /sources` | Fuentes con su licencia y atribución | L | — | `200` + `ETag`; `304` | — |
| SL-02 | `POST /sources` | Registra una fuente; nace con `redistribution: InternalOnly` | A | No | `201` | `400`, `409` |
| SL-03 | `GET /sources/{sourceCode}` | Una fuente | L | — | `200` + `ETag`; `304` | `404` |
| SL-04 | `PUT /sources/{sourceCode}/license` | Cambia la licencia; pasar a redistribuible exige `confirmedOn` y `evidenceRef` | A | Fuente | `204` | `400`, `404`, `412`, `422`, `428` |

Esquemas de la carga inicial (MDM-002 D4 y D7; [ADR-0266](https://github.com/organizacion-peru/organizacion-arch/blob/main/reference/architecture/adrs/core/0266-la-geografia-de-la-suite-es-un-maestro-de-mdm-con-codigos-oficiales.es.md) D4):

| `code` | Autoridad | Aplica a | País | `valuePattern` | Regla de prefijo | Canónico |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ISO-3166-1-A2` | ISO/MA | `Country` | — | `^[A-Z]{2}$` | — | Sí, países |
| `ISO-3166-1-A3` | ISO/MA | `Country` | — | `^[A-Z]{3}$` | — | No |
| `ISO-3166-1-N` | ONU (vía ISO/MA) | `Country` | — | `^[0-9]{3}$` | — | No |
| `ISO-3166-2` | ISO/MA | `AdministrativeDivision` | — | `^[A-Z]{2}-[A-Z0-9]{1,3}$` | `CountryAlpha2` | Sí, primer nivel fuera del Perú |
| `UBIGEO-INEI` | INEI | `AdministrativeDivision` | `PE` | `^[0-9]{2}([0-9]{2}){0,2}$` | `ParentValue` | **Sí**, Perú ([D-048](../../DECISIONS.md#decisiones-locales)) |
| `UBIGEO-RENIEC` | RENIEC | `AdministrativeDivision` | `PE` | `^[0-9]{2}([0-9]{2}){0,2}$` | `ParentValue` | No |
| `UBIGEO-SUNAT` | SUNAT | `AdministrativeDivision` | `PE` | `^[0-9]{6}$` | — | No |
| `UN-LOCODE` | UNECE | `TradeLocation` | — | `^[A-Z]{2}[A-Z2-9]{3}$` | `CountryAlpha2` | Sí, comercio exterior |
| `ORG-SITE` | Organización | `TradeLocation` | — | `^[A-Z]{2}[A-Z2-9]{3}-[A-Z0-9]{1,10}$` | `ParentValue` (del UN/LOCODE del padre) | Sí, lugares propios |

Fuentes de la carga inicial y su licencia ([D-048](../../DECISIONS.md#decisiones-locales) punto 4, [G-616](../../GAPS.md)): `ISO` y `UNECE` como `InternalOnly`; `INEI`, `RENIEC`, `SUNAT` y `SERPOST` como `InternalOnly` mientras su licencia de reutilización siga POR VERIFICAR; `ORG` (dato propio) como `Redistributable`.

## 4. Búsqueda y vistas

### 4.1 Búsqueda de lugares (PL-01)

| Parámetro | Regla |
| :--- | :--- |
| `name` | Texto normalizado (§2) de 2 a 100 caracteres. Busca en **todos** los nombres vigentes en `asOf` (oficial, alternativos, transliterados): «Ancash» encuentra «Áncash» y «Cuzco» encuentra «Cusco» (RF-GEO-001, RF-GEO-018). No se registra en logs |
| `nameMatch` | `prefix` (defecto: el nombre o alguna de sus palabras empieza por el texto) o `contains`. `contains` exige `countryCode` o `parentId` para acotar el recorrido (`400` `validation.search_too_broad`) |
| `scheme` + `code` | Código exacto de un esquema; con `code` solo, en cualquier esquema. Para un único resultado garantizado, PL-02 |
| `pathPrefix` | Lugares cuya ruta empieza por el prefijo (`PE/15/` = todo lo que cuelga del departamento de Lima). Hasta 400 caracteres |
| `parentId` | Hijos directos del lugar |
| `countryCode` | Alfa-2 del país |
| `type` | `Country`, `AdministrativeDivision`, `Locality` o `TradeLocation` |
| `level` | Orden en la escalera del país (1 = ADM1). Solo con `countryCode` |
| `status` | `Active`, `Inactive` o `Historical`; puede repetirse. Ausente: `Active` e `Inactive` |
| `asOf` | Catálogo tal como era ese día (§2) |
| `usableForAddresses` | Con `true`, solo lugares `Active` del nivel de dirección de su país (en el Perú, distrito): lo que RF-GEO-017 ofrece al registrar una dirección |
| `view` | `minimal` (defecto en la lista) o `path` |
| `sortBy` | `name` (defecto, por nombre normalizado), `path`, `updatedAt`; `sortOrder` `asc` o `desc`; desempate por `id` |
| `page`, `pageSize` | Desde 1; 1 a 100 (defecto 20). Desplazamiento, como API-MDM-002 §4 ([G-571](../../GAPS.md)) |

Respuesta: `{ "items", "page", "pageSize", "totalCount", "totalPages" }`. Un nombre nunca identifica un lugar (RN-GEO-06): cada elemento lleva la **ruta legible** (`displayPath`: «Lima › Lima › Perú») para distinguir homónimos como los dos Aco.

### 4.2 Resolución por código (PL-02)

`GET /places/resolve?scheme=UBIGEO-INEI&value=150101&asOf=2026-10-24&view=path`

- `value` es obligatorio; `scheme` es opcional. Sin `scheme`, si el valor existe en más de un esquema para lugares distintos (por ejemplo, un ubigeo de dos dígitos que INEI y RENIEC asignan a departamentos diferentes, divergencia POR VERIFICAR del [análisis](../01-concepcion/fuentes/analisis-geografia-mdm.es.md) §4), responde `409` `geo.code.ambiguous` con los esquemas candidatos en `detail`: el consumidor debe decir qué esquema exige su trámite (factor de decisión de MDM-002 §2).
- Encuentra códigos **vencidos** y lugares **inactivos o históricos** (RF-GEO-001: «aunque esté desactivado o sucedido»). La respuesta añade `resolution`: `matchedCode` (con `isCurrent`), `placeStatus` y `successors` (los lugares que lo sucedieron, si es `Historical`), para que un consumidor con una referencia vieja la remapee (MDM-002 D11).
- `404` si el par nunca existió.

### 4.3 Vistas de la ficha (PL-04 y listas)

| Vista | Contenido | Uso |
| :--- | :--- | :--- |
| `minimal` | `id`, `type`, `status`, `countryCode`, `level`, `officialName`, `canonicalCode` (`scheme` + `value`), `version` | Listas, selectores, validación de direcciones |
| `path` | `minimal` + `parentId`, `path`, `displayPath` y `ancestors` (de la raíz al padre, cada uno en `minimal`) | Ficha por defecto; muestra la jerarquía sin servir el árbol |
| `full` | `path` + `names`, `codes` (vigentes y vencidos), `geoReference`, `tradeLocation` (si aplica), `successions` (resumen), `childCount`, `license` agregada y auditoría | Pantalla de mantenimiento |

**Nunca se sirven árboles completos** (MDM-002 D11): los hijos se piden con `parentId` y se paginan.

## 5. Recursos y DTO

Longitudes, formatos y obligatoriedad exactos en el [OpenAPI](./openapi-geografia-mdm-003.yaml) (`components/schemas`). Los códigos peruanos de los ejemplos son reales (ubigeo INEI `150101`, `070101`, `200501`; ISO 3166-2 `PE-LIM`, `PE-LMA`, `PE-CAL`; UN/LOCODE `PECLL`, `PEPAI`); las funciones UNECE, las coordenadas y el código `PECLL-DT01` son **ilustrativos** y se verifican contra la publicación antes de la carga.

### 5.1 Alta de país (CO-02) y política territorial (CO-06)

```json
{
  "alpha2": "PE",
  "alpha3": "PER",
  "numeric": "604",
  "officialName": "Perú",
  "englishName": "Peru",
  "sourceCode": "ISO",
  "sourceVersion": "OBP 2026-10-24"
}
```

```json
{
  "levels": [
    { "order": 1, "canonicalLabel": "ADM1", "localLabel": "Departamento", "canonicalSchemeCode": "UBIGEO-INEI", "isAddressLevel": false },
    { "order": 2, "canonicalLabel": "ADM2", "localLabel": "Provincia", "canonicalSchemeCode": "UBIGEO-INEI", "isAddressLevel": false },
    { "order": 3, "canonicalLabel": "ADM3", "localLabel": "Distrito", "canonicalSchemeCode": "UBIGEO-INEI", "isAddressLevel": true }
  ],
  "usesPostalCode": true,
  "postalCodePattern": "^[0-9]{5}$"
}
```

| Campo | Regla |
| :--- | :--- |
| `alpha2`, `alpha3`, `numeric` | Obligatorios; patrones de sus esquemas. Cada uno entra como código oficial del lugar país; `alpha2` es el canónico y el segmento raíz de la ruta |
| `officialName` | Obligatorio; 1 a 200, en español. `englishName` opcional, como nombre `InternationalTrade` en `en` |
| `levels` | 0 a 6 niveles con `order` contiguo desde 1 (`422` `geo.country.level_order_invalid`). Un país sin divisiones conocidas declara `levels: []` y sigue siendo válido (MDM-002 D2). `canonicalSchemeCode` debe existir, estar activo y aplicar a `AdministrativeDivision` en ese país (`422` `geo.scheme.not_applicable`). A lo sumo un nivel `isAddressLevel` |
| Cambio de escalera | Quitar o reordenar un nivel que ya tiene lugares responde `409` `geo.country.level_in_use`; añadir niveles al final o cambiar etiquetas, siempre |
| `usesPostalCode`, `postalCodePattern` | El patrón es obligatorio si `usesPostalCode` es `true`; el del ejemplo es **supuesto** hasta verificar SERPOST (RF-GEO-013) |

### 5.2 Alta de división administrativa (PL-03)

```json
{
  "type": "AdministrativeDivision",
  "parentId": "3f2b6c1e-0a4d-4e8b-9c71-5d2a8e6f1501",
  "canonicalCode": { "schemeCode": "UBIGEO-INEI", "value": "150101" },
  "officialName": "Lima",
  "validFrom": "1821-01-01",
  "sourceCode": "INEI",
  "sourceVersion": "Ubigeo INEI 2026"
}
```

| Campo | Regla |
| :--- | :--- |
| `type` | `AdministrativeDivision`. `Locality` → `422` `geo.place.type_not_supported`; `Country` y `TradeLocation` tienen su propio alta |
| `parentId` | Obligatorio. Debe existir (`422` `geo.place.parent_not_found`), no ser `Historical` (`409` `geo.place.historical`) ni `Inactive` (`409` `geo.place.parent_inactive`) y ser del **nivel anterior** según la escalera de su país, o el país si el nuevo es ADM1 (`422` `geo.place.parent_level_invalid`). Un país sin escalera declarada responde `409` `geo.country.schema_not_declared` |
| `canonicalCode` | Obligatorio; esquema = `canonicalSchemeCode` del nivel. Con regla `ParentValue`, el valor empieza por el del padre y su longitud corresponde al nivel (`150101` bajo `1501`): si no, `422` `geo.code.hierarchy_mismatch`. Con `CountryAlpha2`, empieza por el alfa-2 del país (`422` `geo.code.country_mismatch`). Se convierte en el **segmento** de la ruta, inmutable |
| `officialName` | Obligatorio; 1 a 200, tal como lo publica la autoridad |
| `validFrom` | Opcional, por defecto hoy; un distrito creado por ley lleva la fecha de efecto |
| `sourceCode`, `sourceVersion` | Obligatorio el primero; la fuente debe existir (`422` `geo.source.unknown`). Viajan con el código y con el nombre (ADR-0266 D7) |

La respuesta `201` lleva `{ "id", "version": 1 }`, `Location` y `ETag`.

### 5.3 Ficha de lugar (PL-04, `view=path`)

```json
{
  "id": "3f2b6c1e-0a4d-4e8b-9c71-5d2a8e150101",
  "type": "AdministrativeDivision",
  "status": "Active",
  "countryCode": "PE",
  "level": 3,
  "levelLabel": "Distrito",
  "officialName": "Lima",
  "canonicalCode": { "schemeCode": "UBIGEO-INEI", "value": "150101" },
  "parentId": "3f2b6c1e-0a4d-4e8b-9c71-5d2a8e6f1501",
  "path": "PE/15/1501/150101",
  "displayPath": "Lima › Lima › Lima › Perú",
  "ancestors": [
    { "id": "3f2b6c1e-0a4d-4e8b-9c71-5d2a8e6f1b01", "type": "Country", "level": 0, "officialName": "Perú", "canonicalCode": { "schemeCode": "ISO-3166-1-A2", "value": "PE" } },
    { "id": "3f2b6c1e-0a4d-4e8b-9c71-5d2a8e6f1b15", "type": "AdministrativeDivision", "level": 1, "officialName": "Lima", "canonicalCode": { "schemeCode": "UBIGEO-INEI", "value": "15" } },
    { "id": "3f2b6c1e-0a4d-4e8b-9c71-5d2a8e6f1501", "type": "AdministrativeDivision", "level": 2, "officialName": "Lima", "canonicalCode": { "schemeCode": "UBIGEO-INEI", "value": "1501" } }
  ],
  "validFrom": "1821-01-01",
  "validTo": null,
  "isCurrent": true,
  "version": 3
}
```

`view=full` añade `names[]`, `codes[]` (cada uno con `codeId`, `schemeCode`, `value`, `authority`, `validFrom`, `validTo`, `isCurrent`, `source` y `license`), `geoReference`, `childCount`, `successions[]` y auditoría (`createdAt`, `createdBy`, `updatedAt`, `updatedBy`).

**La ruta usa el segmento, no el código vigente.** `path` concatena el segmento de cada antepasado, fijado con el código canónico al dar de alta. Una recodificación (`Recoding`) cambia el código vigente pero no la ruta, para que los prefijos que tengan los consumidores sigan valiendo; como ningún código se reutiliza (RN-GEO-01), dos hermanos no pueden tener el mismo segmento.

### 5.4 Códigos y nombres (CD-02, PL-05, PL-07)

| Operación | Cuerpo | Reglas |
| :--- | :--- | :--- |
| CD-02 | `{ "schemeCode", "value", "validFrom", "sourceCode", "sourceVersion" }` | Esquema activo y aplicable al tipo y país del lugar (`422` `geo.scheme.unknown`, `geo.scheme.not_applicable`); valor normalizado y conforme al patrón (`422` `geo.code.invalid_format`) y a la regla de prefijo; el par no pertenece a otro lugar ni a este (`409` `geo.code.duplicate`); sin otro código abierto del esquema en el lugar (`409` `geo.code.current_exists`). Un ubigeo solo en lugares del Perú (RN-GEO-10), lo que garantiza el `countryCode` del esquema |
| CD-03 | `{ "validTo", "reason" }` | `validTo` ≥ `validFrom`. Vencer el código canónico de un lugar `Active` sin otro canónico abierto responde `409` `geo.code.canonical_required` |
| PL-05 | `{ "languageCode", "officialName", "reason" }` | Corrige la grafía (RF-GEO-007). El nombre anterior queda con `kind` `Historical` y `validTo` = hoy. Un cambio de nombre por ley es una sucesión `Rename`, no esto |
| PL-07 | `{ "name", "languageCode", "kind", "isPreferred", "validFrom", "sourceCode" }` | `kind` ∈ {`Alternative`, `InternationalTrade`, `Transliterated`, `Short`}; `languageCode` BCP 47 (`es`, `en`, `qu`, `ay`); el mismo nombre normalizado, idioma y tipo no se repite vigente (`409` `geo.name.duplicate`) |

### 5.5 Lugar de comercio exterior (TL-02, TL-03) y lugar propio (TL-05)

```json
{
  "unLocode": "PECLL",
  "officialName": "Callao",
  "nameWithoutDiacritics": "Callao",
  "parentId": "3f2b6c1e-0a4d-4e8b-9c71-5d2a8e070101",
  "functions": ["SEAPORT", "ROAD", "AIRPORT"],
  "uneceStatus": "AI",
  "uneceStatusDate": "2025-01-01",
  "iataCode": null,
  "geoReference": { "latitude": -12.05, "longitude": -77.15, "precision": "Locality", "sourceCode": "UNECE" },
  "sourceCode": "UNECE",
  "sourceVersion": "UN/LOCODE 2025-1"
}
```

TL-03 devuelve la vista `path` más `tradeLocation`: `{ "unLocode", "functions", "uneceStatus", "uneceStatusDate", "iataCode", "usableInTradeDocuments", "siteCount" }`. El segundo ejemplo de la carga es `PEPAI` (Paita), con padre el distrito `200501` (Paita, Piura).

| Función (`functions[]`) | Dígito UNECE | Asignable |
| :--- | :--- | :--- |
| `SEAPORT` · `RAIL` · `ROAD` · `AIRPORT` · `POSTAL` | `1` · `2` · `3` · `4` · `5` | Sí |
| `MULTIMODAL` (ICD, puerto seco, depósito de contenedores) | `6` | Sí |
| `FIXED_TRANSPORT` · `INLAND_WATERWAY` · `SPECIAL_ECONOMIC_ZONE` | `7` · `8` · `A` | Sí |
| `NOT_OFFICIAL` | `0` | Sí, pero no utilizable en documentos |
| `BORDER_CROSSING` | `B` (legado) | **No**: solo llega por importación; en TL-02 y TL-04 es `422` `geo.trade_location.function_deprecated` |

TL-05 (lugar propio):

```json
{
  "siteCode": "PECLL-DT01",
  "officialName": "Depósito temporal Organización Callao",
  "siteKind": "TemporaryWarehouse",
  "geoReference": null
}
```

`siteKind` ∈ {`Terminal`, `TemporaryWarehouse`, `ContainerYard`, `Plant`, `Other`}. El código se guarda en el esquema `ORG-SITE` con fuente `ORG`. Si además es un establecimiento de una organización, el `Establishment` de API-MDM-002 lo referenciará: un lugar no es una parte (MDM-002 D7).

### 5.6 Sucesión (SU-02, SU-04, SU-07)

```json
{
  "type": "Split",
  "legalAct": "Ley N.° 00000 (ilustrativa)",
  "effectiveOn": "2027-01-01",
  "participants": [
    { "placeId": "0d4e2f6a-1b3c-4d5e-8f70-9a1b2c3d4e01", "role": "Predecessor", "continues": true },
    { "placeId": "0d4e2f6a-1b3c-4d5e-8f70-9a1b2c3d4e02", "role": "Successor" }
  ],
  "note": "Segregación de un distrito nuevo"
}
```

Respuesta de SU-04:

```json
{
  "successionId": "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d",
  "status": "Approved",
  "version": 2,
  "affectedAddresses": {
    "totalCount": 2,
    "items": [
      {
        "reviewId": "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b",
        "ownerType": "Establishment",
        "partyId": "0b9c7e0e-2f4a-4c39-9a51-1f0d7a3e9c11",
        "establishmentId": "7e2c4a91-3d5b-4f60-8a17-b9c0d2e4f681",
        "currentPlaceId": "0d4e2f6a-1b3c-4d5e-8f70-9a1b2c3d4e01",
        "candidatePlaceIds": ["0d4e2f6a-1b3c-4d5e-8f70-9a1b2c3d4e01", "0d4e2f6a-1b3c-4d5e-8f70-9a1b2c3d4e02"],
        "reviewStatus": "Pending"
      }
    ],
    "next": "/api/v1/geo/successions/5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d/affected-addresses?page=2"
  }
}
```

`items` trae como mucho 100; el resto se pagina con SU-06. SU-07: `{ "decision": "Reassign" | "Keep", "targetPlaceId", "reason" }`; `targetPlaceId` es obligatorio con `Reassign` y debe ser un candidato (`422` `geo.address_review.target_invalid`); resolver una ya resuelta es `409` `geo.address_review.already_resolved`. La dirección no lleva datos personales: solo identificadores (§8).

### 5.7 Esquema de código, fuente y lote

| Recurso | Campos |
| :--- | :--- |
| `CodeScheme` | `code` (inmutable, `^[A-Z][A-Z0-9-]{1,29}$`), `name`, `authority`, `description`, `countryCode` (nulo = global), `appliesTo[]` (tipos de lugar), `valuePattern`, `maxLength`, `prefixRule` (`None`, `CountryAlpha2`, `ParentValue`), `isCanonical`, `defaultSourceCode`, `isActive`, `codeCount`, `version`, auditoría |
| `Source` | `code` (`ISO`, `UNECE`, `INEI`…), `authority`, `licenseName`, `licenseUrl`, `redistribution` (`InternalOnly`, `Redistributable`, `RedistributableWithAttribution`), `attributionText`, `confirmedOn`, `evidenceRef`, `version`, auditoría |
| `ImportBatch` | `id`, `sourceCode`, `sourceVersion`, `dataCutoffDate`, `format`, `countryCode` (alcance opcional), `fileName`, `fileSha256`, `fileSizeBytes`, `status`, `counts` (`added`, `changed`, `removed`, `successionProposed`, `errors`, `pendingDecisions`, `applied`, `failed`), `uploadedAt`, `uploadedBy`, `decidedAt`, `decidedBy`, `decisionReason`, `version` |
| `ImportDiff` | `id`, `lineNumber`, `kind`, `targetPlaceId`, `schemeCode`, `codeValue`, `before` y `after` (objetos con los campos que cambian), `requiresDecision`, `decision`, `decidedBy`, `applyStatus` (`Pending`, `Applied`, `Failed`, `Skipped`), `applyError` |

IM-02 recibe `file` (binario) y `metadata` (JSON con `sourceCode`, `sourceVersion`, `dataCutoffDate`, `format`, `countryCode`). `format` ∈ {`UNLOCODE_CSV`, `ISO3166_CSV`, `UBIGEO_INEI_CSV`, `UBIGEO_RENIEC_CSV`, `UBIGEO_SUNAT_CSV`, `POSTAL_CSV`}, **propuesta** hasta conocer los archivos reales ([G-627](../../GAPS.md)).

## 6. Errores de negocio

### 6.1 Catálogo de `code`

Formato `geo.<recurso>.<regla>`, segmentos en `snake_case`, como en API-MDM-002 §6.1. Un `code` publicado no cambia de significado. **`422`** = el valor no es admisible (lo decide el catálogo o una regla sin estado); **`409`** = choca con el estado actual o con otro dato.

| `code` | HTTP | Regla | Cuándo |
| :--- | :--- | :--- | :--- |
| `geo.place.parent_not_found` | `422` | Referencia por id | El `parentId` del cuerpo no existe |
| `geo.place.parent_level_invalid` | `422` | MDM-002 D3; RN-GEO-07, RN-GEO-09 | El padre no es del nivel anterior de la escalera; el padre de un lugar de comercio no es una división o el país; el padre de un lugar propio no tiene UN/LOCODE |
| `geo.place.type_not_supported` | `422` | Alcance (PRD §5.2) | Alta de `Locality` |
| `geo.place.cycle` | `422` | MDM-002 D3 (sin ciclos) | PL-12 hacia el propio lugar o un descendiente |
| `geo.place.historical` | `409` | MDM-002 D3, D6 | Cualquier escritura sobre un lugar `Historical`, o un hijo nuevo bajo él |
| `geo.place.parent_inactive` | `409` | RF-GEO-007 | Hijo nuevo, reubicación o lugar propio bajo un lugar `Inactive` |
| `geo.place.already_active` · `geo.place.already_inactive` | `409` | Ciclo del lugar | Transición no válida |
| `geo.place.has_children` | `409` | Una transacción, un lugar (MDM-002 D3) | PL-12 o `Reassignment` sobre un lugar con hijos; PL-09 sobre un lugar con hijos `Active` |
| `geo.country.schema_not_declared` | `404` en CO-05; `409` en altas | MDM-002 D2 | El país no tiene escalera declarada |
| `geo.country.level_order_invalid` | `422` | MDM-002 D2 | Niveles no contiguos desde 1, más de 6 o más de un nivel de dirección |
| `geo.country.level_in_use` | `409` | MDM-002 D2 | Quitar o reordenar un nivel con lugares |
| `geo.scheme.unknown` | `422` | Catálogo | Esquema inexistente o inactivo |
| `geo.scheme.not_applicable` | `422` | MDM-002 D4; RN-GEO-10 | El esquema no aplica al tipo de lugar o a su país (un ubigeo fuera del Perú) |
| `geo.scheme.code_duplicate` · `geo.scheme.code_invalid` | `409` · `422` | Catálogo | Alta de esquema con código existente o mal formado |
| `geo.scheme.in_use` | `409` | RN-GEO-01 | Cambiar `valuePattern` o `prefixRule` de un esquema con códigos |
| `geo.scheme.already_active` · `geo.scheme.already_inactive` | `409` | Ciclo | Transición no válida |
| `geo.code.invalid_format` | `422` | MDM-002 D4 | El valor no cumple el patrón del esquema |
| `geo.code.country_mismatch` | `422` | ADR-0266 D4 | ISO 3166-2, UN/LOCODE o la ruta no casan con el país del lugar |
| `geo.code.hierarchy_mismatch` | `422` | RF-GEO-004 | El ubigeo no empieza por el del padre o su longitud no es la del nivel |
| `geo.code.duplicate` | `409` | RN-GEO-01; meta O3 | El par `(scheme, value)` ya pertenece a un lugar, aunque esté vencido o el lugar sea histórico |
| `geo.code.current_exists` | `409` | MDM-002 D4 | El lugar ya tiene un código abierto de ese esquema |
| `geo.code.canonical_required` | `409` | ADR-0266 D4 | Vencer el último código canónico abierto de un lugar `Active` |
| `geo.code.already_expired` | `409` | Vigencia | Vencer un código ya vencido |
| `geo.code.ambiguous` | `409` | MDM-002 §2 | PL-02 sin `scheme` y el valor existe en varios esquemas para lugares distintos |
| `geo.name.duplicate` · `geo.name.already_expired` · `geo.name.official_not_expirable` | `409` | RF-GEO-018 | Nombre repetido vigente; vencer uno vencido; vencer el oficial (se corrige con PL-05) |
| `geo.correspondence.code_unknown` | `422` | MDM-002 D5 | Un extremo no existe como código del catálogo |
| `geo.correspondence.self_reference` | `422` | MDM-002 D5 | Ambos extremos iguales |
| `geo.correspondence.duplicate` · `geo.correspondence.already_expired` | `409` | MDM-002 D5 | Ya hay una vigente con los mismos extremos; vencer una vencida |
| `geo.succession.participants_invalid` | `422` | MDM-002 D6 | Los participantes no casan con el tipo (§3.5) o un lugar aparece dos veces |
| `geo.succession.pending_review` | `409` | ADR-0266 D5 | El lugar participa en una sucesión `Proposed` (§3.5, paso 1) |
| `geo.succession.successor_not_active` | `409` | MDM-002 D6 | Aprobar con un sucesor que no está `Active` |
| `geo.succession.already_decided` | `409` | Ciclo | Aprobar o rechazar una sucesión que no está `Proposed` |
| `geo.address_review.target_invalid` | `422` | RF-GEO-010 | `Reassign` a un lugar que no es candidato |
| `geo.address_review.already_resolved` | `409` | RF-GEO-010 | La dirección ya tiene decisión |
| `geo.trade_location.function_deprecated` | `422` | RN-GEO-08 | Asignar `BORDER_CROSSING` a mano |
| `geo.trade_location.not_trade_location` | `422` | MDM-002 D7 | TL-03 a TL-06 sobre un lugar de otro tipo; la ruta existe pero no es un lugar de comercio |
| `geo.postal_zone.not_used_by_country` · `geo.postal_zone.invalid_format` | `422` | MDM-002 D8; RF-GEO-013 | El país no usa código postal; el código no cumple su patrón |
| `geo.postal_zone.place_country_mismatch` | `422` | MDM-002 D8 | Un lugar de la zona es de otro país |
| `geo.postal_zone.code_duplicate` · `geo.postal_zone.already_expired` | `409` | MDM-002 D8 | Código vigente repetido en el país; vencer una vencida |
| `geo.source.unknown` | `422` | ADR-0266 D7 | La fuente no está registrada |
| `geo.source.code_duplicate` | `409` | Catálogo | Alta de fuente con código existente |
| `geo.source.evidence_required` | `422` | D-048 punto 4 | Pasar a redistribuible sin `confirmedOn` ni `evidenceRef` |
| `geo.import.file_unsupported` | `422` | MDM-002 D10 | Formato desconocido o archivo ilegible para ese formato |
| `geo.import.duplicate_file` | `409` | MDM-002 D10 | Misma fuente y misma huella SHA-256 que un lote previo no rechazado |
| `geo.import.not_ready` | `409` | Ciclo | Decidir o aprobar un lote que no está `ReadyForReview` |
| `geo.import.not_reviewed` | `409` | ADR-0266 D5; RN-GEO-11 | Aprobar con diferencias que exigen decisión y no la tienen |
| `geo.import.stale` | `409` | MDM-002 D10 | El canónico cambió desde que se calcularon las diferencias |
| `geo.import.already_decided` | `409` | Ciclo | Aprobar o rechazar un lote ya aprobado o rechazado |
| `geo.import.diff_not_found` | `422` | Referencia por id | Un `diffId` de IM-05 no es de este lote |
| `geo.license.restricted` | `403` | ADR-0266 D7; D-048 punto 4 | Un cliente de distribución externa (§8.3) pide un dato cuya licencia es `InternalOnly` |

Códigos transversales heredados sin cambio de API-MDM-002: `validation.failed` y `request.malformed` (`400`), `auth.unauthenticated` y `auth.user_required` (`401`), `auth.forbidden` (`403`), `common.not_found` (`404`), `request.method_not_allowed` (`405`), `precondition.failed` (`412`), `request.payload_too_large` (`413`, nuevo), `request.unsupported_media_type` (`415`), `precondition.required` (`428`) y `server.unexpected_error` (`500`). Nuevo `400`: `validation.search_too_broad`.

### 6.2 Ejemplo

```http
POST /api/v1/geo/places HTTP/1.1
Authorization: Bearer <portador>
Content-Type: application/json

{ "type": "AdministrativeDivision", "parentId": "3f2b6c1e-0a4d-4e8b-9c71-5d2a8e6f1b15",
  "canonicalCode": { "schemeCode": "UBIGEO-INEI", "value": "150101" },
  "officialName": "Lima", "sourceCode": "INEI" }
```

```http
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json

{
  "type": "https://httpwg.org/specs/rfc9110.html#status.422",
  "title": "El padre no es del nivel anterior",
  "status": 422,
  "detail": "Un Distrito (nivel 3) del Perú debe colgar de una Provincia (nivel 2); el padre indicado es un Departamento.",
  "instance": "/api/v1/geo/places",
  "code": "geo.place.parent_level_invalid"
}
```

## 7. Estados HTTP

| Estado | Cuándo |
| :--- | :--- |
| `200` | Lectura correcta; aprobación de una sucesión (devuelve la lista de direcciones afectadas) |
| `201` | Alta de un agregado o de un nombre o código del lugar; primera declaración de la escalera |
| `202` | Lote subido o aprobado: el trabajo sigue en segundo plano; `Location` apunta al lote |
| `204` | Escritura correcta sin cuerpo; devuelve el `ETag` nuevo |
| `304` | `If-None-Match` coincide |
| `400` | Forma inválida, JSON ilegible, cabecera condicional mal formada o búsqueda demasiado amplia |
| `401` | Sin portador válido, o escritura sin claim `sub` |
| `403` | Sin el permiso de la operación (`auth.forbidden`) o licencia que no permite el dato al cliente (`geo.license.restricted`) |
| `404` | El recurso de la **ruta** no existe; un id inexistente en el **cuerpo** es `422` |
| `405`, `415` | Los emite el framework |
| `409` | Conflicto con el estado o con la unicidad (§6.1) |
| `412` | La versión cambió, o `If-None-Match: *` sobre una escalera ya declarada |
| `413` | Archivo de importación por encima del máximo |
| `422` | Valor que el catálogo o una regla sin estado no admite |
| `428` | Falta `If-Match` (o `If-None-Match: *` en CO-06) |
| `500` | Error no controlado |

## 8. Seguridad, autorización y licencias

### 8.1 Autenticación

Portador JWT **RS256** contra el JWKS de UMS ([ADR-0157](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0157-firma-asimetrica-portador-ums-jwks.es.md), `Aceptado`), igual que API-MDM-002 §8. El actor de auditoría es el claim `sub`.

### 8.2 Autorización: tres permisos

El responsable del catálogo existe por decisión ([ADR-0266](https://github.com/organizacion-peru/organizacion-arch/blob/main/reference/architecture/adrs/core/0266-la-geografia-de-la-suite-es-un-maestro-de-mdm-con-codigos-oficiales.es.md) D6, [D-048](../../DECISIONS.md#decisiones-locales) punto 5) y **la autorización la concede UMS** ([ADR-0230](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0230-sesion-por-portador-carril-satelite-ums.es.md), `Aceptado`). Los nombres de permiso y de rol son **SUPUESTO** hasta que UMS los publique ([G-622](../../GAPS.md)):

| Nivel | Permiso | Roles (SUPUESTO) | Operaciones |
| :--- | :--- | :--- | :--- |
| **L** — leer | `geo.read` | Todo usuario autenticado de la suite y las cuentas de servicio de SIL, TMS (vía XMS), DT y MDM | Todos los `GET` |
| **M** — mantener | `geo.maintain` | `ANALISTA_MDM`, `RESPONSABLE_MDM`, `RESPONSABLE_GEOGRAFIA` | Alta de divisiones, lugares de comercio, lugares propios y zonas postales; corregir nombres; añadir y vencer códigos no canónicos; correspondencias; desactivar y reactivar; punto de referencia; **proponer** sucesiones; **subir** lotes |
| **A** — aprobar | `geo.approve` | `RESPONSABLE_GEOGRAFIA` (nuevo) y `RESPONSABLE_MDM` | Alta y edición de países y de su escalera; vencer un código canónico; reubicar padre; **aprobar y rechazar** sucesiones e importaciones y decidir sus diferencias; resolver direcciones afectadas; esquemas de código; fuentes y licencias |

- Sin el permiso: `403` `auth.forbidden`, evaluado antes que el cuerpo (§2.2). A diferencia de API-MDM-002, que lo reserva, aquí el contrato **lo especifica** para que el mock lo simule; el backend lo aplicará cuando UMS publique los permisos.
- **Quién propone no aprueba** es una buena práctica que este contrato **no** impone: con un solo responsable en la empresa, bloquearía sus propias altas. Queda como decisión abierta en G-622.
- **Sin datos personales en los registros** ([ADR-0193](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0193-el-dato-personal-no-llega-al-log.es.md), `Aceptado`): la geografía no los tiene, pero la lista de direcciones afectadas (SU-06) solo lleva identificadores de Party y establecimiento, nunca la calle ni el número. No se registran los parámetros `name` ni los cuerpos.

### 8.3 Licencias: uso interno, no redistribuible

[ADR-0266](https://github.com/organizacion-peru/organizacion-arch/blob/main/reference/architecture/adrs/core/0266-la-geografia-de-la-suite-es-un-maestro-de-mdm-con-codigos-oficiales.es.md) D7 y [D-048](../../DECISIONS.md#decisiones-locales) punto 4: mientras la licencia de una fuente no esté confirmada, su dato es de **uso interno** y no sale de la suite.

- **Cada código, nombre y punto lleva su fuente** (`source`: `code`, `version`) y su licencia (`license`: `redistribution`, `attributionText`). La ficha `full` agrega la licencia más restrictiva del lugar.
- **Clientes internos** (usuarios de la suite y cuentas de servicio de SIL, DT, MDM): ven todo.
- **Clientes de distribución externa** (la cuenta de XMS que entrega a terceros —TMS, ERP, navieras— y cualquier futuro portal): **propuesta** de un permiso aparte `geo.read.external` ([G-623](../../GAPS.md)). Para ellos, la API **omite** los códigos, nombres y puntos `InternalOnly` y lo declara en `redactedSchemes` de cada lugar; filtrar o resolver **por** un esquema restringido (`scheme=UN-LOCODE`, `unLocode=`) responde `403` `geo.license.restricted`, porque la propia respuesta revelaría el dato.
- Los eventos (`GeoPlaceEvent`) que XMS reenvía a terceros siguen la misma regla de omisión (MDM-002 D10).
- Pasar una fuente a `Redistributable` exige `confirmedOn` y `evidenceRef` (la confirmación escrita de UNECE o de ISO, [G-616](../../GAPS.md)) y el permiso **A**.

## 9. Trazabilidad: endpoint → requisito → decisión → evento

Decisiones: **0266-Dn** = [ADR-0266](https://github.com/organizacion-peru/organizacion-arch/blob/main/reference/architecture/adrs/core/0266-la-geografia-de-la-suite-es-un-maestro-de-mdm-con-codigos-oficiales.es.md) (`Aceptado`, norma); **M2-Dn** = [ADR-MDM-002](../../reference/architecture/adrs/MDM-002-modelo-geografico-de-la-suite.es.md) (`Borrador`, trazabilidad de diseño). Los eventos son **propuesta** del contrato sobre M2-D11: un solo `GeoPlaceEvent` de transferencia de estado con `sequence` = `version` del lugar y el tipo de cambio en `changeKind`; los demás agregados publican el suyo cuando haya outbox ([G-312](../../GAPS.md)).

| Endpoint | Requisitos | Reglas | Decisiones | Evento (`changeKind`) |
| :--- | :--- | :--- | :--- | :--- |
| CO-01, CO-03 | RF-GEO-001, RF-GEO-002 | RN-GEO-01, 02 | 0266-D1, D4; M2-D3, D4 | — |
| CO-02 | RF-GEO-002 | RN-GEO-01 | 0266-D4; M2-D3, D4 | `GeoPlaceEvent` (`Created`) |
| CO-04 | RF-GEO-002, RF-GEO-018 | RN-GEO-02 | M2-D3 | `GeoPlaceEvent` (`Renamed`) |
| CO-05, CO-06 | RF-GEO-003, RF-GEO-013 | RN-GEO-07 | 0266-D2; M2-D2, D8 | `CountryTerritorialSchemaChanged` |
| PL-01 | RF-GEO-001, RF-GEO-009, RF-GEO-017, RF-GEO-018, RF-GEO-019 | RN-GEO-06 | M2-D3, D11 | — |
| PL-02 | RF-GEO-001, RF-GEO-009, RF-GEO-017, RF-GEO-019 | RN-GEO-01, 06 | 0266-D3, D4; M2-D4, D6, D11 | — |
| PL-03 | RF-GEO-004, RF-GEO-007 | RN-GEO-04, 07, 10 | 0266-D2, D3, D4; M2-D3, D4 | `GeoPlaceEvent` (`Created`) |
| PL-04, PL-06, CD-01 | RF-GEO-001, RF-GEO-006, RF-GEO-014, RF-GEO-018, RF-GEO-020 | RN-GEO-05, 06 | M2-D3, D9, D11 | — |
| PL-05, PL-07, PL-08 | RF-GEO-007, RF-GEO-018 | RN-GEO-02 | M2-D3 | `GeoPlaceEvent` (`Renamed`, `NamesChanged`) |
| PL-09, PL-10 | RF-GEO-007 | RN-GEO-02 | M2-D3 (estado `Inactive`: propuesta, G-621) | `GeoPlaceEvent` (`Deactivated`, `Reactivated`) |
| PL-11 | RF-GEO-009, RNF-GEO-01 | RN-GEO-02, 03 | M2-D6, D10 | — |
| PL-12 | RF-GEO-007 | RN-GEO-02 | M2-D3 | `GeoPlaceEvent` (`Moved`) |
| PL-13 | RF-GEO-014 | RN-GEO-05 | 0266-D8; M2-D9 | `GeoPlaceEvent` (`GeoReferenceChanged`) |
| CD-02, CD-03 | RF-GEO-004, RF-GEO-005, RF-GEO-006 | RN-GEO-01, 04, 10 | 0266-D4; M2-D4 | `GeoPlaceEvent` (`CodesChanged`) |
| CR-01 a CR-04 | RF-GEO-005, RF-GEO-006 | RN-GEO-04 | 0266-D4; M2-D5 | `CodeCorrespondenceChanged` |
| SU-01 a SU-05 | RF-GEO-009 | RN-GEO-03 | 0266-D3, D5; M2-D6 | `SuccessionApproved` / `SuccessionRejected`; al aplicar, `GeoPlaceEvent` (`Succeeded`) por lugar, con la sucesión dentro |
| SU-06, SU-07 | RF-GEO-010, RF-GEO-017 | RN-GEO-03 | 0266-D5; M2-D6, D12 | `AffectedAddressResolved` |
| TL-01 a TL-04 | RF-GEO-001, RF-GEO-011, RF-GEO-014 | RN-GEO-08, 12 | 0266-D4; M2-D7 | `GeoPlaceEvent` (`TradeAttributesChanged`) |
| TL-05, TL-06 | RF-GEO-012 | RN-GEO-09 | M2-D7 | `GeoPlaceEvent` (`Created`) |
| PZ-01 a PZ-05 | RF-GEO-013 | — | 0266-D1; M2-D8 | `PostalZoneChanged` |
| IM-01 a IM-07 | RF-GEO-008, RF-GEO-020 | RN-GEO-05, 11 | 0266-D5, D7; M2-D10 | `ImportBatchApproved`; al aplicar, los `GeoPlaceEvent` de cada lugar |
| SC-01 a SC-06 | RF-GEO-006 | RN-GEO-04 | 0266-D4; M2-D4 | Sin evento |
| SL-01 a SL-04 | RF-GEO-020 | RN-GEO-05 | 0266-D7; M2-D10 | Sin evento |

**Sin endpoint en este contrato:** RF-GEO-015 y RF-GEO-016 (etapa posterior, [G-614](../../GAPS.md)); RF-GEO-017 se completa en API-MDM-002 cuando la dirección lleve `geoPlaceId` ([G-615](../../GAPS.md)), usando PL-01 con `usableForAddresses` y PL-02.

## 10. Trazabilidad a ADR

| ADR | Estado | Qué sostiene aquí |
| :--- | :--- | :--- |
| [ADR-0266](https://github.com/organizacion-peru/organizacion-arch/blob/main/reference/architecture/adrs/core/0266-la-geografia-de-la-suite-es-un-maestro-de-mdm-con-codigos-oficiales.es.md) | `Aceptado` | La geografía es maestro de MDM; niveles por país; un lugar con identidad estable; códigos con autoridad y vigencia; ubigeo INEI, ISO 3166-1 alfa-2 y UN/LOCODE canónicos; revisión humana; responsable del catálogo; licencias con el dato; coordenadas por etapas |
| [ADR-0098](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0098-comunicacion-entre-agregados-intra-servicio.es.md) | `Aceptado` | Un agregado por transacción: versión propia por agregado; aplicación de sucesiones e importaciones un lugar por transacción |
| [ADR-0097](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0097-integracion-entre-sistemas-suite-eventos-xms.es.md) | `Aceptado` | Terceros por XMS; el contrato es de MDM como emisor |
| [ADR-0031](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0031-esquema-por-contexto-catalogo-eventos-dominio.es.md) | `Aceptado` | Contexto propio con esquema `mdm_geo` ([MD-MDM-003](../02-diseno/modelo-datos-geografia-mdm-003.es.md)) |
| [ADR-0041](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/dotnet/0041-arquitectura-backend-canonica-dotnet.es.md) | `Aceptado` | Backend .NET con Minimal API y Problem Details |
| [ADR-0157](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0157-firma-asimetrica-portador-ums-jwks.es.md) · [ADR-0230](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0230-sesion-por-portador-carril-satelite-ums.es.md) | `Aceptado` | Portador RS256; la autorización la concede UMS |
| [ADR-0193](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0193-el-dato-personal-no-llega-al-log.es.md) | `Aceptado` | Sin datos personales en registros |
| [ADR-MDM-002](../../reference/architecture/adrs/MDM-002-modelo-geografico-de-la-suite.es.md) | `Borrador` (local) | Detalle de implementación de ADR-0266; se cita como trazabilidad, no como norma |
| [ADR-MDM-001](../../reference/architecture/adrs/MDM-001-nomenclatura-y-conceptos-no-portables-de-mdm.es.md) | `Borrador` (local) | Versión entera como `ETag`; no vincula, se conserva como regla de D-031 |

## 11. Gaps propuestos

Propuestos para [GAPS.md](../../GAPS.md); este documento no lo edita.

| Gap | Resumen |
| :--- | :--- |
| G-621 | El contrato añade a MDM-002 el estado `Inactive`, `Historical` solo por sucesión, `Locality` sin alta en la primera etapa, reubicación solo de hojas y aplicación diferida de sucesiones (`Approved` → `Applied`) |
| G-622 | Permisos `geo.read`, `geo.maintain`, `geo.approve` y roles `RESPONSABLE_GEOGRAFIA` y `RESPONSABLE_MDM` supuestos; UMS no los publica; segregación proponente/aprobador sin decidir |
| G-623 | No hay mecanismo decidido para distinguir clientes internos de los de distribución externa; se propone `geo.read.external` con omisión y `403` `geo.license.restricted` |
| G-624 | El tipo `geography` con índice espacial y el JSON de las diferencias no están declarados en un ADR local según ADR-0229 §3.5 |
| G-625 | La lista de direcciones afectadas depende de que las direcciones lleven `geoPlaceId` (G-615); mientras tanto, se calcula por el texto del ubigeo |
| G-626 | Rendimiento sin medir: búsqueda por nombre sobre más de 100 000 lugares UN/LOCODE, prefijo de ruta y volumen de diferencias por lote |
| G-627 | La importación no tiene formatos de archivo por fuente, almacenamiento del aterrizaje, límite de tamaño ni mecanismo de trabajo en segundo plano decididos |
| G-628 | Estados UNECE utilizables en documentos y funciones de los ejemplos (`PECLL`, `PEPAI`) supuestos; confirmar con operaciones y aduanas |

## 12. Historial de cambios (bitácora)

| Versión | Fecha | Autor | Cambios |
| :--- | :--- | :--- | :--- |
| 0.1.0 | 2026-10-25 | Agente `organizacion-dev-backend-dotnet` | Versión inicial en `Borrador`: 61 endpoints bajo `/api/v1/geo` para países y su política territorial, lugares, códigos oficiales, correspondencias, sucesiones con revisión de direcciones afectadas, lugares de comercio exterior y propios, zonas postales, importaciones en tres capas, esquemas de código y fuentes con licencia; versión propia por agregado; catálogo de `code` `geo.*`; tres niveles de permiso supuestos; omisión de datos `InternalOnly` para clientes externos. Deriva de PRD-MDM-002, ADR-MDM-002 y ADR-0266. OpenAPI 0.1.0 |

---

<p align="center">
  <strong>© Organización S.A.</strong> · RUC 20100412447 · Operador Logístico Aduanero desde 1978
</p>
