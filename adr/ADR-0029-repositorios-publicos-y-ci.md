# ADR-0029 — Repositorios públicos con licencia MIT y CI en GitHub Actions

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-06 |
| Estado | Aceptada e implementada |
| Relacionada | ADR-0002 (polyrepo) · ADR-0027 (sincronización de los 4 entornos) · ADR-0028 (despliegue público) |

## Contexto

El MVP está operable y verificado en local (`make ci`: 13 verificaciones), pero
los 9 repositorios vivían en GitHub **privados**, sin licencia explícita, sin
integración continua en la nube y sin un camino de clonado para terceros. El
proyecto cumple además una función de **vitrina profesional** (jurados,
reclutadores, clientes) y necesita: que cualquiera pueda leer el código y la
documentación; que un clon desde cero funcione en un solo paso; que cada cambio
se verifique automáticamente en GitHub (no solo en la máquina del autor); y que
la rama `main` quede protegida contra reescrituras y borrados.

Restricciones: costo $0 (plan gratuito de GitHub); la demo pública usa datos de
ejemplo (ADR-0028); el despliegue real de cada negocio ocurre en su propio
servidor, nunca en la nube del proyecto.

## Decisión

1. **Repositorios públicos** (workspace + 8 hijos). Antes de cambiar la
   visibilidad se ejecutó el escaneo de secretos (6 verificaciones, 0
   hallazgos) y se confirmó que no hay `.env`, claves ni tokens en el árbol ni
   en el historial de los 9 repos.
2. **Licencia MIT** en los 9 (titular: Nelson Fabián Gallego Sánchez), la que
   ya declaraban el README y la portada del PDF; ahora es explícita y detectada
   por GitHub.
3. **CI en GitHub Actions** por repositorio (`.github/workflows/ci.yml`), espejo
   del gate local: gateway (typecheck + pruebas con Redis real), IAM (`mvn
   verify` + Testcontainers), CRM y ERP (PostgreSQL real con RLS), analítica
   (pytest + cobertura + MongoDB), web (typecheck + vitest), docs (enlaces
   relativos con el workspace completo) e infra (sintaxis de scripts + compose
   válido con `.env.example`).
4. **Protección de `main`** en los 9: sin force-push ni borrado de la rama; en
   los 8 con CI, el *status check* del job correspondiente es obligatorio para
   fusionar pull requests (`strict`). Los pushes directos del mantenedor siguen
   permitidos mientras el proyecto esté en manos de una sola persona.
5. **Clonado en un paso**: `scripts/clonar-todos.sh` + `make clone` en el
   workspace; el Ansible del despliegue clona los 9.
6. **Versionado**: tag `v0.3.0` en los 9 y release publicado en el workspace.

## Opciones consideradas

| Opción | Por qué no |
| --- | --- |
| Mantener los repos privados | El proyecto pierde su función de vitrina y el portafolio no es verificable |
| Públicos sin licencia explícita | Sin licencia rige "todos los derechos reservados", contra el README y la adopción |
| CI solo local (`make ci`) | La verificación no es reproducible por terceros ni visible en PRs |
| GitLab CI | Descartado antes: migración completa a GitHub, un solo proveedor |
| Exigir PR y revisiones al mantenedor | Fricción innecesaria para un equipo de una persona; se revisará al sumar colaboradores |

## Consecuencias

- **Positivas**: portafolio público verificable (badge de CI por repositorio);
  ningún PR externo se fusiona con la CI en rojo; `main` no puede reescribirse
  ni borrarse; el clonado desde cero está probado; Actions es ilimitado en
  repositorios públicos; la licencia MIT habilita el uso y la contribución.
- **Negativas**: el código y el historial quedan visibles de forma permanente
  (mitigado con el escaneo previo y la disciplina de secretos); dependencia del
  plan gratuito de GitHub (si el producto se comercializa, se evaluará
  open-core: núcleo público + módulos privados); los checks obligatorios añaden
  una espera al fusionar PRs.
- **Revisión**: al entrar un segundo colaborador se activará "requerir PR +
  aprobación" y se incluirá al administrador en las protecciones.

## Verificación

- `gh api repos/NFGS/<repo>` reporta visibilidad pública y licencia MIT en los 9.
- 8 flujos de CI en verde (gateway, IAM, CRM, ERP, analítica, web, docs, infra)
  y el gate local sigue en 13/13.
- Clon público desde cero: workspace + `make clone` trae los 8 hijos.
- Protección activa en `main` (sin force-push ni borrado) con los checks
  exigidos por repositorio.
- Tag `v0.3.0` en los 9 repos y release publicado en el workspace.
