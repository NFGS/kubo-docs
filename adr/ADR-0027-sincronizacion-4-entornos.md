# ADR-0027 — Sincronización de los 4 entornos: repositorio canónico y espejos con huella

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-04 |
| Estado | Aceptada e implementada |
| Relacionada | ADR-0002 (polyrepo con contratos) · ADR-0018 (documentos) |

## Contexto

El proyecto vive en cuatro entornos con roles distintos: el **directorio del
proyecto** (repos git locales, fuente de trabajo), **GitHub** (código e
historial publicados), **Notion** (documentación de consulta con diseño:
portadas, iconos, callouts y diagramas) y **Obsidian** (knowledge base con
grafo y wikilinks). Mantenerlos a mano produce el riesgo clásico: versiones que
se contradicen (un humo 192 en un lado y 189 en otro, una decisión que solo
existe en un espejo).

La documentación se regenera de fuentes Markdown, así que la pregunta no es
"cómo editar cuatro veces" sino **cuál es la fuente de verdad y cómo detectar
que un espejo quedó desviado**.

## Decisión

1. **El directorio del proyecto es la fuente canónica.** GitHub, Notion y
   Obsidian son **espejos derivados**; nunca se edita contenido en un espejo
   (la presentación propia de cada uno — portadas, iconos, wikilinks — sí es
   suya).
2. **Huella de sincronización**: un `sha256` (16 hex) de las fuentes canónicas
   (README raíz, 13 documentos, ADRs, evidencia, diagramas y los README de los
   9 repos). Cada espejo guarda la huella con la que fue generado: Notion en
   el intro de la página raíz; Obsidian en el frontmatter del hub.
3. **Orquestador `kubo-infra/scripts/kubo-sync.sh`** con tres comandos:
   `status` (compara huellas y estado git; no cambia nada), `run` (propaga solo
   lo desviado: PDF si las fuentes de docs cambiaron → Notion → Obsidian →
   push de commits pendientes) y `watch` (vigila y propaga al detectar
   cambios).
4. **La presentación se preserva**: el sincronizador de Notion inyecta los
   callouts de resumen y reemplaza los bloques Mermaid por los diagramas
   archify ya subidos (mapa persistente de `file-upload` ids), de modo que
   re-sincronizar no degrada el diseño.
5. **Los cambios manuales en un espejo se detectan como desvío** (la huella no
   coincide) y `run` lo regenera desde el repositorio. La política es
   explícita: el contenido se corrige en la fuente, no en el espejo.
6. **Git nunca se automatiza a ciegas**: `run` empuja commits que ya existen;
   auto-commitear cambios locales requiere `--commit` explícito.

## Consecuencias

- **Positivas**: los cuatro entornos quedan alineados sin incongruencias; la
  sincronización es idempotente y regenerable (un espejo corrupto se
  reconstruye); cada entorno conserva su fortaleza (GitHub: código; Notion:
  presentación; Obsidian: grafo).
- **Negativas**: la huella es gruesa (un cambio en cualquier README dispara la
  re-sincronización completa de Notion); los PNG de diagramas no se re-suben
  automáticamente si cambian (requieren el kit de diseño); Notion y Obsidian
  dependen de un token y de una ruta local respectivamente.

## Verificación

- `make sync-status` → **SINCRONIZADO** con las cuatro huellas iguales.
- Ciclo completo ejecutado dos veces: Notion 53 operaciones OK / 0 errores,
  Obsidian regenerado, PDF al día.
- Prueba de detección: un cambio temporal en `07-pruebas.md` marca PENDIENTE;
  al revertirlo, los espejos vuelven a `ok`.
- Preservación del diseño: tras dos sincronizaciones, `01 — Arquitectura`
  conserva su callout y sus 5 diagramas (0 bloques Mermaid) y `02` mantiene
  sus 2 diagramas ER.
