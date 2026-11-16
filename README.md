# organizacion-unilog

<div align="center">

![Organización](https://img.shields.io/badge/Organización_Arch-003c6b?style=for-the-badge)
![Perfil](https://img.shields.io/badge/Perfil-single--product-8e44ad?style=for-the-badge)
![Producto](https://img.shields.io/badge/Producto-SIL-003c6b?style=for-the-badge)
![Estado](https://img.shields.io/badge/Estado-Activo-256c27?style=for-the-badge)
![Satélite](https://img.shields.io/badge/Sat%C3%A9lite-S--16-042139?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-informational?style=for-the-badge)

<br/>

**Unilog — Sistema de Servicios Logísticos (SIL) de Organización**<br/>
Satélite de [`organizacion_arch`](https://github.com/organizacion-peru/organizacion_arch): consume el estándar corporativo, versionado, desde el plugin `organizacion-core`. No lo copia.

> _Operador Logístico Aduanero desde 1978_

</div>

Unilog implementa el sistema **SIL** (Servicios Logísticos), sigla `Ratificada` en el catálogo de la suite. Es **un** sistema desplegable (un Bounded Context); navegación plana `README → Producto → PRDs`.

| Identidad | |
| :--- | :--- |
| Tipo de repositorio (ADR-0069) | `producto` |
| Perfil | `single-product` |
| Producto / Sistema | **SIL** — Sistema de Servicios Logísticos |
| Identidad de sigla | `sistema.yaml` → `sigla: SIL`, `estado_sigla: Ratificada` |
| Raíz de fuente (ADR-0107) | `src/` |
| Owner | aarroyo (Organización S.A.) |

---

## Flujo SDLC

Abre la fase en la que trabajas. Cada una declara su **meta**, sus documentos y sus **hubs** (índices de área).

> **Numeración canon `organizacion_arch`:** las fases van de **1 a 5** (Mapeo SDLC–Artefactos). **No existe «Fase 0».**

<details>
<summary><strong>Fase 1 — Concepción y Descubrimiento</strong> · producto y requisitos</summary>

<br/>

> **Meta:** fijar el _qué_ y el _para quién_ del sistema.

La Visión del producto es única para todo el sistema. Cada PRD (`PRD-SIL-NNN`, `PRD-MDM-NNN`) trae su propio alcance, historias de usuario y backlog — el hub los agrupa por PRD.

| Documento | Descripción | Tipo |
| :--- | :--- | :--- |
| [Hub de Fase 1](./docs/01-concepcion/README.md) | PRDs con su alcance, historias y backlog; diagramas conceptuales | Hub |
| [Visión del producto](./docs/01-concepcion/vision-producto-sil.es.md) | Visión de SIL y su modelo conceptual en la suite — no varía por PRD | Visión |
| [PRD-MDM-001 — Maestro de organizaciones y partes](./docs/01-concepcion/prd-mdm-001.es.md) | Referencia de negocio de MDM, elaborada a posteriori: organizaciones, roles, establecimientos, relaciones, referencias al ERP y tipos de rol | PRD |
| [PRD-MDM-002 — Geografía de la suite](./docs/01-concepcion/prd-mdm-002.es.md) | Deriva de PRD-MDM-001: países, niveles administrativos por país con ubigeo, lugares de comercio exterior UN/LOCODE, códigos postales y coordenadas por etapas | PRD |

</details>

<details>
<summary><strong>Fase 2 — Diseño y Arquitectura</strong> · el cómo estructural</summary>

<br/>

> **Meta:** fijar el _cómo_ estructural, trazado a decisiones (ADRs).

El diseño se agrupa por el PRD del que deriva — hoy desciende de `PRD-SIL-001` y, el de MDM, de `PRD-MDM-001`.

| Documento | Descripción | Tipo |
| :--- | :--- | :--- |
| [Hub de Fase 2](./docs/02-diseno/README.md) | Cómo el sistema adopta o especializa la línea base, agrupado por PRD | Hub |
| [Integración LOGAWARE TMS](./docs/02-diseno/integracion-logaware-tms.es.md) | Hub de área: documentos, vista interactiva, cuestionario en Word y descargas | Hub |
| [Vistas de referencia de la arquitectura](./docs/02-diseno/vistas-referencia-arquitectura-suite-sil.es.md) | Contexto de la suite SCM y SIL Fase 1 (Kafka, XMS, TMS) en SVG, contrastadas con las decisiones | Vista |
| [Cuestionario para TI sobre el ERP (MDM)](./docs/02-diseno/cuestionario-erp-estructura-organizativa-mdm.es.md) | **Pendiente de revisión:** qué ERP es, su estructura organizativa y sus interfaces; sin enviar | Cuestionario |
| [MDM — Datos Maestros](./docs/02-diseno/hub-mdm.es.md) | Hub de área de MDM (`mdm-api`, alojado aquí de forma provisional): modelo Party, decisiones, propuestas de ADR, código en revisión y gaps | Hub |

</details>

<details>
<summary><strong>Fase 3 — Construcción</strong> · código gobernado</summary>

<br/>

> **Meta:** materializar el diseño en código gobernado.

| Documento | Descripción | Tipo |
| :--- | :--- | :--- |
| Código (`src/`) | Runtime del sistema, bajo la raíz de fuente | Código |
| [Hub de Fase 3](./docs/03-construccion/README.md) | Historias técnicas y planes | Hub |
| [Historia técnica](./docs/03-construccion/historia-tecnica-sil-001.es.md) | Requisitos técnicos de implementación | Historia |
| [Guía de la estructura de `src/`](./docs/03-construccion/guia-estructura-src-sil-001.es.md) | Qué hay en cada directorio y dónde se crea cada archivo | Estándar |
| [Glosario de código web](./docs/03-construccion/glosario-codigo-web-sil-001.es.md) | Equivalencias español → inglés de los identificadores | Glosario |
| [Especificación técnica de organización y sede (MDM)](./docs/03-construccion/especificacion-tecnica-organizacion-sede-mdm-001.es.md) | Diseño del CRUD de Tenant y Branch en `mdm-api` (D-031), en revisión por D-043; ver el [hub de MDM](./docs/02-diseno/hub-mdm.es.md) | Especificación |
| [Contrato de la API de organización y sede (MDM)](./docs/03-construccion/contrato-api-organizacion-sede-mdm-001.es.md) | Endpoints, códigos, `If-Match`/`ETag` y errores de `mdm-api` | Contrato |

</details>

<details>
<summary><strong>Fase 4 — Validación y QA</strong> · la promesa se comprueba</summary>

<br/>

> **Meta:** comprobar que el sistema cumple lo prometido.

| Documento | Descripción | Tipo |
| :--- | :--- | :--- |
| [Hub de Fase 4](./docs/04-validacion/README.md) | Confiabilidad y latencia | Calidad |
| [Reporte resumen de pruebas](./docs/04-validacion/reporte-resumen-pruebas-sil-001.es.md) | Evidencia por capa | Pruebas |

</details>

<details>
<summary><strong>Fase 5 — Entrega y Operaciones</strong> · lo que ya corre</summary>

<br/>

> **Meta:** operar el servicio y sostener su superficie de integración.

| Documento | Descripción | Tipo |
| :--- | :--- | :--- |
| [Hub de Fase 5](./docs/05-entrega/README.md) | Topología de despliegue | Hub |
| [Notas de lanzamiento](./docs/05-entrega/notas-lanzamiento-sil-001.es.md) | Cambios entregados por versión | Release |

</details>

---

## Cómo colaborar

<details>
<summary><strong>Arranque rápido</strong> · del clon al primer commit válido</summary>

<br/>

Este repositorio no lleva el estándar dentro. Lo obtiene del plugin `organizacion-core`, que se instala una vez y se comparte entre satélites.

1. **Instala el plugin del estándar** (marketplace de Organización):

   ```bash
   claude plugin marketplace add organizacion-peru/organizacion-marketplace
   claude plugin install organizacion-core@organizacion
   ```

2. **Localiza la versión instalada y activa el hook** (una vez por clon; git no lo activa solo, por diseño):

   ```bash
   # La copia instalada la declara el cliente en installed_plugins.json: se lee
   # de ahí, no del número mayor del caché, que nunca se recoge (ADR-0169 §2.6).
   ORG_CORE=$(node -e '
     const { resolve } = require("path");
     const registro = process.env.HOME + "/.claude/plugins/installed_plugins.json";
     let entradas = [];
     try { entradas = require(registro).plugins?.["organizacion-core@organizacion"] ?? []; } catch {}
     const aqui = process.cwd();
     const entrada = entradas.find((e) => e.projectPath && resolve(e.projectPath) === aqui)
       ?? entradas.find((e) => e.scope === "user")
       ?? entradas[0];
     if (!entrada?.installPath) {
       console.error("organizacion-core no está instalado; ejecuta: claude plugin enable organizacion-core@organizacion");
       process.exit(1);
     }
     console.log(entrada.installPath);
   ')
   node "$ORG_CORE/scripts/install-hooks.mjs"
   ```

3. **Valida la gobernanza** antes de tu primer commit:

   ```bash
   # Con Claude Code, el barrido completo en un paso:
   #   /organizacion-core:validar-gobernanza
   node "$ORG_CORE/scripts/validate-estructura-satelite.mjs"
   node "$ORG_CORE/scripts/validate-satellite-base.mjs"
   ```

4. **Build y pruebas del runtime:**

   ```bash
   bash scripts/verify-local.sh node   # frontend: typecheck, lint, pruebas y build
   bash scripts/verify-local.sh e2e    # Playwright + axe
   ```

</details>

<details>
<summary><strong>Reglas que gobiernan tu cambio</strong> · gobernanza viva del satélite</summary>

<br/>

| Documento | Qué gobierna |
| :--- | :--- |
| [CLAUDE.md](./CLAUDE.md) | Reglas del núcleo Organización, redactadas para este satélite |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Proceso de contribución y cómo proponer cambios al núcleo |
| [AGENTS.md](./AGENTS.md) | Convenciones para agentes que operen aquí |
| [DECISIONS.md](./DECISIONS.md) | Triaje de herencia y decisiones locales |
| [GAPS.md](./GAPS.md) | Registro único de hallazgos (S-20) |
| [MADUREZ.md](./MADUREZ.md) | Medición de madurez TOGAF ACMM (S-19) |

**Quality & Security:** los gates locales (S-23, ADR-0106) son inevadibles en el pre-commit: gitleaks, auditoría de dependencias, coverage con umbral, commitlint y los validadores del estándar.

</details>

<details>
<summary><strong>Proponer un cambio al estándar</strong> · el camino de vuelta al núcleo</summary>

<br/>

Lo que este repositorio no puede decidir por su cuenta —una regla, un validador, una plantilla, un ADR de núcleo— se propone en [`organizacion_arch`](https://github.com/organizacion-peru/organizacion_arch) por PR. El estándar baja versionado en el plugin; nunca se parchea en local.

El detalle del flujo, con roles y categorías de cambio, está en [CONTRIBUTING.md](./CONTRIBUTING.md), sección «Contribuir al núcleo».

</details>

---

## Preguntas y respuestas

<details>
<summary><strong>¿Dónde va cada cosa en este repositorio?</strong></summary>

<br/>

```text
src/                 raíz de fuente (ADR-0107) — todo el código bajo src/
  apps/sil-web/      cliente web: anfitrión que compone la suite y SIL (D-026)
  libs/              librerías Nx: suite-*, sil-*, ui-sil, ui-tokens
                     (API .NET prevista en apps/sil.api; hoy sin proyecto, G-014)
scripts/             verify-local.sh: la puerta local de build y pruebas
docs/                artefactos SDLC (PRDs, planes, reportes)
reference/           corpus propio (ADRs locales, blueprints, deployment)
DECISIONS.md  GAPS.md  MADUREZ.md  CLAUDE.md  CONTRIBUTING.md  AGENTS.md
```

El detalle de cada directorio de `src/` y dónde se crea cada archivo está en la [guía de la estructura de `src/`](./docs/03-construccion/guia-estructura-src-sil-001.es.md).

</details>

<details>
<summary><strong>¿Por qué no hay <code>.harness/</code> aquí?</strong></summary>

<br/>

Porque el satélite **consume** el estándar, no lo aloja (S-16). Reglas, scripts y subagentes llegan por el plugin `organizacion-core`, así que todos los satélites ejecutan exactamente la misma versión y esa versión es su identidad ([ADR-0062](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0062-estandar-distribuido-como-plugin-versionado.es.md)). Un hook `PreToolUse` deniega la escritura en `.harness/` y el CI la rechaza.

</details>

<details>
<summary><strong>¿Cómo actualizo el estándar a una versión nueva?</strong></summary>

<br/>

```bash
claude plugin update organizacion-core@organizacion
# La copia instalada la declara el cliente en installed_plugins.json: se lee
# de ahí, no del número mayor del caché, que nunca se recoge (ADR-0169 §2.6).
ORG_CORE=$(node -e '
  const { resolve } = require("path");
  const registro = process.env.HOME + "/.claude/plugins/installed_plugins.json";
  let entradas = [];
  try { entradas = require(registro).plugins?.["organizacion-core@organizacion"] ?? []; } catch {}
  const aqui = process.cwd();
  const entrada = entradas.find((e) => e.projectPath && resolve(e.projectPath) === aqui)
    ?? entradas.find((e) => e.scope === "user")
    ?? entradas[0];
  if (!entrada?.installPath) {
    console.error("organizacion-core no está instalado; ejecuta: claude plugin enable organizacion-core@organizacion");
    process.exit(1);
  }
  console.log(entrada.installPath);
')
node "$ORG_CORE/scripts/validate-estructura-satelite.mjs"
```

Si la versión nueva añade reglas, el triaje correspondiente se registra en [DECISIONS.md](./DECISIONS.md) con su operación `Adopt` / `Extend` / `Override` / `N/A`.

</details>

<details>
<summary><strong>El pre-commit me bloqueó. ¿Qué hago?</strong></summary>

<br/>

Léelo: los validadores nombran el archivo y la regla. No se saltan con `--no-verify` — un gate evadido es un gate roto, y el CI lo vuelve a encontrar. Si crees que el validador se equivoca, eso **es** un hallazgo: regístralo en [GAPS.md](./GAPS.md) y propón el arreglo en `organizacion_arch`.

</details>

<details>
<summary><strong>Encontré algo que no puedo arreglar ahora. ¿Dónde lo registro?</strong></summary>

<br/>

En [GAPS.md](./GAPS.md), con su dimensión de madurez, criticidad y complejidad (SD-07). Con Claude Code: `/organizacion-core:organizacion-gap`. La evidencia precede a la afirmación (SD-05): si no puedes enlazar la prueba, el hallazgo se registra como pendiente en vez de darse por resuelto.

</details>

<details>
<summary><strong>Necesito una decisión técnica que no tiene ADR. ¿La decido aquí?</strong></summary>

<br/>

No. Toda decisión técnica referencia un ADR **aceptado** de `organizacion_arch`; si no existe, se crea allí primero (S-06). Lo que sí vive aquí son los ADR **locales** (`ADR-SIL-NNN`): decisiones propias del sistema que no alteran el estándar.

</details>

---

<div align="center">

**© Organización S.A.** · RUC 20100412447 · Operador Logístico Aduanero desde 1978<br/>
Estándar: [Organización Arch](https://github.com/organizacion-peru/organizacion_arch) · Plugin: `organizacion-core`

</div>
