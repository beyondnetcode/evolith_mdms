# Cuestionario para TI — el ERP de backoffice y su estructura organizativa (MDM)

<p align="right">
  <img src="https://img.shields.io/badge/ORG%20S.A.-Operador_Log%C3%ADstico_Aduanero-0f3e67?style=for-the-badge&logoColor=white" alt="Organización S.A.">
  <img src="https://img.shields.io/badge/Estado-Borrador-825500?style=flat-square" alt="Estado">
  <img src="https://img.shields.io/badge/Versi%C3%B3n-0.1.0-042139?style=flat-square" alt="Versión">
</p>

> **Para:** TI de Organización y el equipo funcional del ERP (por designar, ver §7)
> **De:** Arquitectura MDM (aarroyo)
> **Motivo:** el modelo base de MDM ([DOM-MDM-002](./modelo-dominio-organizacion-erp-mdm-002.es.md), [D-043](../../DECISIONS.md#decisiones-locales)) parte de la estructura organizativa del ERP, pero hoy esa estructura es una **hipótesis** ([G-532](../../GAPS.md), [G-545](../../GAPS.md), [G-546](../../GAPS.md))
> **Hub del área:** [MDM — Datos Maestros](./hub-mdm.es.md)

---

## 1. Para qué sirve este cuestionario

MDM va a ser el registro único de **quién es quién** (empresas y personas, con sus roles de cliente, proveedor, transportista…) y de **dónde opera** cada una (sedes, plantas). Queremos que parta de lo que ya existe en el ERP y no que invente una estructura paralela.

Hoy solo sabemos que «la contabilidad la lleva el ERP (SAP), vía XMS» y que hay dudas sobre qué sistema lleva el stock de suministros ([D-012](../../DECISIONS.md#decisiones-locales)). No sabemos qué producto de SAP es, cómo está configurado ni si es donde nacen clientes y proveedores.

**Qué no pedimos:** acceso al ERP ni datos personales. Basta con la estructura y con extractos sin datos personales (§6).

## 2. Identificación del ERP

| # | Pregunta | Por qué importa en MDM |
| :--- | :--- | :--- |
| E-01 | ¿Qué ERP es exactamente? SAP S/4HANA, SAP ECC, SAP Business One u otro; versión y si es nube o local | Cambia la correspondencia entera: en S/4HANA y ECC hay sociedad → centro → almacén; en Business One, empresa (base de datos) → sucursal → almacén |
| E-02 | ¿Cuántas instancias o mandantes hay (producción, calidad, desarrollo) y cuál es la fuente de verdad? | Las claves del ERP solo son únicas dentro de su mandante: MDM las guarda con la instancia |
| E-03 | ¿Hay planes de migración o cambio de ERP en los próximos dos años? | Si los hay, la correspondencia debe convivir con dos ERP a la vez |
| E-04 | ¿Quién es el equipo funcional responsable y quién el técnico (interfaces)? | Para designar los dueños de [G-087](../../GAPS.md) |

## 3. Estructura empresarial propia

| # | Pregunta | Por qué importa en MDM |
| :--- | :--- | :--- |
| S-01 | ¿Cuántas sociedades (empresas con RUC) hay configuradas? ¿Una por RUC? ¿Hay empresas del grupo además de Organización S.A.? | Cada sociedad será una Party con rol `INTERNAL_COMPANY` |
| S-02 | ¿Qué centros existen y a qué sociedad pertenece cada uno? | Candidatos a establecimientos de MDM |
| S-03 | ¿Cómo se corresponden las **sedes** del negocio (Callao, Piura…) con los centros: uno a uno, una sede con varios centros o varias sedes en un centro? | Es la duda principal de [G-545](../../GAPS.md): decide si la sede es el centro o algo por encima o por debajo |
| S-04 | ¿Se registra en el ERP el código de establecimiento anexo de SUNAT por sede o por centro? | El establecimiento de MDM lo lleva; la facturación electrónica lo usa |
| S-05 | ¿Qué almacenes hay, de qué centro cuelga cada uno y su código es único en toda la empresa o solo dentro del centro? ¿Son los mismos que gestiona el WMS? | El almacén está fuera de la primera entrega de MDM ([G-547](../../GAPS.md)); queremos saber si entrará como establecimiento o como sublugar |
| S-06 | ¿Qué organizaciones de ventas, canales, sectores y organizaciones de compras hay? | Por ahora se quedan en el ERP; confirmar que ningún sistema de la suite las necesita |
| S-07 | ¿Qué centros de costo y de beneficio hay y quién los mantiene? | Fuera del modelo hasta que exista un consumidor ([G-548](../../GAPS.md)) |
| S-08 | Cuando se abre una sede o un almacén nuevo, ¿dónde nace primero, quién lo da de alta y cuánto tarda en estar operativo? | Decide si el ERP origina y MDM adopta, o al revés ([G-546](../../GAPS.md)) |

## 4. Terceros: clientes, proveedores y transportistas

| # | Pregunta | Por qué importa en MDM |
| :--- | :--- | :--- |
| T-01 | ¿Clientes y proveedores son un único **Business Partner** con roles (deudor y acreedor) o maestros separados? | MDM los modela como una Party con roles; si el ERP los separa, el ACL los une |
| T-02 | ¿Cuántos clientes, proveedores y transportistas activos hay, aproximadamente? ¿Cuántas altas al mes? | Volumen para dimensionar MDM ([G-543](../../GAPS.md)) |
| T-03 | ¿Qué identificadores se guardan (RUC, DNI, CE, pasaporte, identificadores extranjeros) y se valida el RUC contra SUNAT? | Catálogo de esquemas de identificador ([G-538](../../GAPS.md), [G-555](../../GAPS.md)) |
| T-04 | ¿Hay duplicados conocidos (mismo RUC con varios códigos)? ¿Cuántos? | Calidad de la carga inicial y fusión de duplicados ([G-537](../../GAPS.md)) |
| T-05 | ¿Se registran grupos económicos o relaciones matriz-filial entre terceros? | MDM lo modela como relación entre Parties |
| T-06 | ¿Hoy dónde nace un cliente nuevo: en el ERP, en otro sistema o en una hoja de cálculo? ¿Quién lo aprueba? | Quién origina la identidad del tercero ([G-533](../../GAPS.md), [G-542](../../GAPS.md)) |
| T-07 | ¿Se guardan personas naturales (por ejemplo conductores o clientes sin RUC)? ¿Con qué datos? | Ley 29733: MDM no guarda personas naturales hasta resolver [G-534](../../GAPS.md) |

## 5. Integración

| # | Pregunta | Por qué importa en MDM |
| :--- | :--- | :--- |
| I-01 | ¿Qué interfaces ofrece el ERP para leer y escribir sociedades, centros y terceros (OData, BAPI/RFC, IDoc, Service Layer, archivos)? | Define el ACL de XMS ([ADR-0097](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0097-integracion-entre-sistemas-suite-eventos-xms.es.md)) |
| I-02 | ¿El ERP puede **notificar** cambios (eventos, IDoc de salida, webhooks) o hay que consultarlo periódicamente? | Sincronización por eventos o por barrido |
| I-03 | ¿Qué otros sistemas leen hoy los maestros del ERP (TMS, WMS, portales) y cómo? | Consumidores a migrar a MDM ([G-077](../../GAPS.md)) |
| I-04 | ¿Hay límites de longitud o de caracteres en nombres y códigos (por ejemplo 35 o 40 caracteres)? | El ACL trunca; el maestro no |

## 6. Extractos que pedimos

Sin datos personales; basta con códigos, nombres de unidad y relaciones.

| Si el ERP es SAP S/4HANA o ECC | Si es SAP Business One | Contenido |
| :--- | :--- | :--- |
| `T001` | `OADM` | Sociedades / empresa |
| `T001W` | `OBPL` | Centros / sucursales |
| `T001L` | `OWHS` | Almacenes |
| `TVKO`, `TVTW`, `TSPA`, `T024E` | — | Organizaciones de ventas y compras, canales, sectores |
| `TKA01`, `CEPC`, `CSKS` | `OPRC` | Áreas de control, centros de beneficio y de costo |
| Recuento por rol de `BUT000` / `BUT100` | Recuento por tipo de `OCRD` | Cuántos terceros hay por rol, sin nombres |

## 7. Registro de envío y respuestas

**No se ha enviado.** Falta designar el destinatario en TI y el responsable funcional del ERP ([G-087](../../GAPS.md)).

| Fecha | Acción | Quién | Resultado |
| :--- | :--- | :--- | :--- |
| 2026-10-24 | Cuestionario redactado | aarroyo, con el agente `organizacion-architect` | Pendiente de envío |

Las respuestas se registran aquí y actualizan [DOM-MDM-002](./modelo-dominio-organizacion-erp-mdm-002.es.md) §5 y §9 y los gaps que cita cada pregunta.

## 8. Historial de cambios

| Versión | Fecha | Autor | Cambios |
| :--- | :--- | :--- | :--- |
| 0.1.0 | 2026-10-24 | aarroyo, con el agente `organizacion-architect` | Versión inicial: 23 preguntas en cuatro bloques y extractos para SAP S/4HANA, ECC o Business One |

---

<p align="center">
  <strong>© Organización S.A.</strong> · RUC 20100412447 · Operador Logístico Aduanero desde 1978
</p>
