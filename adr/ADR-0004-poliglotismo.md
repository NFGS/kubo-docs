# ADR-0004 — Poliglotismo deliberado: un lenguaje por contexto

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-23 |
| Estado | Aceptada |

## Contexto

El proyecto exige al menos cuatro microservicios con un mínimo de tres
tecnologías distintas. La tentación es elegir un lenguaje y repetirlo por
comodidad, pero eso convierte el requisito en un ejercicio vacío.

## Decisión

Cada servicio se implementa en el lenguaje cuya **forma natural** encaja con su
problema, y esa elección se documenta:

| Servicio | Lenguaje | Por qué ese y no otro |
| --- | --- | --- |
| Identidad | Java 21 + Spring Boot 4 | El ecosistema de seguridad más maduro: Spring Security, validación, JPA, migraciones. Aquí la corrección importa más que la novedad. |
| CRM | Ruby 3.4 + Rails 8 | Velocidad de evolución del modelo comercial. ActiveRecord y las migraciones permiten iterar el esquema de clientes en minutos. |
| ERP | Elixir 1.17 + Phoenix 1.8 | La venta es la operación crítica: concurrencia masiva, latencia predecible y tolerancia a fallos con árboles de supervisión de OTP. |
| Analítica | Python 3.13 + FastAPI | Agregaciones y, en la fase 2, pronóstico de demanda. El ecosistema de datos y el motor de agregación de MongoDB encajan sin esquema rígido. |
| Gateway | TypeScript + NestJS | Capa de borde con validación de JWT, límites de tasa y enrutamiento: el mismo lenguaje del frontend reduce el cambio de contexto. |
| PWA | React 19 + Vite | Interfaz instalable, offline-first y con tipado compartido. |

## Consecuencias

- **Positivas**: el equipo aprende cinco ecosistemas reales; cada servicio usa
  la herramienta idónea; el requisito se cumple con sentido y no por relleno.
- **Negativas**: cinco toolchains, cinco pipelines, cinco formas de hacer
  pruebas. Se mitiga con un contrato común (ADR-0002), con la misma estructura
  de carpetas y con la prueba de humo que valida el sistema completo.
- **Regla derivada**: ningún servicio se reescribe en otro lenguaje sin un ADR
  que lo justifique con métricas (latencia, costo, mantenibilidad).
