# ADR-0001 — Microservicios con monolito modular interno

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-23 |
| Estado | Aceptada |
| Decisores | Arquitectura Kubo |

## Contexto

Kubo debe cubrir cuatro dominios bien distintos (identidad, clientes, operación
comercial e indicadores) y, al mismo tiempo, poder instalarse en el local de una
PYME con recursos limitados (2 vCPU / 4 GB de RAM). El equipo es pequeño y el
tiempo de entrega, corto.

## Decisión

Se despliegan **cinco servicios independientes** (identidad, CRM, ERP,
analítica, documentos) más un API Gateway, cada uno con su propia base de datos.
**Dentro de cada servicio no se subdivide en más servicios**: se aplica
arquitectura limpia en capas (`domain`, `application`, `infrastructure`,
`presentation`) y los subdominios conviven como módulos del mismo despliegue.

## Alternativas consideradas

1. **Monolito único**: más simple de operar, pero incumple el requisito de
   microservicios y no demuestra aislamiento por dominio.
2. **Microservicios finos** (catálogo, inventario y ventas por separado): el
   costo de coordinación (transacciones, consistencia, red) supera el beneficio
   en un equipo de una persona.
3. **Microservicios con monolito modular interno** (elegida): cada servicio
   puede partirse más adelante sin reescribir la lógica, porque las fronteras
   entre módulos ya están trazadas.

## Consecuencias

- **Positivas**: se cumple el requisito, el consumo de memoria es acotado
  (~900 MB para todo el sistema), y el dominio queda listo para escalar
  horizontalmente el servicio que lo necesite.
- **Negativas**: no hay transacciones distribuidas; la consistencia entre
  servicios es eventual y se resuelve con eventos (ver ADR-0005).
- **Regla derivada**: si dos módulos del mismo servicio se comunican con
  demasiada frecuencia, se refactorizan a un solo módulo; si un módulo cambia
  por razones distintas a su servicio, se evalúa extraerlo.
