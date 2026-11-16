# MADUREZ.md — organizacion-unilog

<!--madurez-mide:real-->

> **Estado:** Activo | **Propietario:** Organización S.A. | **Regla:** S-19
> **Arquitectónica:** 1.2 / 5.0 · **SDLC:** 1.2 / 5.0 · **Global:** 1.2 / 5.0 — Inicial (Ad-Hoc)

Medición de madurez de este satélite, en la escala TOGAF ACMM heredada de [organizacion_arch](https://github.com/organizacion-peru/organizacion_arch). Se valida y repuntúa en cada commit. El validador lo provee el plugin `organizacion-core`:

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
node "$ORG_CORE/scripts/validate-madurez.mjs" --fix
node "$ORG_CORE/scripts/validate-madurez.mjs" --render
```

Un nivel ≥ 2 exige evidencia enlazada. Un nivel < 5 exige declarar el camino al siguiente. Cada casilla por debajo de 5 tiene su gap en [GAPS.md](./GAPS.md), en la dimensión homónima — y eso no es una buena intención: lo comprueba `validate-correspondencia.mjs`, y falla si alguna casilla se queda sin gap.

La columna **`Dim.`** es el token con el que cada casilla se enlaza a sus gaps. De ella deriva `validate-gaps.mjs` las dimensiones válidas: añadir un pilar o una fase aquí lo reconoce el validador sin tocar código.

**Esta tabla mide lo construido en este satélite, no a dónde quiere llegar.** Son dos métricas distintas y confundirlas ya costó una puntuación entera en el núcleo (G-169): la evidencia de una casilla no puede ser un documento que puntúe una arquitectura objetivo. El marcador `<!--madurez-mide:real-->` de arriba lo declara, y `validate-madurez.mjs` abre cada enlace de la columna Evidencia para negarse si mide otra cosa ([ADR-0179](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0179-toda-puntuacion-de-madurez-declara-que-objeto-mide.es.md)).

> **Un repositorio nuevo empieza abajo.** Un 1.0 no es un fracaso: es el punto de partida honesto. Inflarlo es exactamente lo que SD-05 prohíbe. La evidencia precede a la afirmación.

## 1. Madurez Arquitectónica — Pilares Well-Architected

| Pilar | Nivel | Evidencia | Camino al siguiente nivel | Dim. |
| :--- | ---: | :--- | :--- | :--- |
| Seguridad y Cumplimiento | 1 | — | Nivel 2: gitleaks y auditoría de dependencias activos en el pre-push, con evidencia enlazada | `Arq-Seguridad` |
| Eficiencia de Rendimiento | 1 | — | Nivel 2: NFR de rendimiento declarados en el PRD de SIL | `Arq-Rendimiento` |
| Confiabilidad y Resiliencia | 1 | — | Nivel 2: SLO y comportamiento degradado declarados (S-42) | `Arq-Confiabilidad` |
| Excelencia Operacional | 1 | — | Nivel 2: retención y destino por señal declarados con runtime real (S-36) | `Arq-Operacion` |
| Mantenibilidad y Extensibilidad | 2 | [src/Directory.Build.props](./src/Directory.Build.props) · [src/SonarLint.xml](./src/SonarLint.xml) · [DECISIONS.md D-005](./DECISIONS.md) | Nivel 3: ADR local de arquitectura y fronteras de capa verificadas por prueba (G-013) | `Arq-Mantenibilidad` |

## 2. Madurez SDLC — Adopción por Fase

| Fase | Nivel | Evidencia | Camino al siguiente nivel | Dim. |
| :--- | ---: | :--- | :--- | :--- |
| 1. Concepción y Descubrimiento | 1 | — | Nivel 2: PRD de SIL redactado y aprobado | `SDLC-Concepcion` |
| 2. Diseño y Arquitectura | 2 | [docs/02-diseno/blueprint-sil-001.es.md](./docs/02-diseno/blueprint-sil-001.es.md) (Borrador, trazado a ADR-0041, ADR-0047, ADR-0031, ADR-0051, ADR-0033, ADR-0036, ADR-0016, ADR-0097, ADR-0010 y ADR-0018 — todos `Aceptado` — y a ADR-SIL-001/ADR-SIL-002 en `Borrador`, explícitamente marcados como no vinculantes por SD-03) | Nivel 3: Blueprint aprobado por el Aprobador de Arquitectura en el gate «Baseline de Diseño Aprobado», con ADR-SIL-001 y ADR-SIL-002 en `Aceptado` | `SDLC-Diseno` |
| 3. Construcción | 1 | — | Nivel 2: primer código en `src/` compilando bajo `scripts/verify-local.sh`, con la historia técnica que lo origina (G-014) | `SDLC-Construccion` |
| 4. Validación y QA | 1 | — | Nivel 2: pruebas y coverage ≥ 80 % ejecutados por `scripts/verify-local.sh` sobre código real (G-015) | `SDLC-Validacion` |
| 5. Entrega y Operaciones | 1 | — | Nivel 2: proceso de release y primera entrega documentados | `SDLC-Entrega` |

---

<p align="center">
  <strong>© Organización S.A.</strong> · RUC 20100412447 · Operador Logístico Aduanero desde 1978
</p>
