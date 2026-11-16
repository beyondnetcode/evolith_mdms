# Propuesta al núcleo — borrador de ADR: el maestro de partes de la suite es Party con roles, y la estructura organizativa sigue los dos ejes del ERP

> **Aceptado el 2026-10-24 como [ADR-0264](https://github.com/organizacion-peru/organizacion-arch/blob/develop/reference/architecture/adrs/core/0264-el-maestro-de-partes-es-party-con-roles-y-sigue-los-dos-ejes-del-erp.es.md)** en `organizacion_arch` ([PR 564](https://github.com/organizacion-peru/organizacion-arch/pull/564); promoción a `main` en el [PR 565](https://github.com/organizacion-peru/organizacion-arch/pull/565)). Este borrador queda como **registro de origen**; la norma es el ADR.
>
> **Qué es este archivo.** El borrador de un ADR para `organizacion_arch`, redactado en el satélite que lo necesita ([G-554](../../../GAPS.md), [D-043](../../../DECISIONS.md#decisiones-locales)). **No es un ADR de este repositorio ni vincula aquí** (S-06, SD-03). Su destino es `reference/architecture/adrs/core/` de `organizacion_arch`, con el número que se reclame al empujar allí (S-26, [ADR-0199](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0199-todo-identificador-denso-se-reclama-empujando.es.md)); por eso el número es `NNNN` y los enlaces son absolutos.
>
> **Cómo se propone.** `propose-upstream.mjs` del plugin abre una _issue_ en `organizacion-peru/organizacion_arch` con este texto; sin `--confirm` solo imprime lo que haría. No se ha ejecutado contra el remoto:
>
> ```bash
> node "$ORG_CORE/scripts/propose-upstream.mjs" \
>   --title "ADR: el maestro de partes de la suite es Party con roles; la estructura organizativa sigue los dos ejes del ERP" \
>   --body-file reference/architecture/propuestas-upstream/adr-modelo-party-y-estructura-organizativa.es.md \
>   --gap G-554
> ```
>
> Se propone **junto con** la [propuesta de dueños](./adr-mdm-dueno-maestro-organizacion-sede.es.md) ([G-311](../../../GAPS.md)): esta decide **la forma** del maestro; aquella, **quién es dueño de qué** entre MDM y UMS.

---

```yaml
adr: NNNN
estado: Borrador
supersede: []
deprecia_reglas: []
ambito_runtime: agnostico
```

## ADR NNNN: El maestro de partes de la suite es Party con roles, establecimientos y relaciones, y la estructura organizativa sigue los dos ejes del ERP

> Estado: Borrador
> Fecha: 2026-10-24
> Owner: Arquitectura de la suite (aarroyo)
> Fase relacionada: Diseño
> Motivado por: `organizacion-unilog` — D-043, G-554 y el [modelo de dominio DOM-MDM-002](https://github.com/organizacion-peru/organizacion-unilog/blob/develop/docs/02-diseno/modelo-dominio-organizacion-erp-mdm-002.es.md)
> Recupera: `organizacion-scm#ADR-MMS-017` (`Aceptado` el 2026-08-06 en un repositorio borrado; su texto sobrevive en un clon local, `organizacion-unilog#G-360`)

### 1. Contexto

**La escena (ilustrativa).** Una empresa de transporte trabaja con Organización como cliente: le compra servicios de exportación. Un mes después, Organización la contrata como transportista. En la suite queda dada de alta dos veces —una como cliente y otra como proveedor— con el mismo RUC y dos direcciones fiscales que ya no coinciden. Cuando cambia de razón social, la cambian en un registro y en el otro no.

**Por qué parece sano.** Cada registro es válido. Cada sistema muestra bien su lista. El ERP de backoffice, en cambio, ya lo resolvió hace años: en SAP S/4HANA el Business Partner es **uno** y se le asignan roles de deudor y de acreedor.

**El mecanismo.** La suite no tiene una decisión sobre la **forma** del maestro de partes. Cada sistema lo modela por su rol: UMS como `Tenant` con un tipo `CLIENT`/`SUPPLIER`, un diseño de MDM como `Customer`, SIL con proyecciones `cliente` y `proveedor`. La única decisión que lo resolvía, `organizacion-scm#ADR-MMS-017`, se perdió con el repositorio que la contenía.

Y la premisa que manda: **la suite siempre convive con un ERP de backoffice con su estructura organizativa** —sociedades, centros, almacenes—. MDM debe partir de esa base sin copiar el modelo de ningún ERP concreto.

### 2. Factores de Decisión

- **Un solo registro por persona u organización**, sea cual sea su papel ante Organización.
- **Seguir los dos ejes del ERP**: terceros (Business Partner con roles) y estructura empresarial (sociedad → centro → almacén), sin acoplarse a un ERP concreto.
- **Comercio exterior**: hay contrapartes sin RUC (consignatarios, embarcadores extranjeros) y vocabulario común (WCO, UN/EDIFACT 3035).
- **La identidad de acceso no es dato maestro**: el Tenant es de UMS ([ADR-0071](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0071-identidad-tenant-raiz-admin-root-tenant-owner.es.md), `Aceptado`).
- **La sucursal es dimensión de autorización**, no frontera técnica ([ADR-0010](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0010-estrategia-arquitectura-multitenant.es.md), `Aceptado`).

### 3. Opciones Consideradas

| Opción | Resumen | Ventajas | Desventajas |
|---|---|---|---|
| A. Un agregado por rol | `Customer`, `Supplier`, `Carrier`… cada uno con su identidad | Simple al inicio | Reproduce el duplicado; cada rol nuevo es un maestro nuevo |
| B. Organización = Tenant | El maestro de organizaciones es el Tenant de identidad | Ya construido en UMS | Mezcla seguridad con dato maestro; no admite contrapartes sin acceso |
| **C. Party con roles, establecimientos y relaciones** | Una Party por persona u organización; el rol es una asignación con vigencia | Elimina el duplicado; es el modelo del ERP; admite cualquier rol y país como dato | Más diseño inicial; los catálogos necesitan gobierno |

### 4. Decisión

**Opción C.**

<a id="d1"></a>**D1 — Party es la raíz del maestro de partes.** Persona u organización, con identidad subrogada (`Guid`) y un `Code` inmutable que no se reutiliza.

<a id="d2"></a>**D2 — El rol es una asignación con vigencia, no un subtipo.** Cliente, proveedor, transportista, agente de aduanas, consignatario y empresa del grupo (`INTERNAL_COMPANY`) son roles de una Party. Los datos comerciales o contables de un rol son de su dueño (CMS, ERP), que referencia la Party por identificador.

<a id="d3"></a>**D3 — La clave natural es `(país, esquema, valor)`.** El esquema (RUC, DNI, CE, pasaporte, RUT, EORI…) es una fila de catálogo con su patrón y, si existe, su código ISO 6523. Una Party puede tener varios identificadores con vigencia y uno primario.

<a id="d4"></a>**D4 — Establecimiento y relación son cosas distintas.** El **establecimiento** es un lugar de la **misma** Party (sede, planta, almacén), con su código de establecimiento tributario. La **relación** une Parties **distintas** (matriz-filial, grupo, agente de) con vigencia.

<a id="d5"></a>**D5 — Ningún nombre de ERP entra al modelo.** La correspondencia con sistemas externos es un **agregado aparte** `(sistema, instancia, tipo de objeto, clave)` → objeto del maestro, con su estado de sincronización. La traducción vive en el ACL de XMS ([ADR-0097](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0097-integracion-entre-sistemas-suite-eventos-xms.es.md), `Aceptado`).

<a id="d6"></a>**D6 — La estructura organizativa propia sigue al ERP en dos niveles.** La sociedad es una Party con rol `INTERNAL_COMPANY`; el centro o sede es un establecimiento. Los niveles sin consumidor en la suite —organizaciones de ventas y compras, áreas de control, centros de costo y beneficio— **se quedan en el ERP** hasta que un consumidor los pida.

<a id="d7"></a>**D7 — Lo que varía por país, documento o rol es dato.** Catálogos de esquemas, tipos de rol (con su código UN/EDIFACT 3035 como código, no como estructura), tipos de establecimiento y tipos de relación.

<a id="d8"></a>**D8 — Tenant y sucursal referencian el maestro con el mismo `Guid`.** El Tenant de UMS es una extensión de identidad sobre una Party organización; la sucursal de ADR-0010 es un ámbito de autorización sobre un establecimiento. Los dos comparten el `Guid` del objeto de MDM.

### 5. Consecuencias

#### Positivas

- El duplicado cliente/proveedor deja de ser posible por construcción.
- Cambiar de ERP cambia el ACL, no el maestro.
- Un rol, un país o un documento nuevo es una fila de catálogo, no un despliegue.

#### Desventajas / Compensaciones

- Más diseño inicial que un agregado por rol; los catálogos necesitan dueño y proceso.
- Una Party de persona natural es un banco de datos personales (Ley 29733): no se habilita sin la decisión de datos personales.
- Los consumidores que hoy esperan `TenantEvent` deben migrar a los eventos de Party y establecimiento.

#### Cuándo NO

Si la suite tuviera un solo tipo de contraparte y ningún ERP, un agregado por rol bastaría. No es el caso.

#### Antes de aceptar

- ¿Hay un modelo de dominio que implemente D1 a D8? (evidencia: DOM-MDM-002)
- ¿Está confirmada la estructura del ERP real o declarada como supuesto? (evidencia: `organizacion-unilog#G-356`)
- ¿UMS acepta el mismo `Guid` para Tenant y Party? (evidencia: respuesta de `organizacion-ums`)
- ¿Está decidido el tratamiento de personas naturales o bloqueado explícitamente? (evidencia: `organizacion-unilog#G-345`)

> **Uno, con muchos papeles.** Quien es cliente y proveedor es una sola parte con dos roles, no dos registros que divergen.

### 6. Cumplimiento y Trazabilidad

| Ítem | Link / Notas |
|---|---|
| Satélite que lo motiva | `organizacion-unilog`: D-043, G-554, DOM-MDM-002 |
| Antecedente | `organizacion-scm#ADR-MMS-017` (repositorio borrado; clon local, `organizacion-unilog#G-360`) |
| Bounded context afectado | MDM (maestro de partes); UMS (Tenant, sucursal); SIL y CMS (consumidores) |
| ADRs relacionados | [ADR-0071](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0071-identidad-tenant-raiz-admin-root-tenant-owner.es.md) · [ADR-0010](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0010-estrategia-arquitectura-multitenant.es.md) · [ADR-0097](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0097-integracion-entre-sistemas-suite-eventos-xms.es.md) · [ADR-0098](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0098-comunicacion-entre-agregados-intra-servicio.es.md) · [ADR-0225](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0225-el-sistema-de-data-maestra-se-llama-mdm.es.md) (`Borrador`) |

### 7. Historial de Cambios

| Versión | Fecha | Autor | Cambios |
| :--- | :--- | :--- | :--- |
| 0.1.0 | 2026-10-24 | aarroyo, con el agente `organizacion-architect` | Borrador redactado en `organizacion-unilog` para proponer en `organizacion_arch` |

---

<p align="center">
  <strong>© Organización S.A.</strong> · RUC 20100412447 · Operador Logístico Aduanero desde 1978
</p>
