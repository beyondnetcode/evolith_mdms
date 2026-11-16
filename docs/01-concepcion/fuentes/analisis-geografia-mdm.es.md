# Análisis de fuentes y requisitos: geografía de la suite (MDM)

<p align="right">
  <img src="https://img.shields.io/badge/ORG%20S.A.-Operador_Log%C3%ADstico_Aduanero-0f3e67?style=for-the-badge&logoColor=white" alt="Organización S.A.">
  <img src="https://img.shields.io/badge/Estado-Borrador-825500?style=flat-square" alt="Estado">
  <img src="https://img.shields.io/badge/Versi%C3%B3n-0.1.0-042139?style=flat-square" alt="Versión">
  <img src="https://img.shields.io/badge/Tipo-An%C3%A1lisis_de_fuentes-003c6b?style=flat-square" alt="Tipo">
</p>

> **Tipo:** documento fuente de la Fase 1 (insumo de análisis, no artefacto de la cadena SDLC)
> **Fase:** 1 — Concepción y Descubrimiento
> **Alcance:** local
> **Estado:** Borrador
> **Elaborado por:** agente `organizacion-analyst` («Diana»), a pedido del propietario
> **Uso en este repositorio:** base de los futuros `PRD-MDM-002` (geografía de la suite) y `ADR-MDM-002`, que aún no existen. Este análisis **no decide ni diseña**: ordena estándares, consumidores, casos difíciles y requisitos candidatos para que el PRD y el ADR partan de evidencia
> **Antecedente en el repositorio:** [DOM-MDM-002 §10](../../02-diseno/modelo-dominio-organizacion-erp-mdm-002.es.md#10-qué-se-adopta-del-mdm-original) deja para «más adelante» la «geografía de niveles independiente del país» del MDM original (`organizacion-scm#ADR-MMS-008`); [G-538](../../../GAPS.md) pide decidir dónde vive y quién mantiene el catálogo de ubigeo
> **Hub del área:** [MDM — Datos Maestros](../../02-diseno/hub-mdm.es.md)

---

**Convención de evidencia (SD-05).** Cada afirmación lleva su fuente. **Verificado** significa que se leyó en la fuente oficial citada al redactar este documento. **Fuente secundaria** significa que se leyó en una fuente no oficial (por ejemplo, Wikipedia o un empaquetado de terceros) y debe contrastarse con la autoridad. **POR VERIFICAR** marca lo que no se pudo confirmar (sitio inaccesible o sin dato). **SUPUESTO** marca una inferencia del analista sin respaldo documental. Las cifras de volumen son **estimaciones** orientativas.

## Tabla de Navegación

| Sección | Contenido |
| :--- | :--- |
| [1. Propósito](#1-propósito) | Qué se quiere representar y por qué |
| [2. Estándares y fuentes](#2-estándares-y-fuentes) | Autoridad, contenido, granularidad, actualización y licencia de cada fuente |
| [3. Consumidores y código que necesita cada uno](#3-consumidores-y-código-que-necesita-cada-uno) | Quién usa la geografía y con qué código |
| [4. Casos difíciles del Perú](#4-casos-difíciles-del-perú) | Divergencias, sucesión, homónimos, Callao, tildes |
| [5. Necesidades internacionales](#5-necesidades-internacionales) | Niveles no comparables, transliteración, puertos fuera de UN/LOCODE |
| [6. Volúmenes orientativos](#6-volúmenes-orientativos) | Órdenes de magnitud por fuente |
| [7. Requisitos candidatos para el PRD](#7-requisitos-candidatos-para-el-prd) | Lista R-GEO en lenguaje de negocio |
| [8. Preguntas para negocio](#8-preguntas-para-negocio) | Lista P-GEO |
| [9. Supuestos y riesgos](#9-supuestos-y-riesgos) | Supuestos, riesgos y hallazgos para `GAPS.md` |
| [10. Historial de cambios](#10-historial-de-cambios) | Versiones |

## 1. Propósito

La suite necesita un **lenguaje común para decir «dónde»**: dónde está la dirección fiscal de un cliente, dónde opera un establecimiento, desde qué puerto sale un contenedor y a qué país va. Hoy cada pieza lo resuelve a su manera: el contrato de Party admite un `ubigeo` de seis dígitos solo para Perú y guarda departamento, provincia y distrito como **texto libre** ([openapi-party-mdm-002.yaml](../../03-construccion/openapi-party-mdm-002.yaml), esquema `Address`); el modelo de Cliente lo declara «texto informativo mientras no haya catálogo de ubigeo» ([DOM-MDM-001](../../02-diseno/modelo-dominio-cliente-mdm-001.es.md), §7.2).

Este análisis prepara la definición de una geografía con tres capas, en lenguaje de negocio:

1. **País**, identificado con un código internacional (ISO 3166-1).
2. **Niveles administrativos propios de cada país**, sin forzar un número fijo de niveles: en Perú, Departamento → Provincia → Distrito (y, por debajo, centros poblados); en otros países, _State_ / _County_, regiones, comunas, etc.
3. **Códigos de cada esquema** que los consumidores exigen: ubigeo en Perú (INEI, RENIEC, SUNAT), subdivisión ISO 3166-2 en el ámbito internacional, y **lugares de comercio y transporte** (UN/LOCODE) para exportación, importación y negocios internacionales: puertos, aeropuertos, terminales ferroviarios y de carretera, depósitos interiores (ICD) y zonas económicas especiales.

La geografía administrativa (dónde está una dirección) y la geografía logística (por dónde pasa la carga) **no son la misma lista**: un puerto UN/LOCODE identifica una ciudad o área con función portuaria, no un distrito; y un distrito no es un lugar de comercio. El PRD deberá tratarlas como catálogos relacionados, no fusionados (SUPUESTO del analista, a confirmar en el ADR).

## 2. Estándares y fuentes

Consultas hechas al redactar este documento: [ISO 3166](https://www.iso.org/iso-3166-country-codes.html) (verificado), [UN/LOCODE — Recomendación 16](https://unlocode.unece.org/recommendation16), [publicaciones](https://unlocode.unece.org/publications) y [términos](https://unlocode.unece.org/terms) (verificados), [GeoNames](https://www.geonames.org/) y su [readme de descarga](https://download.geonames.org/export/dump/readme.txt) (verificados), [INEI](https://www.inei.gob.pe/) (portada verificada; no se llegó al catálogo de ubigeo). La página `unece.org/trade/cefact/unlocode-code-list-country-and-territory` y los sitios de SUNAT para comprobantes electrónicos respondieron **403** y no pudieron leerse.

| Fuente | Autoridad | Qué contiene | Granularidad | Actualización | Licencia y redistribución |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ISO 3166-1** | ISO 3166 Maintenance Agency (ISO/MA), con UNECE, UPU, OACI, UIT e ICANN entre sus miembros. El código numérico lo asigna la ONU (verificado) | Códigos de país en tres formas: alfa-2 (recomendado de uso general), alfa-3 y numérico de tres dígitos (verificado). No define los nombres de país: vienen de la ONU (verificado) | País, dependencia o área de interés geopolítico | Continua, en la Online Browsing Platform (OBP); suscripción de pago con notificaciones y archivos `.csv`, `.xml`, `.xls` (verificado) | ISO «permite el uso gratuito» de los códigos de país (verificado). La **redistribución del listado** como conjunto de datos y el alcance de la suscripción: **POR VERIFICAR** (el sitio exige permiso escrito para reproducir sus materiales) |
| **ISO 3166-2** | ISO/MA (verificado) | Subdivisiones principales: alfa-2 del país + guion + hasta tres caracteres, por ejemplo `ID-RI` (verificado). Nombres tomados de fuentes nacionales (verificado) | Primer nivel (y a veces segundo) de cada país. Para Perú, 26 códigos: 25 regiones más `PE-LMA` (fuente secundaria) | Continua en la OBP; ISO dejó de emitir boletines en 2013 (fuente secundaria) | Igual que ISO 3166-1: uso gratuito; redistribución **POR VERIFICAR** |
| **ISO 3166-3** | ISO/MA (verificado) | Códigos alfa-4 de nombres de país retirados (verificado) | País histórico | Con cada baja | Igual que ISO 3166-1 |
| **UN/LOCODE** | UNECE, a través de UN/CEFACT, Recomendación 16 (verificado) | Código de cinco caracteres: alfa-2 ISO 3166-1 + tres caracteres del lugar (letras y dígitos 2 a 9). Atributos: nombre con y sin diacríticos, subdivisión ISO 3166-2, **función**, **estado**, fecha, IATA, **coordenadas** y observaciones (verificado). **Funciones:** `1` puerto marítimo, `2` ferroviario, `3` carretera, `4` aeropuerto, `5` centro postal internacional reconocido por la UPU, `6` instalación multimodal (ICD o puerto seco, depósito de contenedores, terminal interior de carga), `7` instalación fija (oleoducto, plataforma), `8` vía navegable interior, `A` zona económica especial, `0` no funcional oficialmente; `B` **frontera** es un código antiguo que **no debe usarse** (verificado). **Estados activos:** `AM` aprobado, `RL` reconocido sin relevancia comercial confirmada, `RQ` en estudio (no debe usarse en intercambio electrónico), `XX` se eliminará; más estados heredados (`AA`, `AC`, `AF`, `AI`, `AS`, `AQ`, `RN`) (verificado) | Ciudad o área económica relevante para el comercio; las terminales dentro de un lugar **no** reciben código propio sino «códigos hijo» (verificado) | Publicación oficial **semestral** según UNECE; la última oficial visible es **2025-1 (enero de 2025)**, y una prerrelease se actualiza de forma continua (verificado). Por qué no hay una oficial posterior: **POR VERIFICAR** | **Contradictoria.** Los términos del sitio limitan la descarga a «uso personal, no comercial», sin redistribuir ni crear obras derivadas; el pie del mismo sitio dice «todos los estándares UN/CEFACT son de uso libre bajo CC BY 4.0»; la Recomendación 16 dice que se publica «gratis» (verificado). Si el uso comercial y la redistribución a la suite están permitidos: **POR VERIFICAR con UNECE por escrito** |
| **Ubigeo INEI** | Instituto Nacional de Estadística e Informática (INEI), ente rector del Sistema Estadístico Nacional (verificado en su portal) | Código de seis dígitos, dos por nivel: departamento (`01` Amazonas … `25` Ucayali, con `07` Callao), provincia y distrito; el `01` de cada nivel es la capital; las creaciones toman el número siguiente al último (fuente secundaria). El portal ofrece «códigos estandarizados» y una consulta de centros poblados (verificado que existen los servicios; contenido **POR VERIFICAR**) | Departamento, provincia, distrito; centros poblados por debajo (código y longitud **POR VERIFICAR**) | Con cada ley de creación o modificación de circunscripciones; frecuencia de publicación del catálogo **POR VERIFICAR** | Dato público del Estado peruano; licencia expresa de reutilización **POR VERIFICAR** |
| **Ubigeo RENIEC** | Registro Nacional de Identificación y Estado Civil | Ubigeo usado en el DNI y en el padrón electoral; también se cita como usado por la ONPE (fuente secundaria). Diferencias de codificación con el INEI y códigos para peruanos en el extranjero: **POR VERIFICAR** (ver [§4](#4-casos-difíciles-del-perú)) | Departamento, provincia, distrito; ámbito extranjero **POR VERIFICAR** | **POR VERIFICAR** | **POR VERIFICAR** |
| **Ubigeo SUNAT** | Superintendencia Nacional de Aduanas y de Administración Tributaria | Tabla de ubigeo de los comprobantes de pago electrónicos (catálogo de la facturación electrónica; se recuerda como «catálogo n.° 13», **POR VERIFICAR**). Si es idéntica a la del INEI o tiene diferencias: **POR VERIFICAR** | Distrito (seis dígitos), **POR VERIFICAR** | Con las resoluciones de SUNAT que modifican los catálogos, **POR VERIFICAR** | Publicada para cumplimiento tributario; redistribución **POR VERIFICAR** |
| **GeoNames** | GeoNames (unxos GmbH), comunidad abierta (verificado) | Nomenclátor mundial: más de 13 millones de lugares con nombre, nombre ASCII, nombres alternativos por idioma (con marcas de preferido, corto, coloquial e histórico), latitud y longitud WGS84, clase y código de entidad, país ISO 3166-1 alfa-2, `admin1` a `admin4` (la mayoría de `admin1` son **FIPS**, no ISO), población, altitud y zona horaria; jerarquía administrativa aparte; códigos postales como descarga separada (verificado) | Punto (ciudad, pueblo, accidente geográfico) y divisiones administrativas | **Diaria**, con archivos de modificaciones y bajas por día (verificado) | **CC BY 4.0**: permite redistribución y uso comercial con atribución; sin garantía de exactitud (verificado) |
| **Códigos postales (SERPOST)** | Servicios Postales del Perú S.A. (SERPOST), bajo el MTC | Código postal peruano. Estructura, cobertura y relación con el ubigeo: **POR VERIFICAR** (no se encontró la publicación en su portal de informes) | **POR VERIFICAR** | **POR VERIFICAR** | **POR VERIFICAR** |
| Otros códigos de dominio aduanero | SUNAT (Aduanas) | Códigos de aduana, de puerto y de depósito temporal que exige la DAM; si se basan en UN/LOCODE o son propios: **POR VERIFICAR** | **POR VERIFICAR** | **POR VERIFICAR** | **POR VERIFICAR** |

**Lectura para el PRD.** Solo GeoNames tiene hoy una licencia abierta clara. ISO 3166 es de uso gratuito pero su listado como dato tiene condiciones; UN/LOCODE tiene señales contradictorias; las fuentes peruanas son públicas pero su licencia de reutilización no se confirmó. La decisión de qué fuente es «la de verdad» por esquema y en qué condiciones se puede redistribuir a la suite es materia del ADR.

## 3. Consumidores y código que necesita cada uno

| Consumidor | Qué necesita | Código | Respaldo en el repositorio |
| :--- | :--- | :--- | :--- |
| **Establecimiento de una Party** (MDM) | Dirección de cada sede, sucursal o planta, con su anexo SUNAT si es peruana | País ISO 3166-1 alfa-2; ubigeo de seis dígitos si el país es `PE`; código postal opcional | `Establishment.address` en [DOM-MDM-002](../../02-diseno/modelo-dominio-organizacion-erp-mdm-002.es.md) §4.1; esquema `Address` con `ubigeo` `^[0-9]{6}$` «solo con countryCode PE», departamento, provincia y distrito en texto y `postalCode` de hasta 20 en [openapi-party-mdm-002.yaml](../../03-construccion/openapi-party-mdm-002.yaml); ejemplo con `ubigeo: '070101'` en el [contrato de Party](../../03-construccion/contrato-api-party-mdm-002.es.md); RF-MDM-009 en [PRD-MDM-001](../prd-mdm-001.es.md) |
| **Cliente** (dirección fiscal) | Dirección fiscal y otras direcciones | Igual que el establecimiento. El modelo describe el ubigeo como «código INEI de seis dígitos» | `INV-CUS-09` y DTO de alta en [DOM-MDM-001](../../02-diseno/modelo-dominio-cliente-mdm-001.es.md) §3.4 y §7.2; catálogo de ubigeo pendiente en [G-538](../../../GAPS.md) |
| **SUNAT — factura electrónica** | Ubigeo de la dirección fiscal del emisor (y del adquirente, si aplica) | Ubigeo de seis dígitos de la tabla SUNAT (**POR VERIFICAR** si coincide con INEI) | **Sin respaldo** en el repositorio: no se encontró qué sistema emite la factura ni qué datos de dirección le pasa MDM. SUPUESTO: la emite el ERP vía XMS y toma el ubigeo de la dirección fiscal que mantiene MDM |
| **SUNAT — guía de remisión electrónica** | Ubigeo del punto de partida y del punto de llegada | Ubigeo de seis dígitos (**POR VERIFICAR** en la norma de la GRE) | El repositorio dice que **SIL no emite la guía**: la emite el transportista o LOGAWARE y SIL solo registra número y foto (RF-EJE-017, decisión 12, en [PRD-SIL-001](../prd-sil-001.es.md); [US-SIL-114](../historia-usuario-sil-114.es.md)). Quién emite la GRE del remitente y de dónde toma los ubigeos: **POR VERIFICAR** |
| **Documentos de comercio exterior** (BL, manifiesto de carga, DAM) | Puerto de embarque y de descarga; país de origen y de destino | SUPUESTO: puerto en UN/LOCODE y país en ISO 3166-1 alfa-2, que es lo que recomienda la Recomendación 16 para puertos de carga, descarga, trasbordo y destino (verificado en la recomendación, no en los documentos de Organización). Si la DAM usa códigos propios de SUNAT: **POR VERIFICAR** | El borrador de BL se arma con «shipper, consignatario, notify, **puertos**, nave…» y datos de la DAM ([fuente del sistema de operaciones SIL TO BE](./fuente-sistema-operaciones-sil-to-be.es.md), HU-DOC); BL y DAM nacen en el negocio que origina la operación (decisión 13 en [descomposición de SIL en la suite](../../../reference/architecture/descomposicion-sil-en-la-suite.es.md) §2.3). El código de puerto no está especificado |
| **SIL** (origen, destino, depósito, puerto) | Lugar de recojo, puerto de embarque, depósitos, sedes y plantas | Lugar de comercio (SUPUESTO: UN/LOCODE para puertos) y dirección con ubigeo para plantas y lugares de recojo (SUPUESTO) | «MDM provee clientes, **puertos, depósitos**, navieras y tipos de contenedor como proyección de solo lectura» (RF-PLA-001 en [PRD-SIL-001](../prd-sil-001.es.md)); «data maestra transversal (… **ubicaciones, puertos, depósitos** …) — MDM, para toda la suite» (D3 de [ADR-SIL-002](../../../reference/architecture/adrs/SIL-002-frontera-contexto-sil-en-la-suite.es.md)); «ubicaciones (sedes, plantas, puertos, terminales, depósitos temporales)» ([descomposición](../../../reference/architecture/descomposicion-sil-en-la-suite.es.md) §4); orden de servicio con «lugar de recojo … puerto de embarque» ([fuente SIL TO BE](./fuente-sistema-operaciones-sil-to-be.es.md)) |
| **TMS (LOGAWARE)** | Origen y destino de cada viaje, geocercas, GPS | SUPUESTO: dirección con coordenadas; LOGAWARE recibe datos maestros de CMS y MDM vía XMS (decisión 20 en la [descomposición](../../../reference/architecture/descomposicion-sil-en-la-suite.es.md) §2.3). Qué códigos geográficos acepta LOGAWARE: **POR VERIFICAR** | Decisión 20 citada |
| **DT (Depósito Temporal)** | Ubicación del depósito y de sus operaciones | SUPUESTO: dirección con ubigeo y, para la aduana, código de depósito de SUNAT (**POR VERIFICAR**) | DT = Depósito Temporal, sistema del Núcleo Operativo ([descomposición](../../../reference/architecture/descomposicion-sil-en-la-suite.es.md) §2.3). Sin evidencia de sus necesidades geográficas |

**Hallazgo.** Ningún documento del repositorio fija **qué esquema de ubigeo** (INEI, RENIEC o SUNAT) se usa, ni **qué código de puerto** manejan SIL y los documentos de comercio exterior. El único rastro es la descripción «código INEI» en DOM-MDM-001.

## 4. Casos difíciles del Perú

| Caso | Qué pasa | Efecto para el maestro | Evidencia |
| :--- | :--- | :--- | :--- |
| **Divergencia INEI vs RENIEC** | Ambas entidades usan «ubigeo», pero con codificaciones que difieren en parte del país (se cita, por ejemplo, Lima `15` en INEI frente a `14` en RENIEC) | Un mismo distrito puede tener dos códigos; un dato tomado del DNI no coincide con el del INEI. El maestro necesita saber de qué esquema viene cada código y cómo se corresponden | **POR VERIFICAR** (dato conocido por el analista, no confirmado en fuente oficial) |
| **Creación de distritos y recodificación (sucesión)** | Las circunscripciones se crean por ley: un distrito nuevo nace, por lo general, de la escisión de otro u otros. El código nuevo toma el número siguiente al último de su provincia | Las direcciones del distrito de origen pueden pasar a pertenecer al nuevo: hace falta **vigencia**, relación **predecesor → sucesor** y una forma de revisar las direcciones afectadas. Los códigos retirados no deben reutilizarse | Regla de asignación: fuente secundaria. Creaciones recientes citadas por Wikipedia (Lambras, Ley 31092; Santa Rosa de Loreto): **POR VERIFICAR** en INEI |
| **Centros poblados** | Por debajo del distrito, el INEI registra centros poblados (caseríos, anexos, fundos) | Plantas agroexportadoras o lugares de recojo rurales (sedes de Callao y Piura según la [fuente de transportes](./fuente-modulo-transportes-to-be.es.md)) pueden necesitar ese nivel. Volumen alto y cambiante | Existencia del servicio INEI: verificado. Código y volumen: **POR VERIFICAR** |
| **Homónimos** | Hay distritos con el mismo nombre en provincias distintas, por ejemplo Aco (Concepción) y Aco (Corongo) | La búsqueda por nombre devuelve varios resultados; un nombre nunca identifica, solo el código. La presentación debe mostrar la jerarquía (distrito, provincia, departamento) | Fuente secundaria |
| **Callao, provincia constitucional** | El Callao es a la vez departamento `07` en el ubigeo (una provincia, siete distritos según fuente secundaria) y región `PE-CAL` «El Callao» en ISO 3166-2 | Los niveles no se pueden asumir uniformes ni siquiera dentro del Perú: un departamento con una sola provincia, con régimen propio | Fuente secundaria |
| **Lima: dos subdivisiones ISO** | ISO 3166-2 tiene `PE-LIM` (región Lima) y `PE-LMA` (Municipalidad Metropolitana de Lima), mientras el ubigeo agrupa ambas bajo el departamento `15` | La correspondencia ubigeo → ISO 3166-2 **no es uno a uno**: la provincia de Lima va a `PE-LMA` y el resto del departamento a `PE-LIM` | Fuente secundaria (Wikipedia, ISO 3166-2:PE); **POR VERIFICAR** en la OBP de ISO |
| **Nombres con y sin tildes** | «Áncash» en el ubigeo frente a «Ancash» en ISO 3166-2; variantes como «Cusco» y «Cuzco»; UN/LOCODE publica el nombre con y sin diacríticos | La búsqueda debe encontrar con o sin tildes y mayúsculas; el nombre oficial se conserva tal cual. Hay nombres en quechua y aimara reconocidos por ISO 3166-2 | Variantes ISO: fuente secundaria. UN/LOCODE con y sin diacríticos para `PE`: verificado |

## 5. Necesidades internacionales

- **Países sin niveles comparables.** El número y el significado de los niveles varían: _State_ / _County_ en Estados Unidos, regiones y comunas en Chile, provincias en otros países, y ciudades-Estado sin subdivisión útil. GeoNames modela hasta cinco niveles administrativos (`admin1` a `admin4` y `adm5`) (verificado). El maestro no puede asumir «tres niveles» (requisito R-GEO-02).
- **ISO 3166-2 frente a divisiones locales.** ISO 3166-2 cubre solo las subdivisiones **principales** y toma los nombres de fuentes nacionales (verificado); las divisiones locales de menor nivel no tienen código ISO. Además, el `admin1` de GeoNames es mayoritariamente **FIPS**, no ISO (verificado), así que no se puede usar GeoNames como si fuera ISO 3166-2 sin correspondencia.
- **Transliteración y nombres alternativos.** UN/LOCODE usa el alfabeto latino de 26 letras como nombre de comercio internacional, conserva el nombre con diacríticos para un grupo de países (Perú incluido) y registra nombres anteriores o alternativos con `=` (por ejemplo, _Peking = Beijing_) (verificado). GeoNames ofrece nombres alternativos por idioma con marcas de preferido, coloquial e histórico (verificado). Documentos de comercio exterior en inglés y documentos tributarios en español necesitan nombres distintos para el mismo lugar.
- **Puertos y terminales que no están en UN/LOCODE.** UN/LOCODE asigna un código por **lugar** (ciudad o área), no por terminal; las terminales de contenedores, depósitos y muelles dentro de un lugar se identifican con **códigos hijo** mantenidos por otras organizaciones (verificado, Recomendación 16 §F y anexo III). Un terminal portuario del Callao o un depósito temporal concreto no tiene UN/LOCODE propio. Además, las entradas en estado `RQ` no deben usarse en intercambio electrónico, y las `XX` desaparecerán (verificado). Cuando un lugar no exista, UNECE admite solicitudes de alta por su sistema de mantenimiento (verificado), con un plazo que no controla Organización.
- **Códigos de país no asignados.** ISO reserva rangos de usuario (`AA`, `QM`–`QZ`, `XA`–`XZ`, `ZZ`) y UN/LOCODE usa `XZ` para instalaciones en aguas internacionales (verificado). Cualquier código de usuario es incompatible entre organizaciones (verificado).
- **Cambios de país.** Un código alfa-2 retirado no se reutiliza en 50 años (verificado) y los nombres retirados pasan a ISO 3166-3: los documentos históricos deben seguir resolviendo su país.

## 6. Volúmenes orientativos

Todas las cifras son **estimaciones** para dimensionar, no requisitos.

| Conjunto | Volumen | Fuente y estado |
| :--- | ---: | :--- |
| Países ISO 3166-1 | ~249 códigos asignados | Estimación del analista; **POR VERIFICAR** en la OBP. La estadística de GeoNames lista unos 250 países y territorios (verificado) |
| Subdivisiones ISO 3166-2 (mundo) | ~5 000 | Estimación del analista; **POR VERIFICAR** |
| Subdivisiones ISO 3166-2 del Perú | 26 | Fuente secundaria |
| Departamentos del Perú (ubigeo) | 25 (incluido Callao) | Fuente secundaria; **POR VERIFICAR** en INEI |
| Provincias del Perú | ~196 | Fuente secundaria (tabla al cierre de 2020); **POR VERIFICAR** |
| Distritos del Perú | ~1 874 a ~1 891 | Fuente secundaria con cifras inconsistentes entre sí: 1 874 en la tabla al cierre de 2020 y 1 891 como número actual; **POR VERIFICAR** en INEI |
| Centros poblados del Perú | Decenas de miles | Estimación del analista; **POR VERIFICAR** |
| UN/LOCODE | Más de 100 000 lugares en unos 250 países y territorios | Verificado (Recomendación 16, edición 2020) |
| GeoNames (mundo) | ~13,5 millones de entidades, ~32,7 millones de nombres, ~5 millones de códigos postales | Verificado (página de estadísticas) |
| GeoNames (Perú) | ~111 500 entidades y ~97 000 códigos postales | Verificado (página de estadísticas) |

**Lectura.** El núcleo que la suite necesita de verdad (países, subdivisiones de primer nivel, ubigeo distrital y los UN/LOCODE de los destinos que opera Organización) es de **miles a decenas de miles** de registros. Cargar GeoNames completo o todos los centros poblados cambia el orden de magnitud y solo se justifica con un consumidor concreto (P-GEO-06, P-GEO-11).

## 7. Requisitos candidatos para el PRD

En lenguaje de negocio. Son candidatos: el PRD los acepta, los reformula o los descarta.

| ID | Requisito candidato | Origen |
| :--- | :--- | :--- |
| R-GEO-01 | **Consultar y buscar** países, divisiones administrativas y lugares de comercio por código o por nombre, sin importar tildes ni mayúsculas, y ver siempre la jerarquía completa para distinguir homónimos | §4 homónimos y tildes |
| R-GEO-02 | Representar **la jerarquía propia de cada país** (número y nombre de niveles variables), sin imponer los tres niveles del Perú | §5 |
| R-GEO-03 | **Mantener** el catálogo: alta, corrección, desactivación y reactivación; el código no cambia ni se reutiliza; nada se borra | Patrón del maestro en [PRD-MDM-001](../prd-mdm-001.es.md) (RF-MDM-014) |
| R-GEO-04 | **Importar catálogos oficiales** (ISO 3166-1 y 3166-2, UN/LOCODE, ubigeo) mostrando antes las **diferencias** (altas, cambios, bajas) para que un responsable las revise y apruebe; registrar fuente, versión y fecha de corte del dato | §2 |
| R-GEO-05 | Guardar **varios códigos por unidad** (ubigeo INEI, RENIEC, SUNAT, ISO 3166-2, identificador GeoNames) y sus **correspondencias**, incluidas las que no son uno a uno | §4 divergencia INEI–RENIEC, Lima |
| R-GEO-06 | **Sucesión territorial**: vigencia de cada unidad, relación con sus predecesoras y sucesoras, consulta del catálogo tal como era en una fecha, y lista de direcciones afectadas por un cambio para revisarlas | §4 sucesión |
| R-GEO-07 | Mantener los **lugares de comercio y transporte** con su función (puerto, aeropuerto, ferroviario, carretera, postal, multimodal o ICD, zona económica especial), su estado y su subdivisión; impedir usar en documentos los lugares no aprobados o por eliminar | §2 UN/LOCODE |
| R-GEO-08 | Registrar **lugares propios que no tienen UN/LOCODE** (terminales, depósitos temporales, plantas) vinculados al lugar UN/LOCODE que los contiene, sin inventar códigos de cinco caracteres | §5 puertos fuera de UN/LOCODE |
| R-GEO-09 | **Zonas postales**: código postal por país cuando el país lo use, opcional y validado por formato | §2 SERPOST, GeoNames |
| R-GEO-10 | **Coordenadas y geocodificación por etapas**: primero el punto de referencia que traen los catálogos (UN/LOCODE, GeoNames); después las coordenadas de cada dirección; al final, la geocodificación automática de direcciones | §2, §3 TMS |
| R-GEO-11 | **Validar las direcciones** de organizaciones, establecimientos y clientes contra el catálogo (país vigente, ubigeo vigente y coherente con el país), con una transición para las direcciones que hoy guardan departamento, provincia y distrito como texto libre | §1, §3 |
| R-GEO-12 | **Nombres oficiales, alternativos y transliterados** por idioma, con el nombre de comercio internacional y el nombre local | §5 transliteración |
| R-GEO-13 | **Publicar** los cambios del catálogo a los consumidores de la suite (SIL, DT, LOGAWARE vía XMS, facturación), que lo usan en solo lectura | §3; D3 de ADR-SIL-002 |
| R-GEO-14 | **Auditoría**: quién cambió qué, cuándo, desde qué fuente y versión, y qué diferencia se aprobó | Patrón del maestro |
| R-GEO-15 | Registrar la **licencia y la atribución** de cada fuente y respetarlas al publicar | §2 licencias |

## 8. Preguntas para negocio

| ID | Pregunta | Por qué importa |
| :--- | :--- | :--- |
| P-GEO-01 | ¿Qué ubigeo manda en la suite: el del INEI, el de RENIEC o el de la tabla de SUNAT? ¿Hay que guardar los tres? | R-GEO-05; DOM-MDM-001 asume INEI sin decisión |
| P-GEO-02 | ¿Quién es el **dueño funcional** del catálogo geográfico y quién aprueba las diferencias al importar? | R-GEO-04; mismo problema que [G-555](../../../GAPS.md) para los demás catálogos |
| P-GEO-03 | ¿Con cuántos países opera Organización (destinos y orígenes reales)? ¿Se necesitan subdivisiones de otros países o basta país y UN/LOCODE? | Alcance de R-GEO-02 y volumen |
| P-GEO-04 | ¿Qué sistema emite la factura electrónica y la guía de remisión del remitente, y qué datos geográficos espera de MDM? | §3: sin respaldo en el repositorio |
| P-GEO-05 | ¿Qué códigos usan hoy el BL, el manifiesto y la DAM para puertos, aduanas y depósitos: UN/LOCODE o tablas de SUNAT? | §3, R-GEO-07 |
| P-GEO-06 | ¿Hacen falta los **centros poblados** (plantas y lugares de recojo rurales) o basta el distrito? | §4, volumen |
| P-GEO-07 | ¿El código postal es obligatorio para algún consumidor o documento? | R-GEO-09 |
| P-GEO-08 | Cuando un distrito se divide, ¿las direcciones afectadas se reasignan solas o las revisa una persona? ¿Quién? | R-GEO-06 |
| P-GEO-09 | ¿Se contrata la suscripción de ISO o la consulta gratuita basta? ¿Se pide a UNECE confirmación escrita del uso comercial de UN/LOCODE? | §2 licencias |
| P-GEO-10 | Un terminal portuario o un depósito temporal, ¿es un **lugar** del catálogo geográfico o un **establecimiento** de la organización que lo opera? | R-GEO-08 frente a `Establishment` de DOM-MDM-002 |
| P-GEO-11 | ¿Quién necesita coordenadas (LOGAWARE, geocercas, informes) y con qué precisión? | R-GEO-10, etapas |
| P-GEO-12 | ¿En qué idioma se muestran los nombres en documentos internacionales y en pantallas? | R-GEO-12 |
| P-GEO-13 | ¿Con qué frecuencia debe revisarse cada fuente oficial y qué retraso es aceptable entre la publicación oficial y su uso en la suite? | R-GEO-04; UN/LOCODE sin publicación oficial desde 2025-1 |

## 9. Supuestos y riesgos

### 9.1 Supuestos

| ID | Supuesto | Cómo se confirma |
| :--- | :--- | :--- |
| S-GEO-01 | La geografía administrativa y los lugares de comercio son catálogos relacionados, no una sola lista | ADR-MDM-002 |
| S-GEO-02 | Los puertos de los documentos de comercio exterior se codifican en UN/LOCODE y los países en ISO 3166-1 alfa-2 | P-GEO-05 |
| S-GEO-03 | La factura electrónica la emite el ERP vía XMS con el ubigeo de la dirección fiscal mantenida en MDM | P-GEO-04 |
| S-GEO-04 | La tabla de ubigeo de SUNAT coincide con la del INEI | P-GEO-01 y lectura del catálogo SUNAT |
| S-GEO-05 | MDM es la fuente de la geografía para toda la suite, como lo es de los demás datos maestros transversales (D3 de ADR-SIL-002) | PRD-MDM-002 |
| S-GEO-06 | El volumen necesario es de miles a decenas de miles de registros, sin GeoNames completo ni centros poblados | P-GEO-03, P-GEO-06 |

### 9.2 Riesgos

| ID | Riesgo | Efecto | Mitigación sugerida |
| :--- | :--- | :--- | :--- |
| RG-GEO-01 | **Licencia de UN/LOCODE** contradictoria | Redistribuir el listado a la suite podría incumplir los términos de UNECE | Confirmación escrita de UNECE antes de importar (P-GEO-09) |
| RG-GEO-02 | **Esquema de ubigeo equivocado** | Comprobantes rechazados por SUNAT o direcciones mal ubicadas | Decidir P-GEO-01 antes de validar direcciones (R-GEO-11) |
| RG-GEO-03 | **Direcciones en texto libre** ya cargadas | Datos que no casan con el catálogo al activarlo | Transición con informe de no coincidencias (R-GEO-11) |
| RG-GEO-04 | **Sucesión sin vigencia** | Documentos históricos que pierden su ubicación cuando un distrito cambia | Vigencia y sucesión desde el inicio (R-GEO-06) |
| RG-GEO-05 | **Correspondencias falsas** entre esquemas (por ejemplo, Lima en ISO 3166-2, `admin1` FIPS de GeoNames) | Datos internacionales mal asignados | Correspondencias explícitas, no deducidas (R-GEO-05) |
| RG-GEO-06 | **Alcance inflado** (cargar todo GeoNames, centros poblados, geocodificación) sin consumidor | Esfuerzo y mantenimiento sin valor | Etapas (R-GEO-10) y preguntas P-GEO-03, P-GEO-06, P-GEO-11 |
| RG-GEO-07 | **Desfase de fuentes**: UN/LOCODE sin publicación oficial desde 2025-1 y prerrelease que puede cambiar | Usar códigos que luego se modifican, o no tener los nuevos | Política de qué publicación se usa y revisión de diferencias (R-GEO-04, P-GEO-13) |

### 9.3 Hallazgos para `GAPS.md` (SD-07)

Por instrucción de esta tarea solo se editó este archivo; los hallazgos siguientes **quedan pendientes de registrar** en [GAPS.md](../../../GAPS.md) por quien integre el análisis:

1. No hay decisión sobre **qué esquema de ubigeo** usa la suite ni sobre el **código de puerto** de SIL y de los documentos de comercio exterior (amplía G-538).
2. La **licencia de UN/LOCODE** para uso comercial y redistribución no está clara.
3. No consta **qué sistema emite la factura y la GRE del remitente** ni qué datos geográficos espera de MDM.
4. El catálogo geográfico **no tiene dueño** ni proceso de aprobación de cambios (análogo a G-555).

## 10. Historial de cambios

| Versión | Fecha | Autor | Cambios |
| --- | --- | --- | --- |
| 0.1.0 | 2026-10-24 | agente `organizacion-analyst` («Diana»), a pedido del propietario | Versión inicial: propósito, nueve fuentes con autoridad, contenido, granularidad, actualización y licencia (ISO 3166, UN/LOCODE y GeoNames verificados en sus sitios; INEI, RENIEC, SUNAT y SERPOST con datos POR VERIFICAR), consumidores con su respaldo en el repositorio, casos difíciles del Perú, necesidades internacionales, volúmenes estimados, 15 requisitos candidatos R-GEO, 13 preguntas P-GEO, supuestos, riesgos y cuatro hallazgos para `GAPS.md` |

---

<p align="center">
  <img src="https://img.shields.io/badge/Licencia-MIT-0f3e67?style=flat-square" alt="Licencia MIT">
  <img src="https://img.shields.io/badge/Mantenedor-Architecture_Board-042139?style=flat-square" alt="Mantenedor">
</p>

<p align="center">
  <strong>© Organización S.A.</strong> · RUC 20100412447 · Operador Logístico Aduanero desde 1978
</p>
