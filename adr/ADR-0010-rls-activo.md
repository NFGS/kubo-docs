# ADR-0010 — RLS activo con interceptor de transacción

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada (Fase 1) |
| Relacionada | ADR-0003 (multi-tenancy híbrido) |

## Contexto

El aislamiento entre negocios dependía de que **toda** consulta recordara filtrar
por `tenant_id`. Un olvido no se detecta: no falla, simplemente muestra datos de
otro negocio. La política de *row level security* existía escrita desde el MVP,
pero desactivada porque activarla sin un interceptor rompe autenticación y
semilla.

## Decisión

RLS activo en las tres bases PostgreSQL, con **`FORCE`** (el rol de la aplicación
es dueño de las tablas; sin FORCE PostgreSQL lo eximiría de las políticas).

1. Cada transacción fija su contexto con
   `select set_config('app.tenant_id', '<uuid>', true)` — local a la transacción,
   imposible de filtrar a otra petición que reutilice la conexión.
2. **Interceptores por lenguaje**:
   - IAM (Java): `TenantRlsFilter` envuelve cada petición en una transacción.
   - CRM (Rails): `around_action` en `ApplicationController`.
   - ERP (Phoenix): `action/2` en `KuboErpWeb.controller`.
3. **Marca `app.system`** para operaciones que cruzan negocios por diseño:
   autenticación por correo (el negocio aún no se conoce), rotación de tokens,
   cadena de auditoría global, semilla y respuesta a incidentes de seguridad.
   Sin ella, login y recuperación de contraseña serían imposibles.
4. Alcance por tabla:
   - `sale_items` no tiene `tenant_id`: su política hereda el negocio por la venta.
   - `outbox_events` queda fuera: tabla operativa que el publicador lee cruzando
     negocios (ver ADR-0009).
   - `tenants` queda sin RLS: el registro debe comprobar la unicidad global del slug.
5. Las transacciones `REQUIRES_NEW` **no heredan** el contexto de la exterior:
   `SecurityIncidentService` y `AuditService` fijan su propia marca. Sin esto, la
   revocación de la familia de tokens actualizaba cero filas **en silencio** —el
   sistema detectaba el robo y no cerraba nada—.

## Consecuencias

- El aislamiento pasa a ser garantía del motor, no del programador: una consulta
  sin contexto devuelve **cero filas**.
- Toda transacción nueva debe fijar contexto; es la regla a recordar al agregar
  código. Los interceptores cubren el camino normal; lo explícito queda en los
  caminos de sistema.
- El modo sistema es una capacidad deliberada, acotada a identidad y auditoría.
- El rendimiento no se degrada de forma perceptible (las políticas son
  comparaciones por índice sobre `tenant_id`).

## Verificación

- `make smoke`: consulta sin contexto = 0 filas y con contexto > 0 en IAM, CRM y ERP.
- El humo comprueba además que el reuso de un token revoca la **familia completa**.
- `04-seguridad.md` §4 documenta las políticas vigentes.
