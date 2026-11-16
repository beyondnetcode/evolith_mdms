# Fase 3 — Construcción

> **Hub de fase.** Puerta de salida: **Build Exitoso**.
> Los artefactos obligatorios de esta fase se pre-crean en borrador en el alta del
> satélite desde su plantilla canónica ([ADR-0149](https://github.com/organizacion-peru/organizacion_arch/blob/main/reference/architecture/adrs/core/0149-scaffolding-artefactos-alta-satelite.es.md)); los opcionales quedan **sugeridos** aquí y se instancian a demanda.

## Artefactos obligatorios

- [Historia Técnica](./historia-tecnica-sil-001.es.md) — `historia-tecnica-sil-001.es.md` (borrador scaffoldeado)

## Sugeridos (opcionales — no scaffoldeados)

- _(sin sugeridos declarados para esta fase)_

## Artefactos propios del satélite

- [Guía de la estructura de `src/`](./guia-estructura-src-sil-001.es.md) (`GS-SIL-001`): qué contiene cada directorio de `src/`, qué puede importar cada librería y dónde se crea cada tipo de archivo; incluye la estructura objetivo con microfrontends de ADR-0246, no activada ([D-024](../../DECISIONS.md#decisiones-locales) a [D-026](../../DECISIONS.md#decisiones-locales))
- [Glosario de código web](./glosario-codigo-web-sil-001.es.md): equivalencias español → inglés para los identificadores del frontend ([D-025](../../DECISIONS.md#decisiones-locales))

### MDM (`mdm-api`, alojado provisionalmente: [D-027](../../DECISIONS.md#decisiones-locales))

- [Especificación técnica del maestro de organización y sede](./especificacion-tecnica-organizacion-sede-mdm-001.es.md): diseño del CRUD de Tenant y Branch con la estructura de la plantilla de historia técnica; no es historia técnica de la cadena porque MDM no tiene historia funcional ni PRD ([G-323](../../GAPS.md)) ([D-031](../../DECISIONS.md#decisiones-locales))
- [Contrato de la API del maestro de organización y sede](./contrato-api-organizacion-sede-mdm-001.es.md): endpoints de `/api/v1`, `ETag`/`If-Match` con `428` y `412`, Problem Details con `code` y paginación
- Interfaz web de MDM en código: `src/libs/mdm-app`, `src/libs/mdm-contracts` y `src/libs/mdm-mock`, montada en `src/apps/sil-web` ([D-044](../../DECISIONS.md#decisiones-locales)); E2E en `src/apps/sil-web/e2e/mdm.spec.ts`
- [Contrato de la API de geografía](./contrato-api-geografia-mdm-003.es.md) y su [OpenAPI 3.1](./openapi-geografia-mdm-003.yaml): `API-MDM-003`, diseño sin código; fuente del mock de la geografía ([D-049](../../DECISIONS.md#decisiones-locales))
- [Contrato de la API de Party](./contrato-api-party-mdm-002.es.md) y su [OpenAPI 3.1](./openapi-party-mdm-002.yaml): `API-MDM-002`, diseño sin código (D-043); fuente del mock de `mdm-app` (D-044)
- [Modelo de dominio del rol Cliente](../02-diseno/modelo-dominio-cliente-mdm-001.es.md): en realineación por D-043 (Cliente = rol de Party); aún sin código
- MDM en conjunto, con su ruta de lectura: [hub de MDM](../02-diseno/hub-mdm.es.md). La especificación y el contrato de arriba describen el código de D-031, **en revisión por D-043** ([G-552](../../GAPS.md))

## Estado de la fase

Declara aquí documentos, agentes involucrados, flujos ejecutados, entradas,
salidas y dependencias con otras fases (Contrato de Ubicación de Artefactos).
