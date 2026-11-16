# Guía de Contribución — organizacion-unilog

> **Estado:** Activo | **Propietario:** Organización S.A. | **Reglas:** S-06, S-16, S-18, SD-05, SD-07, SD-08

Este repositorio es un **satélite** de [`organizacion_arch`](https://github.com/organizacion-peru/organizacion_arch). No define el estándar: lo consume, versionado, desde el plugin `organizacion-core`.

## Principios

1. **Idioma único (SD-08).** Toda contribución va en español. No se aceptan pares bilingües ni archivos `.en.md`.
2. **Taxonomía heredada (S-18).** La estructura de este repositorio la rige la [Taxonomía de Repositorio Satélite](https://github.com/organizacion-peru/organizacion_arch/blob/main/taxonomy/taxonomia-repositorio-satelite.md) — `kebab-case`, sin directorios sin scope. Se **referencia, no se copia**: no mantengas una versión local.
3. **Frontera de carpetas.** Documentación en `reference/`, planificación en `docs/`, código ejecutable en `src/`. No mezclar.
4. **El estándar no se edita desde aquí (S-16).** Este repositorio no contiene `.harness/`. `.claude/agents/` y `.claude/settings.json` son zona protegida. Ver [Contribuir al núcleo](#contribuir-al-núcleo).
5. **Enlaces relativos (S-10).** Desde la ubicación del archivo, y deben resolver. Un enlace roto falla la tarea (SD-06).
6. **Evidencia antes que afirmación (SD-05).** Una decisión referencia su ADR; un gap cerrado, su commit o PR. Sin prueba enlazada se registra el pendiente en [`GAPS.md`](./GAPS.md), no se afirma.

## Proceso

1. **Rama.** Desde la rama de integración, con prefijo `docs/`, `feat/` o `fix/` según el cambio.
2. **Especificación primero (SD-01).** Un cambio de comportamiento arranca de su artefacto SDLC. Las correcciones triviales —typo, enlace roto, formato— están exentas.
3. **Trazabilidad a ADRs (S-06).** Toda decisión técnica referencia un ADR **aceptado** de `organizacion_arch`. Si no existe, se crea allí primero. Nunca se resuelve inventando la decisión aquí.
4. **Registrar hallazgos (SD-07).** Todo gap, oportunidad, riesgo o deuda que descubras va a [`GAPS.md`](./GAPS.md) con su dimensión de madurez, criticidad y complejidad — nunca solo en el cuerpo del PR.
5. **Validar antes del commit.** El barrido completo, en un paso:

   ```bash
   # Con Claude Code:
   #   /organizacion-core:validar-gobernanza
   #
   # A mano, localizando el plugin:
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
   node "$ORG_CORE/scripts/validate-gaps.mjs" --fix
   node "$ORG_CORE/scripts/validate-correspondencia.mjs"
   node "$ORG_CORE/scripts/validate-docs.mjs"
   node "$ORG_CORE/scripts/validate-trazabilidad.mjs"
   node "$ORG_CORE/scripts/validate-satellite-base.mjs"
   node "$ORG_CORE/scripts/validate-triaje.mjs"
   ```

6. **Build y pruebas del runtime.**

   ```bash
   bash scripts/verify-local.sh build          # .NET 10 con SonarAnalyzer y TreatWarningsAsErrors
   bash scripts/verify-local.sh tests-dotnet   # xunit.v3 con suelo de pruebas
   bash scripts/verify-local.sh prepush        # la pipeline local completa que corre el pre-push
   ```

7. **Hook de pre-commit.** No se activa al clonar: git se niega por diseño a ejecutar la configuración de un repositorio ajeno. Una vez por clon:

   ```bash
   node "$ORG_CORE/scripts/install-hooks.mjs"
   ```

   El hook local se evade con `--no-verify`. **La puerta inevadible es el CI**, que fija la versión del estándar en `STANDARD_REF`.

## Contribuir al núcleo

Este satélite **no puede** modificar el estándar: ni sus reglas, ni sus validadores, ni sus subagentes. Un hook `PreToolUse` deniega la escritura y el CI la rechaza. Eso no es una limitación, es lo que impide que veintidós reglas deriven en tantas variantes como repositorios.

El camino de vuelta es explícito:

```mermaid
flowchart LR
    D["Detectas la carencia<br/>en el estándar"] -->|"SD-07"| G["GAPS.md<br/>del satélite"]
    G -->|"el cambio es del estándar"| PR["PR a organizacion_arch<br/>contra .harness/"]
    PR -->|"acepta"| UA["organizacion_arch"]
    UA -->|"publica"| PL["organizacion-core<br/>versión nueva"]
    PL -->|"provee"| D
    PL -->|"subes STANDARD_REF"| C["Cierras el gap<br/>con evidencia"]

    style D fill:#e3f2fd,stroke:#1565c0,color:#000
    style UA fill:#e8f5e9,stroke:#2e7d32,color:#000
    style PL fill:#fff3e0,stroke:#e65100,color:#000
    style G fill:#fce4ec,stroke:#ad1457,color:#000
```

1. **Registra el hallazgo** en [`GAPS.md`](./GAPS.md), con dimensión, criticidad y complejidad. Un hallazgo no registrado se olvida.
2. **Comprueba si ya está resuelto** aguas arriba: puede que la versión del plugin que consumes esté atrasada. Compara la que tienes instalada con la última publicada.

   ```bash
   cat "$ORG_CORE/.claude-plugin/plugin.json" | grep version
   gh release list --repo organizacion-peru/organizacion-marketplace --limit 1
   ```

3. **Abre la propuesta como PR en `organizacion_arch`**, contra la fuente del estándar (`.harness/`), nunca contra una copia local. Si el cambio es una decisión técnica, lleva su ADR.

   ```bash
   gh pr create --repo organizacion-peru/organizacion_arch --title "..." --body "Origen: organizacion-unilog, gap G-NNN"
   ```

4. **Cuando el núcleo acepte y publique**, sube la versión del plugin en `STANDARD_REF` y cierra el gap **con la evidencia enlazada**: el PR del núcleo, o el tag de la versión que lo trae.

Si necesitas apartarte de una regla sin cambiarla para todos, eso es un `Override`, se declara en [`DECISIONS.md`](./DECISIONS.md) y **exige un ADR local que lo justifique**. Un `Override` sin ADR lo rechaza `validate-triaje.mjs`.

## Estructura del repositorio

| Ruta | Contenido | Autoridad |
| :--- | :--- | :--- |
| `src/` | Código ejecutable del satélite | Manda la convención del runtime, no `kebab-case` |
| `docs/` | Artefactos de planificación e implementación | Taxonomía documental |
| `reference/` | Corpus documental propio | Taxonomía documental |
| `reference/governance/gaps/` | Fichas de detalle y evidencia de los gaps | S-20 |
| `MADUREZ.md`, `GAPS.md` | Gobernanza viva. Se repuntúan solos en cada commit | S-19, S-20 |
| `DECISIONS.md` | Triaje de las reglas de herencia y decisiones locales | S-15 |
| `.claude/agents/`, `.claude/settings.json` | Zona protegida. Los provee el plugin | S-21 |

---

## Historial de Cambios

| Versión | Fecha | Autor | Descripción |
| :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-09-23 | organizacion-unilog | Materialización desde la plantilla del plugin `organizacion-core` |

---

<p align="center">
  <strong>© Organización S.A.</strong> · RUC 20100412447 · Operador Logístico Aduanero desde 1978
</p>
