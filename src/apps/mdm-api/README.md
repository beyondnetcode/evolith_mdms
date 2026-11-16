# mdm-api — servicio .NET de MDM

Backend de **MDM** (Sistema de Datos Maestros de la suite) sobre .NET 10 LTS, con Clean Architecture y Minimal APIs. Hoy implementa el CRUD del **maestro de organización (`Tenant`) y sede (`Branch`)**, autorizado por [D-031](../../../DECISIONS.md#decisiones-locales).

> **Alojamiento provisional.** MDM es un sistema propio de la suite y el catálogo lo sitúa en `organizacion-scm`. Este satélite lo aloja por decisión del propietario ([D-027](../../../DECISIONS.md#decisiones-locales)) hasta que `organizacion_arch` decida la frontera ([G-257](../../../GAPS.md)). D-031 amplía ese alojamiento solo a Tenant y Branch; no añadas otra lógica de negocio antes de cerrarlo.

## Estado

- **Hecho:** catorce endpoints de organización y sede bajo `/api/v1` (alta, consulta, listado, modificación, suspensión, reactivación, archivado; sedes con desactivación, reactivación y cierre), concurrencia optimista con `ETag` e `If-Match`, errores como Problem Details con `code`, autenticación por portador RS256 contra el JWKS de UMS y persistencia en SQL Server con EF Core (esquema `mdm`, migración `InitialCreate`).
- **Sin validar:** las 73 pruebas que usan SQL Server real (21 en `Mdm.Infrastructure.IntegrationTest` y 52 E2E en `Mdm.Presentation.IntegrationTest`) **no se han ejecutado nunca** ([G-328](../../../GAPS.md)).
- **Pendiente:** publicación de `TenantEvent` ([G-312](../../../GAPS.md)), carga inicial desde UMS ([G-313](../../../GAPS.md)), autorización por permiso ([G-314](../../../GAPS.md)), emisor real del portador ([G-315](../../../GAPS.md)). No lo despliegues con datos reales antes.

| Documento | Para qué |
| :--- | :--- |
| [Contrato de la API](../../../docs/03-construccion/contrato-api-organizacion-sede-mdm-001.es.md) | Endpoints, `ETag`, errores y catálogo de `code`; fuente mientras no haya OpenAPI ([G-258](../../../GAPS.md)) |
| [Especificación técnica](../../../docs/03-construccion/especificacion-tecnica-organizacion-sede-mdm-001.es.md) | Diseño, decisiones de construcción, pruebas y riesgos |
| [ADR-MDM-001](../../../reference/architecture/adrs/MDM-001-nomenclatura-y-conceptos-no-portables-de-mdm.es.md) | Modelo físico: esquema `mdm`, nombres, índices, `Version` como token |
| [D-031](../../../DECISIONS.md#decisiones-locales) | Decisión que autoriza el CRUD |
| [G-257](../../../GAPS.md) | Frontera de alojamiento de MDM pendiente en `organizacion_arch` |

## Estructura

| Proyecto | Capa | Depende de |
| :--- | :--- | :--- |
| `Mdm.Domain` | Dominio: agregado `Tenant` con sus `Branch` | `Unimar.Shells.Net.Ddd` ([G-318](../../../GAPS.md)) |
| `Mdm.Application` | Casos de uso (MediatR, FluentValidation) y puertos | Domain |
| `Mdm.Infrastructure` | EF Core sobre SQL Server: repositorio, unidad de trabajo, almacén de lectura | Application |
| `Mdm.Infrastructure.Migrations.SqlServer` | Migraciones de EF Core | Infrastructure |
| `Mdm.Presentation` | API HTTP (Minimal API con `MapGroup`) y autenticación | Application, Infrastructure |
| `Mdm.Domain.Test`, `Mdm.Application.Test`, `Mdm.Infrastructure.Test` | Pruebas unitarias y de arquitectura | su capa |
| `Mdm.Infrastructure.IntegrationTest` | Migración, repositorio y lectura con SQL Server en contenedor | Infrastructure |
| `Mdm.Presentation.IntegrationTest` | En proceso con `WebApplicationFactory` y E2E con SQL Server en contenedor | Presentation |

Las pruebas de arquitectura comprueban que Domain no referencia otra capa y que Application no referencia Infrastructure ni Presentation.

## Requisitos

- SDK de .NET 10 (`global.json` en la raíz fija la banda 10.0 y el ejecutor de pruebas Microsoft Testing Platform).
- Node 24 y las dependencias de `src/` para usar Nx (opcional).
- **Token de lectura del feed NuGet de `organizacion-peru`** para restaurar `Unimar.Shells.Net.Ddd` ([G-319](../../../GAPS.md)). `src/NuGet.Config` declara el feed; el token es de cada máquina y no se versiona (S-43).
- **Docker** para las pruebas con SQL Server real (imagen `mcr.microsoft.com/mssql/server:2022-latest`; en Apple Silicon corre emulada, [G-320](../../../GAPS.md)).

## Uso

Desde `src/`, con Nx:

```bash
npx nx run mdm-api:build      # compila con SonarAnalyzer y avisos como error
npx nx run mdm-api:test       # pruebas con el suelo de suelos-pruebas.txt (compila antes)
npx nx run mdm-api:coverage   # cobertura de Domain + Application, umbral 80 %
npx nx run mdm-api:serve      # http://localhost:5265
```

Sin Nx, desde la raíz del repositorio (los gates recorren todas las soluciones `src/apps/*/*.slnx`):

```bash
bash scripts/verify-local.sh build
bash scripts/verify-local.sh tests-dotnet
bash scripts/coverage-dotnet.sh src/apps/mdm-api --ci
```

### Probar un proyecto

Con Microsoft Testing Platform, `dotnet test` toma el proyecto con `--project` y necesita la entrada estándar cerrada. El comando fiable es:

```bash
DOTNET_CLI_UI_LANGUAGE=en dotnet test --project src/apps/mdm-api/Mdm.Domain.Test/Mdm.Domain.Test.csproj </dev/null
```

No pases `--nologo`: rompe el ejecutor. Cambia el `.csproj` por el del proyecto que quieras.

### Pruebas con Docker

`Mdm.Infrastructure.IntegrationTest` y las suites `EndToEnd` de `Mdm.Presentation.IntegrationTest` levantan SQL Server con Testcontainers y aplican la migración antes de probar. **Arranca Docker antes.** Sin él, esas pruebas se **saltan con el motivo** y el gate `tests-dotnet` sigue pasando porque su suelo es el total descubierto: solo verifica compilación y descubrimiento ([G-329](../../../GAPS.md)). Un verde sin Docker no valida el motor.

```bash
DOTNET_CLI_UI_LANGUAGE=en dotnet test --project src/apps/mdm-api/Mdm.Infrastructure.IntegrationTest/Mdm.Infrastructure.IntegrationTest.csproj </dev/null
DOTNET_CLI_UI_LANGUAGE=en dotnet test --project src/apps/mdm-api/Mdm.Presentation.IntegrationTest/Mdm.Presentation.IntegrationTest.csproj </dev/null
```

## Configuración

Ninguna de estas claves es secreto versionable: los valores reales llegan por entorno o por un gestor de secretos, nunca por el repositorio (S-43).

| Clave | Para qué | Notas |
| :--- | :--- | :--- |
| `ConnectionStrings:Mdm` | Cadena de conexión a SQL Server | **Obligatoria**: sin ella la API no arranca. `appsettings.Development.json` trae un marcador con `<definir-fuera-del-repo>` en la contraseña |
| `Authentication:Issuer` | Emisor esperado del portador | Defecto `ums-api`; por confirmar ([G-315](../../../GAPS.md)) |
| `Authentication:Audience` | Audiencia esperada | Defecto `mdm-api`; por confirmar ([G-315](../../../GAPS.md)) |
| `Authentication:Jwks:Url` | URL del JWKS de UMS | **Marcador** `https://ums.invalid/…` en `appsettings.json`: hay que fijarla por entorno. Fuera de Development exige HTTPS |
| `Authentication:Jwks:CacheMinutes` / `MinRefreshMinutes` | Vida del JWKS en memoria / mínimo entre recargas forzadas | 60 y 5 (ADR-0157 §4.4) |
| Token del feed NuGet | Restaurar `Unimar.Shells.Net.Ddd` | Solo en la máquina de quien compila ([G-319](../../../GAPS.md)) |

## Migraciones

Nada en el arranque de la API aplica migraciones. Las aplica **de forma explícita** `MdmDatabaseMigrator.MigrateAsync` (`Mdm.Infrastructure.Persistence`), que llama quien despliega o una prueba; cómo se invoca en cada entorno está por decidir ([G-322](../../../GAPS.md)).

Para generar o aplicar migraciones con `dotnet ef`, el proyecto de diseño es `Mdm.Infrastructure.Migrations.SqlServer`. Generar una migración no abre conexión; para `database update` o `script` contra una base real, la cadena va en una variable de entorno, nunca en un archivo:

```bash
export MDM_MIGRATIONS_CONNECTION='<cadena-de-conexión>'
```

## Contrato HTTP

Resumen; el contrato completo está [aquí](../../../docs/03-construccion/contrato-api-organizacion-sede-mdm-001.es.md).

| Método | Ruta | Respuesta |
| :--- | :--- | :--- |
| `GET` | `/health` | `200` con `{"estado":"ok"}`. Anónimo; sonda de vida que no consulta dependencias |
| `GET` · `POST` | `/api/v1/tenants` | Lista paginada · alta (`201` con `{id, version}`, `Location` y `ETag`) |
| `GET` · `PUT` · `DELETE` | `/api/v1/tenants/{id}` | Consulta · modificación · archivado (`204` con `ETag`; escrituras exigen `If-Match`) |
| `POST` | `/api/v1/tenants/{id}/suspend` · `/activate` | Suspende · reactiva |
| `GET` · `POST` | `/api/v1/tenants/{id}/branches` | Sedes de la organización · alta de sede |
| `GET` · `PUT` · `DELETE` | `/api/v1/tenants/{id}/branches/{branchId}` | Consulta · modificación · cierre |
| `POST` | `…/branches/{branchId}/deactivate` · `/reactivate` | Desactiva · reactiva |

Todo lo demás exige portador válido (`401` sin él). Los errores son `application/problem+json` (RFC 9457) con la extensión `code`. No hay documento OpenAPI todavía ([G-258](../../../GAPS.md)).

## Paquetes y pruebas

Las versiones se fijan en [`src/Directory.Packages.props`](../../Directory.Packages.props) (Central Package Management, ADR-0066 §3.1) y cada proyecto restaura con su `packages.lock.json`. FluentAssertions queda en 7.2.2, la última con licencia Apache 2.0 ([G-259](../../../GAPS.md)); MediatR, en 12.4.1, por la misma razón. El suelo de pruebas de cada proyecto está en [`suelos-pruebas.txt`](./suelos-pruebas.txt) y solo se revisa al alza; en los proyectos con contenedor es el total descubierto (ver arriba).

## Observabilidad

Solo log de ASP.NET Core a stdout y `/health`, como declara [DECISIONS.md](../../../DECISIONS.md#retención-y-protección-de-las-señales-de-observabilidad) ([G-004](../../../GAPS.md)).

---

<p align="center">
  <strong>© Organización S.A.</strong> · RUC 20100412447 · Operador Logístico Aduanero desde 1978
</p>
