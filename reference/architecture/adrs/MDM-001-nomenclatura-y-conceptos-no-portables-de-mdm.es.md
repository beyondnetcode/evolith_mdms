---
adr: MDM-001
estado: Borrador
supersede: []
deprecia_reglas: []
ambito_runtime: dotnet
---
# [ADR MDM-001](./MDM-001-nomenclatura-y-conceptos-no-portables-de-mdm.es.md): Modelo físico de `mdm-api` en SQL Server — esquema `mdm`, nomenclatura en inglés y `PascalCase`, y los conceptos no portables del maestro de organización y sede

<p align="right">
  <img src="https://img.shields.io/badge/ORG%20S.A.-Operador_Log%C3%ADstico_Aduanero-0f3e67?style=for-the-badge&logoColor=white" alt="Organización S.A.">
  <img src="https://img.shields.io/badge/Estado-Borrador-825500?style=flat-square" alt="Estado">
  <img src="https://img.shields.io/badge/Versi%C3%B3n-0.2.0-042139?style=flat-square" alt="Versión">
</p>

> Estado: Borrador
> Fecha: 2026-10-21
> Owner: Arquitectura MDM (aarroyo)
> Fase relacionada: Construcción
> **En revisión por [D-043](../../../DECISIONS.md#decisiones-locales):** el agregado Tenant/Branch que este ADR describe se rehace como Party con roles y establecimientos ([DOM-MDM-002](../../../docs/02-diseno/modelo-dominio-organizacion-erp-mdm-002.es.md), [G-552](../../../GAPS.md)); las convenciones físicas (esquema `mdm`, inglés y `PascalCase`, conceptos no portables) siguen como propuesta
> Artefactos relacionados: [Especificación técnica del maestro de organización y sede](../../../docs/03-construccion/especificacion-tecnica-organizacion-sede-mdm-001.es.md) · [Contrato de la API](../../../docs/03-construccion/contrato-api-organizacion-sede-mdm-001.es.md) · [DECISIONS.md D-031](../../../DECISIONS.md#decisiones-locales) · [ADR-SIL-005](./SIL-005-nomenclatura-y-conceptos-no-portables-del-modelo-fisico.es.md) · [ADR-0229 §3.4 y §3.5](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0229-modelo-datos-logico-fisico-fase-diseno.es.md)

---

## 1. Contexto

[D-031](../../../DECISIONS.md#decisiones-locales) autoriza a `mdm-api`, alojado provisionalmente en este satélite ([D-027](../../../DECISIONS.md#decisiones-locales), [G-257](../../../GAPS.md)), a construir el CRUD del maestro de organización (Tenant) y sede (Branch). Es la primera persistencia de MDM en este repositorio y necesita decisiones que el estándar deja al producto:

- **Nomenclatura.** [ADR-0054](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0054-estandares-diseno-normalizacion-base-datos.es.md) §3.3 (`Aceptado`) fija `PascalCase` y la clave primaria `Id` para .NET sobre SQL Server, pero no el idioma ni el número de los nombres de tabla. SIL los resolvió en español y en singular ([ADR-SIL-005](./SIL-005-nomenclatura-y-conceptos-no-portables-del-modelo-fisico.es.md) D1), y no sirve aquí: MDM publica a UMS, que nombra en inglés, y el contrato `TenantEvent` ya usa `Code`, `Name` y `Status`.
- **Esquema.** [ADR-0031](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0031-esquema-por-contexto-catalogo-eventos-dominio.es.md) (`Aceptado`) pide un esquema por contexto acotado.
- **Conceptos no portables.** [ADR-0229](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0229-modelo-datos-logico-fisico-fase-diseno.es.md) §3.5 (`Aceptado`) exige un ADR local que declare qué garantiza la implementación de cada concepto **NO PORTABLE** de su Anexo A. El maestro usa tres: fecha con zona, estrategia de índice primario y bloqueo optimista.
- **El evento manda sobre el token.** El consumidor de UMS (`TenantProjectionConsumer`) aplica un `TenantEvent` solo si su `Sequence` es estrictamente mayor que la versión que guarda. Esa secuencia tiene que salir de un número que el maestro controle, que sea monótono por organización y que sobreviva a una carga inicial o a un cambio de motor.

## 2. Factores de Decisión

- **Un solo idioma a lo largo de la cadena MDM → UMS**: el contrato, el dominio de UMS y el de MDM nombran igual la misma cosa.
- **Estándar de la suite:** `PascalCase` e `Id` ([ADR-0054](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0054-estandares-diseno-normalizacion-base-datos.es.md)); EF Core como ORM y migraciones versionadas como autoridad del esquema ([ADR-0041](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/dotnet/0041-arquitectura-backend-canonica-dotnet.es.md)).
- **Menos excepciones a normas `Aceptado`**: el entero `Version` de [ADR-0016](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0016-pista-auditoria-inmutable-negocio.es.md) ya existe; usarlo como token no añade una columna ni una excepción.
- **Volumen bajo**: decenas a pocos miles de organizaciones y sedes, escritura rara.
- **Importación de identificadores**: la carga inicial desde UMS ([G-313](../../../GAPS.md)) debe conservar el `Guid` que UMS ya usa.

## 3. Opciones Consideradas

| Decisión | Opción elegida | Alternativa descartada |
| :--- | :--- | :--- |
| Idioma y número de las tablas | **Inglés y plural** (`Tenants`, `TenantBranches`, `BranchLifecycleEntries`), como el dominio de UMS y el contrato `TenantEvent` | Español y singular, como SIL ([ADR-SIL-005](./SIL-005-nomenclatura-y-conceptos-no-portables-del-modelo-fisico.es.md) D1): obligaría a traducir en el borde con UMS |
| Bloqueo optimista | **`Version bigint` del agregado como token** (`IsConcurrencyToken`), incrementado por la aplicación | `rowversion`: lo asigna el motor por base de datos, cambia con cualquier escritura técnica, no se puede importar ni conservar en una migración de datos y no es portable; no sirve como `Sequence` del evento |
| Identificadores | **`uniqueidentifier` asignado por la aplicación** | `bigint IDENTITY`: la aplicación no conocería el `Id` antes de guardar (outbox, `Location`) y no podría importar los `Guid` de UMS |

## 4. Decisión

<a id="d1"></a>**D1 — Esquema y nomenclatura.** Todas las tablas de `mdm-api` viven en el esquema **`mdm`** ([ADR-0031](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0031-esquema-por-contexto-catalogo-eventos-dominio.es.md)). Los nombres son `PascalCase`, en **inglés** y las tablas en **plural**: `mdm.Tenants`, `mdm.TenantBranches` y `mdm.BranchLifecycleEntries`. La clave primaria es `Id`. Todo constraint e índice lleva nombre explícito, fijado en la migración con `HasConstraintName` y `HasDatabaseName`: `PK_<Tabla>`, `FK_<Tabla>_<Columna>`, **`UX_`** para los índices únicos, `CK_<Tabla>_<Regla>` e `IX_`. Los índices son `UX_Tenants_Code`, `UX_Tenants_CompanyReference`, `UX_TenantBranches_TenantId_Code`, `IX_Tenants_StatusId_Code` (ruta del listado: filtro por estado ordenado por código), `IX_Tenants_ParentTenantId`, `IX_BranchLifecycleEntries_BranchId_OccurredAt` e `IX_BranchLifecycleEntries_TenantId`. Las restricciones `CK_` son `CK_Tenants_OrganizationTypeId`, `CK_Tenants_StatusId` (ambos `IN` de los identificadores de la enumeración de dominio), `CK_Tenants_Version` (`Version >= 1`), `CK_Tenants_ParentNotSelf`, `CK_TenantBranches_Closure` (una sede cerrada tiene `ClosedAt` y `IsActive` en falso; una abierta no tiene marca de cierre) y `CK_BranchLifecycleEntries_EpisodeId`. Todas las claves foráneas son `NO ACTION`: no hay cascada de borrado físico. Las columnas de texto de clave natural y de búsqueda (`Code`, `Name` y `CompanyReference`) llevan la intercalación **`Latin1_General_100_CI_AS`** declarada por columna, para que el comportamiento no dependa de la intercalación de la base ni del servidor; se espera que la unicidad no distinga mayúsculas, pero esa propiedad no está verificada contra un motor real ([G-328](../../../GAPS.md)). La historia de migraciones de EF Core también va en el esquema `mdm` (`mdm.__EFMigrationsHistory`), para que MDM pueda compartir instancia sin pisar a nadie ([G-321](../../../GAPS.md)).

<a id="d2"></a>**D2 — Fecha con zona: `datetimeoffset(3)`.** Todo instante (`CreatedAt`, `UpdatedAt`, `ClosedAt`, `OccurredAt`) se guarda como `datetimeoffset(3)` en UTC. La precisión de milisegundos basta para un maestro y alinea el valor con lo que serializa la API (ISO 8601 con milisegundos).

<a id="d3"></a>**D3 — Identificadores asignados por la aplicación.** `Id` es `uniqueidentifier`, **lo asigna la aplicación** antes de guardar y nunca el motor. Un `Id` importado de UMS se conserva tal cual, porque es el `Subject` del `TenantEvent` que su proyección ya tiene ([G-313](../../../GAPS.md)). Con el volumen esperado la clave primaria es agrupada (el `PK_` por defecto de EF Core sobre el `Guid`); la fragmentación de un `Guid` no secuencial no pesa a esta escala, y se revisa si el maestro supera las 10 000 organizaciones ([G-327](../../../GAPS.md)).

<a id="d4"></a>**D4 — Bloqueo optimista con la versión entera del agregado.** `mdm.Tenants.Version` es `bigint NOT NULL`, empieza en 1 y lo incrementa la aplicación en **toda** escritura del agregado, incluidas las de sus sedes; EF Core lo declara con `IsConcurrencyToken()` y es el **único** token del agregado. Una sede no tiene versión propia: su `ETag` es la versión de su organización. El `UPDATE` lleva `WHERE Id = @Id AND Version = @Esperada`; cero filas afectadas es un conflicto, que la API devuelve como **412** cuando el cliente mandó `If-Match` ([contrato de la API](../../../docs/03-construccion/contrato-api-organizacion-sede-mdm-001.es.md)). La misma versión será la `Sequence` del `TenantEvent` ([G-312](../../../GAPS.md)): monótona por organización, que es lo que el consumidor de UMS compara. **No se usa `rowversion`.** Es una desviación declarada de la práctica `ROWVERSION` del ruleset RS-BD-SQLSERVER del arquitecto de bases de datos de la suite, que [ADR-SIL-005](./SIL-005-nomenclatura-y-conceptos-no-portables-del-modelo-fisico.es.md) D5 sí sigue; no es excepción a ningún ADR `Aceptado`, porque el entero es el que ya pide [ADR-0016](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0016-pista-auditoria-inmutable-negocio.es.md). **Límite:** el token depende de que todo escritor pase por el agregado; un `UPDATE` directo a la base que no incremente `Version` rompe la garantía, y por eso la cuenta de la aplicación es la única que escribe.

<a id="d5"></a>**D5 — Unicidad de la clave natural sin filtro.** `UX_Tenants_Code` sobre `Code` y `UX_TenantBranches_TenantId_Code` sobre (`TenantId`, `Code`) **no** son índices filtrados: cubren también la organización archivada y la sede cerrada, porque el código no se reutiliza ([D-031](../../../DECISIONS.md#decisiones-locales), regla 1; [ADR-0164](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0164-el-borrado-es-logico-y-la-clave-natural-no-se-reutiliza.es.md) en `Borrador`, [G-324](../../../GAPS.md)). La única excepción es `UX_Tenants_CompanyReference`, que **sí** es filtrado (`WHERE [CompanyReference] IS NOT NULL`): la referencia de empresa es opcional y muchas organizaciones no la tienen, pero dos no pueden compartir una. Un choque con cualquiera de los tres índices es un 409; la infraestructura traduce los errores 2601 y 2627 de SQL Server por el nombre del índice y la aplicación los convierte en el código del contrato. `ParentTenantId` es una FK a `mdm.Tenants` y `TenantBranches.TenantId` otra, ambas sin cascada.

<a id="d6"></a>**D6 — Bitácora de la sede, append-only por diseño.** `mdm.BranchLifecycleEntries` solo recibe `INSERT` desde el agregado: cada alta, desactivación, reactivación y cierre añade una fila con su actor, su motivo y su instante. **El límite se declara:** en esta versión la garantía es de la aplicación; no hay `DENY UPDATE, DELETE` ni disparador, como sí tiene SIL ([ADR-SIL-005](./SIL-005-nomenclatura-y-conceptos-no-portables-del-modelo-fisico.es.md) D9). Se endurece cuando la bitácora tenga lectura y uso de auditoría ([G-325](../../../GAPS.md)).

## 5. Consecuencias

### Positivas

- El maestro y su consumidor hablan con los mismos nombres; el `TenantEvent` se arma sin traducción.
- Un solo número —`Version`— es a la vez el token de concurrencia, el `ETag` de la API y la secuencia del evento: no pueden divergir.
- La carga inicial puede conservar los `Guid` de UMS.

### Desventajas

- Dos idiomas en las bases de datos de este repositorio: español en SIL e inglés en MDM.
- Toda escritura de una sede compite por la fila de su organización: aceptable porque las sedes de una organización las edita poca gente a la vez.
- El token depende de la disciplina del escritor (D4) y la bitácora no está protegida por el motor (D6).
- Tres conceptos no portables atan el modelo a SQL Server ([ADR-0229](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0229-modelo-datos-logico-fisico-fase-diseno.es.md) §2.4).
- Las pruebas de integración corren sobre la imagen `mcr.microsoft.com/mssql/server:2022-latest` **sin fijar el nivel de compatibilidad** de la base: lo que pase allí no prueba el comportamiento en la versión que se despliegue ([G-321](../../../GAPS.md)).
- El esquema y la migración no se han ejecutado nunca contra un motor real ([G-328](../../../GAPS.md)).

### Acciones de Seguimiento

| Acción | Responsable | Fecha Límite |
|---|---|---|
| Registrar las convenciones en la migración `InitialCreate` (`HasConstraintName`, `HasDatabaseName`, índices únicos, `IsConcurrencyToken`): **hecho**, en `Mdm.Infrastructure.Migrations.SqlServer` | Construcción MDM | Hecho |
| Probar `InitialCreate` en un contenedor vacío y medir el plan de ejecución de los índices de lectura ([G-328](../../../GAPS.md), [G-330](../../../GAPS.md)) | Validación MDM | Cuando Docker esté disponible |
| Publicar `TenantEvent` con `Sequence = Version` desde un outbox ([G-312](../../../GAPS.md)) | Arquitectura MDM | Por definir |
| Decidir versión e instancia de SQL Server de MDM ([G-321](../../../GAPS.md)) | Arquitectura MDM / DBA | Por definir |

### Criterios para pasar a `Aceptado`

- El propietario del repositorio fusiona en `main` el PR que mueve el estado a `Aceptado` ([S-27](../../../DECISIONS.md#triaje-de-las-reglas-de-herencia)).
- Que el ADR de `organizacion_arch` sobre el dueño del maestro ([G-311](../../../GAPS.md)) se acepte; si se rechaza, este ADR se retira con D-031.

## 6. Cumplimiento y Trazabilidad

| Ítem | Link / Notas |
|---|---|
| Decisión del propietario | 2026-10-21: [D-031](../../../DECISIONS.md#decisiones-locales) |
| ADR de `organizacion_arch` que sostiene la decisión | [ADR-0229](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0229-modelo-datos-logico-fisico-fase-diseno.es.md) §3.4 y §3.5 (`Aceptado`) · [ADR-0054](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0054-estandares-diseno-normalizacion-base-datos.es.md) §3.3 (`Aceptado`) · [ADR-0031](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0031-esquema-por-contexto-catalogo-eventos-dominio.es.md) (`Aceptado`) · [ADR-0016](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0016-pista-auditoria-inmutable-negocio.es.md) (`Aceptado`) · [ADR-0051](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0051-estrategia-motor-base-datos-empresarial.es.md) §3.1 (`Aceptado`) |
| Historia Funcional | No existe para MDM ([G-323](../../../GAPS.md)) |
| Historia Técnica | [Especificación técnica del maestro de organización y sede](../../../docs/03-construccion/especificacion-tecnica-organizacion-sede-mdm-001.es.md), que hará de historia técnica cuando exista su historia funcional ([G-323](../../../GAPS.md)) |
| Bounded context afectado | MDM — maestro de organización y sede |
| Gaps abiertos | [G-311](../../../GAPS.md), [G-312](../../../GAPS.md), [G-313](../../../GAPS.md), [G-321](../../../GAPS.md), [G-324](../../../GAPS.md), [G-325](../../../GAPS.md), [G-327](../../../GAPS.md), [G-328](../../../GAPS.md), [G-330](../../../GAPS.md) |

## 7. Historial de Cambios

| Versión | Fecha | Autor | Cambios |
| :--- | :--- | :--- | :--- |
| 0.2.0 | 2026-10-21 | aarroyo | Alineado con lo construido: índices únicos `UX_` (no `UQ_`), `UX_Tenants_CompanyReference` filtrado, `IX_` de lectura, restricciones `CK_`, claves foráneas `NO ACTION`, intercalación `Latin1_General_100_CI_AS` por columna, clave primaria agrupada sobre `Guid` aceptada a esta escala y límites de la prueba sobre SQL Server 2022 |
| 0.1.0 | 2026-10-21 | aarroyo | Versión inicial en `Borrador`: esquema `mdm`, nomenclatura en inglés y `PascalCase` con tablas en plural, `datetimeoffset(3)`, `Guid` asignado por la aplicación, `Version bigint` como único token de concurrencia en lugar de `rowversion`, unicidad sin filtro de la clave natural y bitácora append-only por diseño |

---

<p align="center">
  <img src="https://img.shields.io/badge/Licencia-MIT-0f3e67?style=flat-square" alt="Licencia MIT">
  <img src="https://img.shields.io/badge/Mantenedor-Architecture_Board-042139?style=flat-square" alt="Mantenedor">
</p>

<p align="center">
  <strong>© Organización S.A.</strong> · RUC 20100412447 · Operador Logístico Aduanero desde 1978
</p>
