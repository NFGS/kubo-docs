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

Los diagramas fuente en Mermaid viven en los documentos (`01-arquitectura.md`,
`02-modelo-datos.md`, `04-seguridad.md`, `11-plan-de-cierre.md`); estas
versiones archify se generaron con la skill `archify` (calidad *showcase*) y se
incrustan en Notion y en el vault de Obsidian.

## Portadas

`portada-kubo.png`, `portada-documentacion.png`, `portada-adrs.png`,
`portada-evidencia.png`, `portada-repositorios.png`, `portada-estado.png`:
portadas del espejo en Notion (kit Kubo/Linear) y del hub de Obsidian.

## Regeneración

- Diagramas: skill `archify` (autoría JSON → `finalize` → captura PNG).
- Portadas: plantilla HTML + Chrome headless (ver el kit local
  `~/.config/opencode/scripts/notion-design/`).
- Espejo de Obsidian: `./kubo-infra/scripts/obsidian-sync.sh`.
