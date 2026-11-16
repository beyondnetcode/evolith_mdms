# Propuesta al núcleo — borrador de ADR: MDM es el dueño de la organización y sus establecimientos; UMS es el dueño del Tenant

> **Aceptado el 2026-10-24 como [ADR-0265](https://github.com/organizacion-peru/organizacion-arch/blob/develop/reference/architecture/adrs/core/0265-mdm-es-dueno-de-la-organizacion-y-ums-del-tenant.es.md)** en `organizacion_arch` ([PR 564](https://github.com/organizacion-peru/organizacion-arch/pull/564); promoción a `main` en el [PR 565](https://github.com/organizacion-peru/organizacion-arch/pull/565)). Este borrador queda como **registro de origen**; la norma es el ADR.
>
> **Qué es este archivo.** El borrador de un ADR para `organizacion_arch`, redactado en el satélite que lo necesita ([G-311](../../../GAPS.md), [D-043](../../../DECISIONS.md#decisiones-locales)). **No es un ADR de este repositorio ni vincula aquí** (S-06, SD-03). Su destino es `reference/architecture/adrs/core/` de `organizacion_arch`, con el número que se reclame al empujar allí (S-26, [ADR-0199](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0199-todo-identificador-denso-se-reclama-empujando.es.md)); por eso el número es `NNNN` y los enlaces son absolutos.
>
> **Cómo se propone.** `propose-upstream.mjs` del plugin abre una _issue_ en `organizacion-peru/organizacion_arch` con este texto; sin `--confirm` solo imprime lo que haría. No se ha ejecutado contra el remoto:
>
> ```bash
> node "$ORG_CORE/scripts/propose-upstream.mjs" \
>   --title "ADR: MDM es el dueño de la organización y sus establecimientos; UMS es el dueño del Tenant y lo extiende sobre el maestro" \
>   --body-file reference/architecture/propuestas-upstream/adr-mdm-dueno-maestro-organizacion-sede.es.md \
>   --gap G-311
> ```
>
> Se propone **junto con** la [propuesta del modelo Party](./adr-modelo-party-y-estructura-organizativa.es.md) ([G-554](../../../GAPS.md)), que fija la forma del maestro. La v0.1.0 de este borrador hacía a MDM dueño del Tenant; D-043 la reorienta: el Tenant no es dato maestro.

---

```yaml
adr: NNNN
estado: Borrador
supersede: []
deprecia_reglas: []
ambito_runtime: agnostico
```

## ADR NNNN: MDM es el dueño de la organización y sus establecimientos — UMS es el dueño del Tenant y de la sucursal, y los extiende sobre el maestro con el mismo `Guid`

> Estado: Borrador
> Fecha: 2026-10-24
> Owner: Arquitectura de la suite (aarroyo)
> Fase relacionada: Diseño
> Precisa: [ADR-0071](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0071-identidad-tenant-raiz-admin-root-tenant-owner.es.md) §5.4 (los endpoints de tenant y de sucursal siguen en UMS para lo que es identidad; los datos de la organización y del establecimiento los escribe MDM)
> Motivado por: `organizacion-unilog` — D-031, D-043 y G-311; `organizacion-ums` — D-006 (contrato `TenantEvent`)

### 1. Contexto

**La escena (ilustrativa).** Lunes, 9:00. Para dar permisos a un equipo nuevo, un administrador da de alta en UMS la sucursal `CALLAO-2` de ORG. El martes, Datos Maestros registra en MDM la misma sede como `CALLAO_2`, porque SIL y el TMS la necesitan en sus listas. El miércoles un coordinador con perfil en `CALLAO-2` abre SIL y no ve ninguna solicitud: todas cuelgan de `CALLAO_2`.

**Por qué parece sano.** Nada falla. Cada sistema es coherente consigo mismo; lo que se rompió es la **identidad de la cosa**, y eso no lo mide ningún tablero.

**El mecanismo.** Dos preguntas distintas se responden como si fueran una. **Quién es la organización** y **dónde opera** —razón social, RUC, sedes— es dato maestro que usan SIL, el TMS, el DT, CMS y el ERP. **Quién entra a la suite** y **con qué alcance** —IdP, Tenant Raíz, sucursal como ámbito de permisos— es identidad. [ADR-0071](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0071-identidad-tenant-raiz-admin-root-tenant-owner.es.md) §5.4 pide a UMS endpoints de tenant y de sucursal sin separar las dos, y un primer diseño de MDM (D-031 de `organizacion-unilog`) hizo lo inverso: se quedó con todo.

### 2. Factores de Decisión

- **Un solo sistema de registro por dato maestro**, y un solo nacimiento por cosa: el mismo `Guid` en toda la suite.
- **La identidad no es dato maestro** ([ADR-0071](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0071-identidad-tenant-raiz-admin-root-tenant-owner.es.md) D1 a D4, [ADR-0157](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0157-firma-asimetrica-portador-ums-jwks.es.md)).
- **La sucursal es dimensión de negocio y de autorización** ([ADR-0010](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0010-estrategia-arquitectura-multitenant.es.md), `Aceptado`): el lugar es dato maestro; el permiso, identidad.
- **El dueño del contrato es el emisor** ([ADR-0097](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0097-integracion-entre-sistemas-suite-eventos-xms.es.md) D6, `Aceptado`).

### 3. Opciones Consideradas

| Opción | Resumen | Ventajas | Desventajas |
|---|---|---|---|
| A. UMS dueño de todo | UMS crea organizaciones y sedes; los demás proyectan | Ya construido | El sistema de identidad se vuelve maestro de negocio; las contrapartes sin acceso no tienen dónde vivir |
| B. MDM dueño de todo (v0.1.0) | MDM crea organización, sede y Tenant; UMS proyecta | Un solo escritor | Mete seguridad en el maestro; contradice ADR-0071 |
| **C. Cada uno lo suyo, con el mismo `Guid`** | MDM: organización y establecimiento. UMS: Tenant y sucursal como extensiones con el mismo `Guid` | Un nacimiento por cosa; cada sistema guarda lo que entiende; casi sin tensión con ADR-0071 | Hay que construir outbox, carga inicial y reconciliación |

### 4. Decisión

**Opción C.**

<a id="d1"></a>**D1 — MDM es el sistema de registro de la organización y sus establecimientos.** La organización es una Party de tipo organización y la sede un establecimiento suyo (forma fijada por el ADR del modelo Party). Ningún otro sistema crea ni edita su nombre, sus identificadores, su jerarquía ni sus establecimientos.

<a id="d2"></a>**D2 — UMS es el sistema de registro del Tenant y de la sucursal.** El Tenant es una extensión de identidad sobre una organización del maestro, **con su mismo `Guid`**: `IdpStrategy`, `ShowOnLogin`, `IsManagementOwner`, `DefaultSystemSuiteId`, proveedores de identidad y parámetros. La sucursal es un ámbito de autorización sobre un establecimiento, **con su mismo `Guid`**. UMS decide qué organizaciones son Tenant y qué establecimientos son sucursal. El Tenant Raíz y los dos sombreros de ADR-0071 siguen en UMS sin cambios.

<a id="d3"></a>**D3 — Precisa ADR-0071 §5.4.** Los endpoints de tenant y de sucursal de UMS escriben solo atributos de identidad. Los datos de la organización y del establecimiento se escriben en MDM.

<a id="d4"></a>**D4 — Reglas del maestro.** (1) El `Code` es inmutable, se normaliza y no se reutiliza; (2) no hay borrado físico: archivar y cerrar son terminales ([ADR-0164](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0164-el-borrado-es-logico-y-la-clave-natural-no-se-reutiliza.es.md), hoy `Borrador`); (3) cada agregado tiene una versión entera monótona que es la `Sequence` de sus eventos y el `ETag` de su API.

<a id="d5"></a>**D5 — El contrato es de MDM.** Los eventos de organización y de establecimiento son contrato de MDM, con AsyncAPI y sobre CloudEvents ([ADR-0097](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0097-integracion-entre-sistemas-suite-eventos-xms.es.md) D6). Sustituyen al `TenantEvent` que hoy vive en el repositorio del consumidor; la migración conserva los campos que UMS ya lee (`Subject`, `Code`, `Name`, `Status`, `Sequence`).

<a id="d6"></a>**D6 — Transición sin doble identidad.** Antes de que MDM publique, una carga inicial lleva a MDM las organizaciones y sedes de UMS **con su mismo `Guid` y su mismo `Code`**, y las sociedades y centros del ERP con su correspondencia. Hasta entonces UMS sigue siendo la fuente efectiva en los entornos con datos reales.

### 5. Consecuencias

#### Positivas

- La escena del §1 deja de ser posible: la sede nace una vez, en MDM, y UMS la convierte en sucursal sin crear otra.
- UMS guarda solo identidad, que es lo que ADR-0071 ya le asigna.
- El contrato vive con su emisor.

#### Desventajas / Compensaciones

- MDM debe publicar con garantía de entrega (outbox, [ADR-0033](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0033-patron-transactional-outbox.es.md)).
- UMS deja de escribir nombre, código, jerarquía y sedes, y depende de MDM para conocer una organización nueva; debe declarar qué hace si MDM no responde (S-42).
- Cerrar un establecimiento que es sucursal con usuarios activos cruza dos sistemas: hay que decidir si MDM consulta, si UMS reacciona o si es una saga.

#### Cuándo NO

Si solo un sistema usara la organización y la sede, la opción A bastaría. No es el caso.

#### Acciones de Seguimiento

| Acción | Responsable | Fecha Límite |
|---|---|---|
| Acordar `PartyEvent` y `EstablishmentEvent` con UMS | Equipos MDM y UMS | Antes de publicar |
| Carga inicial con el mismo `Guid` y `Code` | Equipos MDM y UMS | Antes de desplegar MDM con datos reales |
| Reducir el Tenant de UMS a extensión de identidad | Equipo UMS | Tras la carga inicial |
| Decidir el cierre de un establecimiento que es sucursal | Arquitectura | Por definir |

#### Antes de aceptar

- ¿Existe el ADR del modelo Party aceptado o se propone a la vez? (evidencia: su número)
- ¿La carga inicial conserva `Guid` y `Code`? (evidencia: prueba de reconciliación sin diferencias)
- ¿Ningún endpoint de UMS escribe ya nombre, código o sedes? (evidencia: el código de UMS)
- ¿Está declarado qué hace UMS si MDM no responde? (evidencia: su Blueprint, S-42)

> **Una sede, un nacimiento.** Lo que todos usan lo registra uno solo; quien da permisos lo extiende, no lo copia.

### 6. Cumplimiento y Trazabilidad

| Ítem | Link / Notas |
|---|---|
| Satélite que lo motiva | `organizacion-unilog`: D-031, D-043, G-311 |
| Consumidor existente | `organizacion-ums`: D-006, `src/apps/ums.api/Organización.Ums.Infrastructure/MasterData/TenantProjectionConsumer.cs` |
| Bounded context afectado | MDM (organización y establecimientos) y UMS (Tenant y sucursal) |
| ADRs relacionados | [ADR-0071](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0071-identidad-tenant-raiz-admin-root-tenant-owner.es.md) (precisado) · [ADR-0010](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0010-estrategia-arquitectura-multitenant.es.md) · [ADR-0097](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0097-integracion-entre-sistemas-suite-eventos-xms.es.md) · [ADR-0033](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0033-patron-transactional-outbox.es.md) · [ADR-0099](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0099-topologia-de-repositorios-de-la-suite.es.md) · [ADR-0164](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0164-el-borrado-es-logico-y-la-clave-natural-no-se-reutiliza.es.md) y [ADR-0225](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0225-el-sistema-de-data-maestra-se-llama-mdm.es.md) (`Borrador`) |

### 7. Historial de Cambios

| Versión | Fecha | Autor | Cambios |
| :--- | :--- | :--- | :--- |
| 0.1.0 | 2026-10-21 | aarroyo | Borrador redactado en `organizacion-unilog` para proponer en `organizacion_arch`: MDM dueño de organización, sede y Tenant |
| 0.2.0 | 2026-10-24 | aarroyo, con el agente `organizacion-architect` | Reorientado por D-043: MDM dueño de la organización y sus establecimientos; UMS dueño del Tenant y de la sucursal con el mismo `Guid`; ADR-0071 se precisa, no se acota |

---

<p align="center">
  <strong>© Organización S.A.</strong> · RUC 20100412447 · Operador Logístico Aduanero desde 1978
</p>
