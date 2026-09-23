# ADR-0003 — Multi-tenancy híbrido: `tenant_id` hoy, RLS lista para activar

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-23 |
| Estado | Aceptada |

## Contexto

Kubo se vende como software autoalojable: cada negocio instala su propia copia y
no paga suscripción. Sin embargo, el mercado exige más adelante una versión en
la nube con varias empresas en un mismo despliegue. Cambiar de modelo después es
costosísimo si el modelo de datos no lo previó.

## Decisión

**Modelo híbrido**: el código y el esquema son multi-tenant desde el día uno
(todas las tablas de negocio llevan `tenant_id` y todas las consultas filtran
por él), pero **el despliegue por defecto es de un solo negocio por
instalación**. La política de *row level security* de PostgreSQL está escrita y
versionada en cada servicio (`db/rls/enable-rls.sql`), lista para activarse
cuando exista el interceptor de transacción que fija `app.tenant_id`.

## Por qué no se activó RLS todavía

Activar RLS sin fijar la variable de sesión en cada transacción deja las
consultas sin resultados: sería un fallo silencioso. Hacerlo bien requiere un
interceptor que ejecute `SET LOCAL app.tenant_id` al abrir cada transacción,
probado con concurrencia. En el MVP se prioriza el aislamiento en la capa de
aplicación (verificado por la prueba de humo: un segundo negocio no ve datos del
primero) y se deja la segunda barrera preparada.

## Consecuencias

- **Positivas**: el mismo binario sirve para autoalojamiento y para nube; no hay
  que migrar el esquema para cambiar de modelo de negocio.
- **Negativas**: hoy el aislamiento depende de la disciplina del código. Se
  mitiga con la prueba automática de aislamiento y con la política SQL ya
  escrita.
- **Siguiente paso**: interceptor de transacción + activación de RLS en la fase 2.
