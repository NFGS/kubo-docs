# ADR-0002 — Polyrepo con contratos como fuente de verdad

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-23 |
| Estado | Aceptada |

## Contexto

El requisito del proyecto exige un repositorio separado por cada parte del
software. Además, cada servicio usa un lenguaje y un ecosistema distinto, con
herramientas de construcción incompatibles entre sí.

## Decisión

**Un repositorio por componente** (nueve en total): gateway, cuatro servicios,
PWA, infraestructura, documentación y el repositorio raíz de workspace. La
comunicación entre repos se gobierna por **contratos explícitos**:

- HTTP: contrato documentado en `kubo-docs/03-api.md` con ejemplos ejecutables.
  La **especificación OpenAPI 3.1 en archivo** (y las pruebas de contrato
  automatizadas) quedan para la fase 2: hoy el contrato se verifica con la prueba
  de humo end-to-end, que ejerce todos los endpoints desde el gateway.
- Eventos: sobre estable versionado (`event_id`, `event_type`, `version`,
  `occurred_at`, `tenant_id`, `data`).
- Base de datos: cada servicio es dueño exclusivo de su esquema; **ningún
  servicio consulta la base de otro**.

## Consecuencias

- **Positivas**: cada servicio se construye, versiona y despliega por separado;
  un fallo de toolchain en un lenguaje no bloquea a los demás; los equipos
  pueden crecer sin fricción de monorepo.
- **Negativas**: los cambios de contrato exigen coordinación entre repos. Se
  mitiga con versionado semántico del contrato y una prueba de humo que valida
  el flujo completo antes de cada entrega.
- **Regla derivada**: un cambio incompatible en un contrato obliga a subir la
  versión del evento o del endpoint, nunca a modificar el significado del
  existente.
