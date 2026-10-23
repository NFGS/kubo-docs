# Diagramas y portadas

Versiones **archify** (HTML/SVG interactivo → PNG de alta resolución) de los
diagramas del proyecto, y las portadas del espejo de Notion/Obsidian. Son la
fuente durable de las imágenes que se incrustan en esos dos entornos.

## Diagramas

| Archivo | Diagrama |
| --- | --- |
| `contexto-c4-1.png` | Vista de contexto C4 nivel 1 |
| `contenedores-c4-2.png` | Vista de contenedores C4 nivel 2 |
| `componentes-erp-c4-3.png` | Vista de componentes C4 nivel 3 (kubo-erp) |
| `flujo-venta.png` | Secuencia del flujo crítico: registrar una venta |
| `modo-offline.png` | Secuencia de venta sin internet |
| `panorama-datos.png` | Panorama del modelo de datos |
| `modelo-confianza.png` | Modelo de confianza (seguridad) |
| `camino-critico.png` | Camino crítico y calendario del plan de cierre |

## Stack y arquitectura (interactivos, con animación)

| Archivo | Diagrama |
| --- | --- |
| `arquitectura-stack.png` / `.svg` | **Mapa de arquitectura y stack tecnológico**: 7 servicios con runtime, 4 almacenes, borde TLS y plataforma de operación |
| `flujo-venta-outbox.png` / `.svg` | Secuencia de la venta con el outbox transaccional resaltado y la analítica desacoplada |
| `flujo-venta-outbox.webm` | La misma secuencia en movimiento: traza animada de 6 s (VP9, 30 fps) |
| `html/arquitectura-stack.html` | Mapa de arquitectura interactivo (vistas guiadas por capa, modo claro/oscuro) |
| `html/flujo-venta-outbox.html` | Secuencia interactiva con animación de flujo encendida/pausada |

Los cuatro formatos (PNG, SVG, WebM y HTML) salen del mismo candidato JSON: el
HTML es la fuente interactiva y el PNG/SVG/WebM son sus exportaciones. El WebM
graba la misma traza que el botón *Live* del visor, así que el vídeo y el
diagrama no pueden divergir.

Los candidatos JSON y el script de exportación quedan en
[`archify/`](archify/): son la fuente de la que salen el HTML interactivo y sus
exportaciones, de modo que las imágenes se regeneran de forma reproducible con

```bash
node bin/archify.mjs finalize architecture <candidato>.json <salida>.html \
  --quality showcase --repo-root kubo-docs
node archify/export-archivos.mjs <salida>.html <prefijo-de-salida> light [--webm]
```

La evidencia de cada nodo se cita contra `kubo-docs` (el repositorio que
documenta la arquitectura del polyrepo) en la revisión `f39db92`.

Los diagramas fuente en Mermaid viven en los documentos (`01-arquitectura.md`,
`02-modelo-datos.md`, `04-seguridad.md`, `11-plan-de-cierre.md`); estas
versiones archify se generaron con la skill `archify` (calidad *showcase*) y se
incrustan en Notion y en el vault de Obsidian.

## Versiones duales por diagrama (Beru + Archify)

Dos diagramas nuevos existen en dos versiones comparables, cada una en su
propio directorio:

| Directorio | Diagrama | Versiones |
| --- | --- | --- |
| `estructura-funcionamiento/` | **Estructura del proyecto y cómo funciona**: polyrepo de 9 repos, recorrido de una venta (outbox), transversal de operación | `beru.html` / `beru.png` (diseño artesanal) · `archify.png` / `.svg` (skill archify, blueprint) |
| `stack-tecnologico/` | **Stack tecnológico**: un lenguaje por contexto (ADR-0004), 9 repos × sus tecnologías | `beru.html` / `beru.png` (matriz de 6 capas con logos) · `archify.png` / `.svg` (árbol editorial) |

Las versiones `beru.*` son HTML autocontenido sin red (fuentes y logos
base64, tema claro fijo) hechas a mano con el sistema de tokens del proyecto;
las `archify.*` salen del pipeline reproducible descrito abajo. Ambas citan la
misma evidencia de `kubo-docs` en la revisión `f39db92`.

## Portadas

`portada-kubo.png`, `portada-documentacion.png`, `portada-adrs.png`,
`portada-evidencia.png`, `portada-repositorios.png`, `portada-estado.png`:
portadas del espejo en Notion (kit Kubo/Linear) y del hub de Obsidian.

## Regeneración

- Diagramas: skill `archify` (autoría JSON → `finalize` → captura PNG).
- Portadas: plantilla HTML + Chrome headless (ver el kit local
  `~/.config/opencode/scripts/notion-design/`).
- Espejo de Obsidian: `./kubo-infra/scripts/obsidian-sync.sh`.
