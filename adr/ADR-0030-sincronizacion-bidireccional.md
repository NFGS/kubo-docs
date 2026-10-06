# ADR-0030 — Sincronización bidireccional de los 4 entornos con reconciliación

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-06 |
| Estado | Aceptada e implementada |
| Relacionada | ADR-0027 (sincronización de los 4 entornos) · ADR-0002 (polyrepo) · ADR-0028 (despliegue público) |

## Contexto

El ADR-0027 dejó el directorio del proyecto como fuente canónica y tres espejos
derivados (GitHub, Notion, Obsidian) con una huella global. Ese diseño detecta
los cambios del canónico, pero **no los cambios hechos en un espejo**: una
edición manual en Notion o en el vault quedaba como "desvío" y la siguiente
sincronización la sobrescribía sin aviso. El dueño del proyecto pidió lo
contrario: que un cambio en **cualquiera** de los 4 entornos se detecte y se
propague a los demás, manteniendo la coherencia (sin incongruencias ni
contradicciones) y respetando la naturaleza de cada entorno (GitHub: código e
historial; Notion: presentación; Obsidian: grafo y wikilinks; local: fuente).

## Decisión

1. **Líneas base por ítem** en `~/.config/opencode/kubo-sync/`:
   `files-baseline.json` (sha256 por archivo canónico), `notion-baseline.json`
   (`last_edited_time` por página) y `obsidian-baseline.json` (sha256 por
   nota). Los manifiestos (`notion-manifest.json`, `obsidian-manifest.json`)
   mapean cada página/nota con su archivo de origen y la marcan `importable` o
   `generado`.
2. **Detección y reconciliación** (`kubo-sync.sh check|pull`):
   - GitHub: `git fetch` + fast-forward cuando el local está limpio y solo
     detrás; divergencia o árbol sucio ⇒ conflicto (sin auto-merge).
   - Notion: página editada desde la línea base ⇒ se importa al archivo
     canónico (sin la línea de callout que agrega el diseño).
   - Obsidian: nota editada ⇒ se importa revirtiendo frontmatter y wikilinks a
     enlaces Markdown relativos.
3. **Política de conflictos explícita**: si el mismo ítem cambió en dos
   entornos (o el viaje de ida y vuelta perdería información, p. ej. diagramas
   Mermaid en Notion), **no se pisa nada**: la versión del espejo queda en
   `.sync/conflictos/` (ignorado por git) y el ciclo reporta `CONFLICTOS`.
   Las páginas generadas (índices, intro) se regeneran, no se importan.
4. **Ciclo automático desplegado**: `kubo-sync.service` + `kubo-sync.timer`
   (systemd de usuario, cada 15 min, `auto --commit`) con las unidades en
   `kubo-infra/systemd/user/` e instalador `instalar-unidades-usuario.sh`.
   `auto` = detección → importación → propagación → push, con registro en
   `auto.log` y notificación de escritorio si hay conflictos.
5. **Commits acotados**: el modo `--commit` solo agrega los archivos del
   alcance del sync (README, `kubo-docs/`, PDF y su huella); el trabajo ajeno
   al sync queda intacto y se reporta. Las ediciones importadas de un espejo
   se commitean con el mensaje `sync: documentacion actualizada (kubo-sync)`.
6. **Trazabilidad**: cada ciclo deja resumen en `auto.log`; el journal del
   servicio usa salida sin subprocesos cortos (journald atribuye mal las
   líneas de procesos efímeros).

## Opciones consideradas

| Opción | Por qué no |
| --- | --- |
| Bidireccional total con merge automático | Sin revisión humana puede fabricar contenido híbrido incorrecto; el staging de conflictos es verificable |
| Solo detección (avisar sin importar) | Incumple el requisito: el cambio en un espejo debe llegar a los demás |
| Comparar el contenido completo en vez de líneas base | Costoso (56 páginas × markdown completo) y frágil ante normalizaciones de Notion; `last_edited_time` + hashes es exacto y barato |
| Editar solo en local (estado anterior) | El usuario trabaja también en Notion y Obsidian; prohibirlo no era viable |

## Consecuencias

- **Positivas**: los 4 entornos convergen vengan de donde vengan los cambios;
  nada se destruye sin dejar rastro (staging + git); el ciclo corre solo cada
  15 minutos; el costo es bajo (≈50 s por ciclo, API de Notion a 3 req/s).
- **Negativas**: el viaje de ida y vuelta de Notion no es perfecto para
  archivos con Mermaid (se marca conflicto en vez de importar); una edición
  concurrente en local y espejo exige resolución manual; el timer commitea
  documentación automáticamente (decisión explícita del dueño).
- **Revisión**: si el proyecto suma colaboradores, se evaluará requerir PR para
  los commits del sync y ampliar el staging a notificaciones externas.

## Verificación

- Ciclo completo probado en las 4 direcciones: local→espejos, Notion→local,
  Obsidian→local y GitHub→local (fast-forward), con reversión y
  re-sincronización.
- Conflicto real probado: edición simultánea local+Notion ⇒ staging en
  `.sync/conflictos/`, local intacto, `RESULTADO: CONFLICTOS`.
- `kubo-sync.timer` activo (cada 15 min) con `auto --commit`; `auto.log`
  registra cada ciclo y su resumen.
- `make sync-check` → sin deriva; `make sync-status` → SINCRONIZADO.
