---
adr: MDM-002
estado: Borrador
supersede: []
deprecia_reglas: []
ambito_runtime: agnostico
---
# [ADR MDM-002](./MDM-002-modelo-geografico-de-la-suite.es.md): Modelo geográfico de la suite — escalera de niveles por país, lugares con códigos oficiales de autoridad y vigencia, sucesión territorial, lugares de comercio exterior y coordenadas por etapas

<p align="right">
  <img src="https://img.shields.io/badge/ORG%20S.A.-Operador_Log%C3%ADstico_Aduanero-0f3e67?style=for-the-badge&logoColor=white" alt="Organización S.A.">
  <img src="https://img.shields.io/badge/Estado-Borrador-825500?style=flat-square" alt="Estado">
  <img src="https://img.shields.io/badge/Versi%C3%B3n-0.2.0-042139?style=flat-square" alt="Versión">
</p>

> Estado: Borrador
> Fecha: 2026-10-24
> Owner: Arquitectura MDM (aarroyo), redactado por el agente `organizacion-architect`
> Fase relacionada: Diseño y Arquitectura
> Deriva de: [PRD-MDM-002](../../../docs/01-concepcion/prd-mdm-002.es.md) y del [análisis de fuentes de geografía](../../../docs/01-concepcion/fuentes/analisis-geografia-mdm.es.md); decisión local [D-047](../../../DECISIONS.md#decisiones-locales)
> Se apoya en (SD-03, todos `Aceptado`): [ADR-0264](https://github.com/organizacion-peru/organizacion-arch/blob/main/reference/architecture/adrs/core/0264-el-maestro-de-partes-es-party-con-roles-y-sigue-los-dos-ejes-del-erp.es.md) D7 (lo que varía por país es dato), [ADR-0097](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0097-integracion-entre-sistemas-suite-eventos-xms.es.md) (terceros por XMS; el contrato es del emisor), [ADR-0098](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0098-comunicacion-entre-agregados-intra-servicio.es.md) (una transacción, un agregado), [ADR-0051](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0051-estrategia-motor-base-datos-empresarial.es.md) (SQL Server en .NET), [ADR-0031](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0031-esquema-por-contexto-catalogo-eventos-dominio.es.md) (esquema por contexto) y [ADR-0229](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0229-modelo-datos-logico-fisico-fase-diseno.es.md) (conceptos no portables)
> Recupera como fuente de diseño, sin copiar código: `organizacion-scm#ADR-MMS-008` (modelo geográfico canónico), `organizacion-scm#ADR-MMS-009` (georreferencia), `organizacion-scm#ADR-MMS-010` (datos de terceros), `organizacion-scm#ADR-MMS-011` (geocodificación) y `organizacion-scm#ADR-MMS-012` (API geográfica), todos `Aceptado` en un repositorio que ya no existe y que no vinculan aquí
> Ámbito: **local, detalle de implementación de [ADR-0266](https://github.com/organizacion-peru/organizacion-arch/blob/main/reference/architecture/adrs/core/0266-la-geografia-de-la-suite-es-un-maestro-de-mdm-con-codigos-oficiales.es.md)** (`Aceptado`, núcleo), que hace de la geografía de MDM la referencia de toda la suite ([D-048](../../../DECISIONS.md#decisiones-locales)). Las decisiones de negocio que este borrador dejaba abiertas ya están tomadas: ubigeo INEI canónico, ISO 3166-1 y UN/LOCODE, revisión humana de sucesiones e importaciones, uso interno hasta confirmar licencias y un responsable del catálogo
> **No supersede a ninguna decisión.**

---

## 1. Contexto

La suite necesita una sola geografía. Hoy la dirección de un establecimiento lleva un `ubigeo` de texto y un `countryCode` sin catálogo ([DOM-MDM-002](../../../docs/02-diseno/modelo-dominio-organizacion-erp-mdm-002.es.md) §4.1), la del Cliente igual ([DOM-MDM-001](../../../docs/02-diseno/modelo-dominio-cliente-mdm-001.es.md) §3), y SIL registra puertos y depósitos sin un código común. Los documentos de comercio exterior —BL, manifiesto, declaración aduanera— identifican puertos con **UN/LOCODE** y países con **ISO 3166-1**; SUNAT exige el **ubigeo** de seis dígitos en la factura y en la guía de remisión ([análisis](../../../docs/01-concepcion/fuentes/analisis-geografia-mdm.es.md) §3).

El análisis de fuentes deja cinco hechos que el modelo tiene que soportar:

1. **Cada país tiene su propia escalera.** Perú: departamento, provincia, distrito; Chile: región, provincia, comuna; Estados Unidos: estado, condado. Imponer la peruana rompe el primer país extranjero.
2. **El Perú tiene más de un ubigeo.** INEI, RENIEC y SUNAT publican tablas que no coinciden en todo el territorio (POR VERIFICAR el alcance exacto, P-GEO-01).
3. **Los códigos no son uno a uno.** Lima tiene dos códigos ISO 3166-2 (`PE-LIM`, `PE-LMA`); GeoNames usa FIPS y no ISO en su primer nivel.
4. **El territorio cambia.** Se crean distritos, se dividen y se recodifican; una dirección vieja tiene que seguir resolviendo.
5. **Las fuentes tienen licencias distintas**, y la de UN/LOCODE es contradictoria en el propio sitio de UNECE.

## 2. Factores de decisión

- Un país nuevo o un nivel nuevo es **dato**, no despliegue (ADR-0264 D7).
- Un consumidor pide **el código que su trámite exige** (ubigeo SUNAT, UN/LOCODE, ISO) sin adivinar cuál guardó MDM.
- Ninguna referencia se rompe por una reforma territorial.
- Lo importado de un tercero se distingue de lo propio, y su licencia viaja con el dato.
- Dentro del stack autorizado: .NET 10 y SQL Server (D-008, ADR-0051); sin PostGIS.

## 3. Opciones consideradas

| Opción | Resumen | Ventajas | Desventajas |
|---|---|---|---|
| A. Tablas fijas por nivel | `Country`, `Department`, `Province`, `District` | Simple para el Perú | Rompe con el primer país distinto; un código por nivel; sin sucesión |
| B. Un campo `ubigeo` y un `countryCode` | Lo que hay hoy | Nada que construir | Elige un ubigeo arbitrario; no sirve a comercio exterior; sin historia |
| **C. Lugar canónico de n niveles con códigos oficiales como colección** | Escalera por país como dato; un agregado por unidad territorial; códigos con autoridad y vigencia; sucesión | Cubre los cinco hechos del §1; es el diseño ya aceptado en `organizacion-scm#ADR-MMS-008` | Más diseño inicial; la importación necesita revisión humana |

## 4. Decisión

**Opción C.**

<a id="d1"></a>**D1 — Contexto `Geography` en MDM.** La geografía es un contexto propio de MDM, con su esquema `mdm_geo` (ADR-0031), separado del contexto de partes. Las partes lo referencian solo por identificador (ADR-0098).

<a id="d2"></a>**D2 — La escalera de niveles es un agregado de política por país.** `CountryTerritorialSchema { countryId, levels[ { order, canonicalLabel (ADM1…ADM4), localLabel } ] }`. La escalera peruana es una instancia, no una estructura. Un país sin divisiones conocidas tiene escalera vacía y sigue siendo válido.

<a id="d3"></a>**D3 — `GeoPlace` es el agregado canónico, uno por unidad territorial.** Identidad interna estable (`GeoPlaceId`, `Guid`), tipo (`Country`, `AdministrativeDivision`, `Locality`, `TradeLocation`), nivel, **un solo padre por identificador**, ruta materializada derivada del padre (`PE/PE-LIM/1501/150101`) para consultar por prefijo, nombre oficial con formas normalizada y alternativas por idioma, estado (`Active`, `Historical`) y versión entera como `ETag` y `Sequence`. Invariantes: el padre existe y es del nivel anterior según la escalera de su país; no hay ciclos; un lugar `Historical` no admite hijos nuevos; un país exige ISO 3166-1 alfa-2. Una transacción toca un lugar, nunca el árbol.

<a id="d4"></a>**D4 — Los códigos oficiales son una colección con esquema, autoridad y vigencia.** `OfficialCode { scheme, value, authority, validFrom, validTo }`, con esquemas iniciales `ISO-3166-1-A2`, `ISO-3166-1-A3`, `ISO-3166-1-N`, `ISO-3166-2`, `UBIGEO-INEI`, `UBIGEO-RENIEC`, `UBIGEO-SUNAT` y `UN-LOCODE`, ampliables como catálogo. El par `(esquema, valor)` vigente identifica un solo lugar; un código vencido se conserva y sigue resolviendo. **El ubigeo canónico es `UBIGEO-INEI`** ([D-048](../../../DECISIONS.md#decisiones-locales)): es el que SUNAT exige en los comprobantes y la guía de remisión electrónicos. RENIEC y SUNAT, si difiere, se guardan como esquemas adicionales con correspondencia (D5). Los países usan `ISO-3166-1-A2` y los lugares de comercio exterior `UN-LOCODE` como esquema canónico.

<a id="d5"></a>**D5 — Correspondencias explícitas cuando no son uno a uno.** `CodeCorrespondence { fromScheme, fromValue, toScheme, toValue, kind (Equivalent, PartOf, Overlaps) }` registra, por ejemplo, que `PE-LIM` y `PE-LMA` reparten la región de Lima o que un ubigeo RENIEC corresponde a otro INEI.

<a id="d6"></a>**D6 — Sucesión territorial.** `SuccessionRelation { type (Creation, Split, Merge, Rename, Recoding, Reassignment), predecessors[], successors[], legalAct, effectiveOn }`. Un lugar que deja de existir pasa a `Historical` con su identidad intacta y apunta a sus sucesores; su `GeoPlaceId` y sus códigos no se reutilizan. Aprobar una sucesión produce la lista de direcciones afectadas para su revisión ([RF-GEO-010](../../../docs/01-concepcion/prd-mdm-002.es.md)); **ninguna dirección se reasigna sola**: cada una pasa por revisión ([D-048](../../../DECISIONS.md#decisiones-locales)).

<a id="d7"></a>**D7 — Los lugares de comercio exterior son `GeoPlace` de tipo `TradeLocation`.** Llevan su UN/LOCODE como código oficial, sus funciones (puerto marítimo, ferroviario, carretera, aeropuerto, postal, depósito interior, frontera), su estado UNECE y su padre administrativo. Un terminal o depósito sin UN/LOCODE se registra como lugar propio dentro del lugar UN/LOCODE que lo contiene, con código propio de Organización (esquema `ORG-SITE`). Si además es un establecimiento de una organización, el `Establishment` de DOM-MDM-002 lo referencia: un lugar no es una parte.

<a id="d8"></a>**D8 — `PostalZone` es un agregado aparte con relación M:N.** `{ id, countryId, code, places[], validity }`. Un país que no usa código postal no tiene zonas, sin campos nulos en cada lugar.

<a id="d9"></a>**D9 — Coordenadas por etapas, con su procedencia.** `GeoReference { point (lat, lon, WGS 84), precision, envelope?, source }` como objeto de valor del lugar. **Primera etapa:** solo el punto que traen los catálogos (UN/LOCODE, GeoNames). **Etapa posterior:** coordenadas de cada dirección y propuesta por geocodificación detrás de un **puerto** (`IGeocoder`), siempre marcada como propuesta hasta que una persona la confirma. En SQL Server se guarda con el tipo `geography` e índice espacial: concepto no portable que se declara según ADR-0229 §3.5. Elegir proveedor de geocodificación es decisión de stack y necesita su ADR (S-07, [G-614](../../../GAPS.md)).

<a id="d10"></a>**D10 — Importación de terceros en tres capas, con linaje y licencia.** Aterrizaje (el archivo tal cual), revisión de diferencias (altas, cambios, bajas y sucesiones propuestas, aprobadas por una persona) y canónico. Cada dato canónico conserva su fuente, versión de la fuente y licencia; lo que una licencia no permite redistribuir no sale en eventos ni en la API hacia terceros. Los archivos de terceros llegan por XMS cuando la fuente es un sistema (ADR-0097); un archivo descargado por una persona se carga en MDM.

<a id="d11"></a>**D11 — Contrato de lectura con granularidad y eventos de lugar.** API de consulta por código (cualquier esquema), por nombre normalizado, por ruta y por proximidad (etapa posterior), con vista `minimal`, `path` o `full` para no servir árboles completos. Evento `GeoPlaceEvent` de transferencia de estado con `sequence`, que transporta la sucesión para que un consumidor con una referencia vieja la remapee sin consultar a MDM. El contrato es de MDM como emisor.

<a id="d12"></a>**D12 — Las direcciones referencian un lugar.** `Address` de DOM-MDM-002 y de DOM-MDM-001 pasa a llevar `geoPlaceId` (el nivel más fino conocido) en lugar de `ubigeo` de texto; `countryCode` sale de la ruta del lugar. La transición es _expand/contract_: el campo de texto convive hasta que todas las direcciones tengan lugar ([RF-GEO-017](../../../docs/01-concepcion/prd-mdm-002.es.md), [G-615](../../../GAPS.md)).

## 5. Consecuencias

### Positivas

- Un país, un nivel, un código o una función UN/LOCODE nuevos son datos.
- Cada trámite obtiene el código que exige, con su autoridad visible.
- Ninguna reforma territorial rompe una referencia.
- La suite habla de puertos con el mismo código que navieras y aduanas.

### Desventajas

- Más diseño y una importación que exige revisión humana.
- El volumen de UN/LOCODE (unos 100 000 lugares) obliga a paginar y a no publicar el catálogo entero en eventos.
- Las licencias de ISO 3166-2 y de UN/LOCODE están sin resolver ([G-616](../../../GAPS.md)): hasta entonces, solo uso interno.
- Al ser local, SIL, el TMS y el Depósito Temporal pueden seguir con códigos propios ([G-613](../../../GAPS.md)).

### Acciones de seguimiento

| Acción | Responsable | Gap |
|---|---|---|
| ~~Elevar este ADR al núcleo~~ Hecho: ADR-0266 | Arquitectura | [G-613](../../../GAPS.md) |
| ADR del proveedor de geocodificación | Arquitectura | [G-614](../../../GAPS.md) |
| Transición de las direcciones de texto a `geoPlaceId` | Equipo MDM | [G-615](../../../GAPS.md) |
| Confirmar licencias de ISO 3166-2 y UN/LOCODE | Negocio y legal | [G-616](../../../GAPS.md) |
| ~~Decidir qué ubigeo manda y la reasignación~~ Hecho: D-048 | Negocio | [G-617](../../../GAPS.md) |

### Criterios para pasar a `Aceptado`

- ~~Respuesta de negocio a P-GEO-01 y P-GEO-08~~ (resueltas en D-048).
- ~~Licencias confirmadas o uso declarado como interno~~ (uso interno, D-048).
- Modelo de datos y contrato de la API de geografía redactados en la Fase 2.

## 6. Cumplimiento y trazabilidad

| Ítem | Link / Notas |
|---|---|
| PRD | [PRD-MDM-002](../../../docs/01-concepcion/prd-mdm-002.es.md): RF-GEO-001 a RF-GEO-020 |
| Análisis | [Análisis de fuentes de geografía](../../../docs/01-concepcion/fuentes/analisis-geografia-mdm.es.md) |
| Decisión local | [D-047](../../../DECISIONS.md#decisiones-locales) |
| Modelo afectado | [DOM-MDM-002](../../../docs/02-diseno/modelo-dominio-organizacion-erp-mdm-002.es.md) (`Address`) · [DOM-MDM-001](../../../docs/02-diseno/modelo-dominio-cliente-mdm-001.es.md) |
| Antecedente | `organizacion-scm#ADR-MMS-008` a `organizacion-scm#ADR-MMS-012` |

## 7. Historial de Cambios

| Versión | Fecha | Autor | Cambios |
| :--- | :--- | :--- | :--- |
| 0.2.0 | 2026-10-24 | aarroyo, con el agente `organizacion-architect` | Decisiones de negocio fijadas por el propietario (D-048): ubigeo INEI canónico, ISO 3166-1 y UN/LOCODE, revisión de sucesiones, uso interno hasta confirmar licencias, responsable del catálogo; elevado al núcleo como ADR-0266. Sigue en `Borrador` hasta tener el modelo de datos y el contrato de la API de geografía |
| 0.1.0 | 2026-10-24 | aarroyo, con el agente `organizacion-architect` | Versión inicial en `Borrador` desde PRD-MDM-002 y el análisis de fuentes del agente `organizacion-analyst` |

---

<p align="center">
  <strong>© Organización S.A.</strong> · RUC 20100412447 · Operador Logístico Aduanero desde 1978
</p>
