# ADR-0003 — Multi-tenancy híbrido: `tenant_id` + RLS activo

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-23 |
| Actualizado | 2026-09-24 (RLS activado en la Fase 1) |
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
instalación**.

Como segunda barrera, **RLS está activo con `FORCE`** en las tres bases
PostgreSQL. Cada petición abre una transacción y fija `app.tenant_id` mediante un
interceptor propio de cada lenguaje; las operaciones que cruzan negocios por
diseño (autenticación por correo, cadena de auditoría global, semilla) usan la
marca `app.system`. El detalle y las consecuencias están en
[ADR-0010](ADR-0010-rls-activo.md).

## Activación de RLS (Fase 1)

La activación se pospuso en el MVP por una razón concreta: activar RLS sin fijar
la variable de sesión en cada transacción deja las consultas sin resultados —un
fallo silencioso—. La Fase 1 aportó lo que faltaba:

1. Interceptores de transacción en los tres servicios (Java, Rails y Phoenix).
2. Políticas versionadas en migraciones (`V3__enable_rls.sql` en IAM,
   `20260923000003_enable_rls.rb` en CRM y `20260923000004_enable_rls.exs` en ERP).
3. La distinción explícita entre contexto de negocio y contexto de sistema.
4. Verificación automática en `make smoke`: sin contexto **0 filas**, con
   contexto > 0, en las tres bases.

## Consecuencias

- **Positivas**: el mismo binario sirve para autoalojamiento y para nube; no hay
  que migrar el esquema para cambiar de modelo de negocio. El aislamiento ya no
  depende de la disciplina del código: lo impone el motor.
- **Negativas**: toda transacción nueva debe fijar su contexto; los
  interceptores cubren el camino normal y los caminos de sistema lo hacen
  explícito. Es la regla a recordar al agregar código.
- **Siguiente paso**: zona horaria por negocio en la tabla `tenants` (ADR-0012,
  Fase 4) para el despliegue SaaS multi-tenant.
