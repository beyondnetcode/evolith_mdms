# Contradicciones y vacíos del estándar de UX y frontend — puntos por decidir

<p align="right">
  <img src="https://img.shields.io/badge/ORG%20S.A.-Operador_Log%C3%ADstico_Aduanero-0f3e67?style=for-the-badge&logoColor=white" alt="Organización S.A.">
  <img src="https://img.shields.io/badge/Estado-Borrador-825500?style=flat-square" alt="Estado">
  <img src="https://img.shields.io/badge/Versi%C3%B3n-0.1.0-042139?style=flat-square" alt="Versión">
</p>

> **Artefacto:** Informe de puntos por decidir (complementario de la Fase 2)
> **Identificador:** `CN-SIL-001`
> **Fase:** 2 — Diseño y Arquitectura
> **Alcance:** satélite `organizacion-unilog` frente al estándar aceptado de `organizacion_arch`
> **Fecha:** 2026-10-22
> **Estado:** Borrador — para decisión del propietario de SIL. Si decide llevar algún punto al estándar, sigue el camino de [Contribuir al núcleo](../../CONTRIBUTING.md#contribuir-al-núcleo): este repositorio no puede editarlo (S-16).
> **Plantilla canónica:** ninguna; el estándar no tiene plantilla de informe de puntos por decidir
> **Gap que la origina:** [G-343](../../GAPS.md)
> **Método:** se leyeron en `origin/main` de `organizacion_arch` solo los ADR con estado `Aceptado` que gobiernan la interfaz (0110, 0109, 0165, 0245, 0246, 0131), el [stack agnóstico](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/stack-tecnologico-autorizado-agnostico.es.md), la [estrategia de frontend web](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/governance/standards/engineering/estrategia-frontend-web.es.md) y las reglas S-01 a S-25. El ADR-0228 (`Borrador`) no vincula y no se usó como norma (SD-03).

---

## 1. Para qué sirve

Al auditar el código de SIL contra el estándar aceptado aparecieron puntos donde **el propio estándar se contradice, calla o admite dos lecturas**. En cada uno el satélite tiene que elegir una lectura, y la regla S-15 le prohíbe elegir una que contradiga un ADR. El propietario decide cada punto y si lo lleva a `organizacion_arch`, para que la respuesta valga para toda la suite y no solo para SIL.

Cada punto lleva lo que dice cada fuente, el efecto en el satélite, lo que se hizo mientras tanto y la decisión que se pide.

## 2. Puntos por decidir

### CN-01 — Estado del ADR-0165: `Aceptado` en el ADR, «Borrador» en el stack agnóstico

| Fuente | Dice |
| :--- | :--- |
| [ADR-0165](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0165-seguridad-frontend-owasp-2025.es.md) (front-matter) y la [matriz de ADR](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/matriz-adr.es.md) | `estado: Aceptado`. |
| [Stack agnóstico §3](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/stack-tecnologico-autorizado-agnostico.es.md), fila «Seguridad de la Aplicación Cliente» | «pendiente de ratificación»; el ADR-0165 está «hoy en `Borrador`: aún no vincula». |

**Efecto.** Un satélite no sabe si P-SEC-01 a P-SEC-06 le obligan. SIL las trató como vinculantes (el front-matter es la fuente de verdad, SD-03).
**Se pide.** Corregir la fila del stack agnóstico, que parece haber quedado atrás de la aceptación.

### CN-02 — P-UX-08 y el patrón de menú del APG

| Fuente | Dice |
| :--- | :--- |
| [ADR-0110 P-UX-08](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0110-sistema-diseno-material-3-tokens.es.md) | «Un diálogo, panel lateral o **menú** DEBE atrapar el foco mientras está abierto, cerrarse con `Escape`, devolver el foco al elemento que lo abrió y volver inerte el resto del contenido (`inert`).» |
| Patrón de menú del [APG de la W3C](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/) | En un menú desplegable, `Tab` lo cierra y el foco sigue su camino. |

**Efecto.** El prototipo seguía el APG (`Tab` cerraba el menú y la página seguía operable). Leído al pie de la letra, el ADR lo prohíbe.
**Hecho mientras tanto.** Este PR aplica la lectura literal del ADR: `Tab` y `Mayús+Tab` recorren el menú sin salir, el resto queda `inert`, `Escape` cierra y el foco vuelve al botón (G-338).
**Se pide.** Aclarar el alcance de «menú»: (a) todo desplegable, incluidos los menús de acciones con `role="menu"`; o (b) solo los paneles modales (hojas y diálogos), y los menús de acciones siguen el APG. Con (b) el satélite revierte la trampa de `Tab` en los menús.

### CN-03 — P-UX-08 y los diálogos que no admiten cancelarse

| Fuente | Dice |
| :--- | :--- |
| [ADR-0110 P-UX-08](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0110-sistema-diseno-material-3-tokens.es.md) | El overlay «DEBE […] cerrarse con `Escape`». No prevé diálogos sin salida. |
| [ADR-0245 D6.4](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0245-portal-comun-de-la-suite-y-traspaso-de-sesion.es.md) | Con la sesión terminada, el satélite pide reiniciar sesión y vuelve a la misma pantalla; no existe «seguir sin sesión». |

**Efecto.** «Tu sesión terminó» es un diálogo con un solo botón. El [anexo A1 §2](./especificacion-ux-suite-acceso-sil-001.es.md) decía que `Escape` no lo cierra, lo que contradice P-UX-08.
**Hecho mientras tanto.** `Escape` ejecuta la acción segura del diálogo (la misma del botón: ir a iniciar sesión), de modo que la tecla actúa y no se puede descartar el aviso (G-338).
**Se pide.** Declarar la excepción en el ADR-0110: «un diálogo sin salida puede no cerrarse con `Escape`, pero la tecla ejecuta su acción segura». Si el núcleo prefiere que `Escape` descarte, el satélite necesita definir qué pasa con una sesión muerta.

### CN-04 — La estrategia de frontend web contradice el ADR-0131 y el stack autorizado

| Fuente | Dice |
| :--- | :--- |
| [Estrategia de frontend web §1](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/governance/standards/engineering/estrategia-frontend-web.es.md) | React 18+, React Router v6, Vite 5+, ESLint v9, y como componentes del stack React Hook Form, Zod, Zustand y Ky/Axios. |
| [ADR-0131](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/nodejs/0131-stack-frontend-react-19-router-v8.es.md) (`Aceptado`) y [ADR-0109 §2.12](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0109-doctrina-ingenieria-frontend-avanzada.es.md) | React 19, `react-router` 8 (retira `react-router-dom`) y ESLint v10 en _flat config_. |
| [Stack agnóstico §3](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/stack-tecnologico-autorizado-agnostico.es.md) y regla S-07 | Solo se usa lo del stack aprobado; lo nuevo exige ADR. |

**Efecto.** La estrategia de frontend, que parece la guía operativa, queda atrás del ADR en tres versiones. Además presenta como stack unas bibliotecas (formularios, validación, estado local, HTTP) que ningún ADR autoriza; SIL no usa ninguna, y no sabe si S-07 le exige hacerlo.
**Se pide.** Alinear el documento con el ADR-0131 y el ADR-0109, y decir si React Hook Form, Zod, Zustand y Ky/Axios son requisito del stack o solo ejemplos.

### CN-05 — «Bundle inicial < 200 KB»: ¿comprimido o sin comprimir?

| Fuente | Dice |
| :--- | :--- |
| [Estrategia de frontend web §2.2](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/governance/standards/engineering/estrategia-frontend-web.es.md) | «Bundle inicial < 200 KB». |
| [ADR-0109 §2.11](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0109-doctrina-ingenieria-frontend-avanzada.es.md) | Cada satélite declara su presupuesto «en cifras» y lo audita antes de cada release. |

**Efecto.** Sin unidad, la misma aplicación cumple (133 kB con gzip) o no (más de 400 kB sin comprimir). SIL declaró 200 kB **con gzip** de JavaScript inicial y 30 kB de CSS en [`presupuesto-bundle.json`](../../src/apps/sil-web/presupuesto-bundle.json), con un gate local (`bundle:check`).
**Se pide.** Fijar la unidad (con gzip o sin él) y qué cuenta como «inicial» (entrada más `modulepreload` más CSS, como midió SIL).

### CN-06 — CSP «basada en nonce o hash» en una SPA estática sin nada en línea

| Fuente | Dice |
| :--- | :--- |
| [ADR-0165 §2.2](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0165-seguridad-frontend-owasp-2025.es.md) | La CSP debe ser «estricta, basada en **nonce o hash**. Sin `unsafe-inline`, sin `unsafe-eval`». |
| [ADR-0109 §2.5](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0109-doctrina-ingenieria-frontend-avanzada.es.md) | «Arquitectura preparada para CSP estricto (sin estilos ni scripts _inline_)». |

**Efecto.** El build de SIL no incrusta ningún script ni estilo: todo es del mismo origen. No hay nada que firmar con nonce o hash, y una política con `script-src 'self'; style-src 'self'` es más estricta que la exigida. SIL la probó en `vite preview` sin violaciones en consola.
**Se pide.** Confirmar que una CSP con solo `'self'` y sin contenido en línea cumple P-SEC y §2.2, y que el nonce o el hash solo son obligatorios si algo entra en línea.

### CN-07 — SBOM: el estándar lo exige y la herramienta por defecto lo deja incompleto

| Fuente | Dice |
| :--- | :--- |
| [ADR-0165 P-SEC-03](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0165-seguridad-frontend-owasp-2025.es.md) | El build «DEBE producir SBOM». No nombra herramienta ni criterio de completitud. |
| Medición en SIL (2026-10-22) | `npm sbom` devuelve 5 componentes y omite `react`, `react-dom` y `scheduler`: el `package.json` usa `overrides` con referencia a la dependencia directa (`"react": "$react"`) y la herramienta descarta en silencio esos paquetes. `npm ls --omit=dev --all` sí lista los 8. |

**Efecto.** Un SBOM generado con el comando evidente cumple la letra del ADR y falla su propósito («¿esto que salió nos afecta?»): no incluye React.
**Hecho mientras tanto.** [`scripts/generar-sbom.mjs`](../../scripts/generar-sbom.mjs) arma el CycloneDX desde `npm ls` y falla si falta una dependencia declarada (G-342).
**Se pide.** Nombrar la herramienta autorizada y añadir a P-SEC-03 un criterio de completitud verificable: «el SBOM contiene todas las dependencias de producción declaradas». Idealmente, un validador del plugin que lo compruebe.

### CN-08 — Curvas de movimiento: el ADR nombra cuatro, M3 define seis y una no es una curva

| Fuente | Dice |
| :--- | :--- |
| [ADR-0110 §2.1](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0110-sistema-diseno-material-3-tokens.es.md) | Curvas M3 «`Standard`, `Emphasized`, `Decelerated`, `Accelerated`». |
| Tokens de movimiento de M3 | `standard`, `standard-decelerate`, `standard-accelerate`, `emphasized`, `emphasized-decelerate` y `emphasized-accelerate`; en web `emphasized` es una trayectoria compuesta, no una curva cúbica. |

**Efecto.** «Decelerated» y «Accelerated» no dicen de cuál de las dos familias hablan, y `emphasized` no tiene equivalente CSS exacto. SIL declaró las seis, con `emphasized` igual a `standard` (la aproximación canónica) y lo dejó anotado en `tokens/global/motion.json`.
**Se pide.** Enumerar los seis tokens como conjunto canónico y declarar la aproximación de `emphasized` para web, para que todos los satélites usen el mismo.

### CN-09 — Navegación inferior en `compact` con uno o dos destinos

| Fuente | Dice |
| :--- | :--- |
| [ADR-0110 §2.7](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0110-sistema-diseno-material-3-tokens.es.md) | «Barra inferior en `compact`, _navigation rail_ en `medium`, _drawer_ permanente a partir de `expanded`». |
| Barra de navegación de M3 | Se reserva para **tres a cinco** destinos. |

**Efecto.** SIL tiene un destino (Expedientes) y dos con «Servicios planificados». Una barra inferior de uno o dos elementos incumple M3; sin ella, SIL abre el riel como modal desde el menú de la barra superior. Desde `medium` SIL cumple: riel permanente y _drawer_ permanente desde `expanded`.
**Se pide.** Declarar la excepción en el ADR-0110: con menos de tres destinos, `compact` usa el riel modal.

## 3. Lo que se decidió sin consulta

El estándar es explícito en estos puntos y no hizo falta preguntar al núcleo:

- **Style Dictionary y los tres niveles de tokens** (ADR-0110 §2.2): aplicado en este PR ([G-230](../../GAPS.md)).
- **Objetivos táctiles de 48 dp** (ADR-0110 §2.3): aplicados en este PR; la especificación UI de este repositorio (§4.5, §4.6 y §4.15) es la que debe corregirse ([G-339](../../GAPS.md)).
- **Presupuestos de Core Web Vitals en campo** (ADR-0109 P-FE-09): no se pueden medir sin producción; queda pendiente ([G-151](../../GAPS.md)).

## 4. Historial de cambios

| Versión | Fecha | Autor | Descripción |
| :--- | :--- | :--- | :--- |
| 0.1.0 | 2026-10-22 | ConsultorExterno05, con Claude | Primer borrador: nueve puntos por decidir. |
