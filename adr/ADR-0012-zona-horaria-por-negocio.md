# ADR-0012 — Zona horaria por negocio

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada (Fase 4) |
| Relacionada | ADR-0007 (JWT RS256 con JWKS) · ADR-0011 (BFF del gateway) |

## Contexto

El defecto A-01 de la auditoría: el ERP calculaba el «día comercial» en UTC, así
que una venta de las 20:00 en Colombia aparecía en el día siguiente. Se corrigió
calculando en la zona del negocio, pero la zona quedó **fija por configuración**
(`KUBO_TIMEZONE`, valor por defecto `America/Bogota`). Kubo es un producto para
la región: un negocio en México, Ecuador o España no puede compartir la zona del
despliegue, y la fecha de cierre, los reportes y el comprobante deben hablar en
la hora del negocio, no en la del servidor.

La zona horaria es un atributo del **negocio**, no del despliegue: es el mismo
razonamiento que llevó el aislamiento a RLS (ADR-0010) en lugar de confiar en
que cada consulta recuerde filtrar.

## Decisión

La zona horaria vive en el negocio y viaja con la identidad, sin que el ERP
tenga que consultarla a IAM en cada petición:

1. **IAM es la fuente de verdad**: `tenants.timezone` (columna `NOT NULL` con
   valor por defecto `America/Bogota` y restricción de no vacío). El negocio
   nuevo nace con la zona por defecto; un cambio de zona es un cambio de datos,
   no de configuración.
2. **Viaja en el token**: `TokenService` agrega el claim `tenant_timezone` al
   token de acceso. El ERP no conoce la tabla `tenants` (database-per-service):
   el claim es la forma de que reciba el dato sin acoplarse a IAM.
3. **El gateway la propaga**: `auth.middleware.ts` añade `x-tenant-timezone` a
   las cabeceras de identidad. Como el resto, la cabecera que envíe el cliente
   se **borra primero** y se reescribe con el valor verificado del token: nadie
   puede cambiar su día comercial para falsear un cierre.
4. **El ERP la aplica con respaldo**: el plug `Identity` valida el nombre contra
   la base de zonas (`tzdata`) y rechaza con 400 `INVALID_TIMEZONE` una zona
   desconocida —una zona inválida no debe degradar el cálculo a UTC en silencio—.
   `Sales.stats/2` y `Reports.sales_csv/3` reciben la zona de la petición y, si
   no llega (llamada interna, publicador de eventos), usan el respaldo
   configurado.

## Consecuencias

- **Positivas**: el día comercial, los reportes y el comprobante son correctos
  para cualquier negocio de la región sin reconfigurar el despliegue; el dato
  viaja firmado (no es manipulable por el cliente); el ERP no consulta IAM en
  cada petición.
- **Negativas**: el token de acceso carga un dato más y un cambio de zona no
  aplica hasta el siguiente inicio de sesión (aceptable: la zona casi nunca
  cambia). El respaldo por configuración sigue existiendo y podría enmascarar
  un claim ausente en llamadas internas; por eso el camino de la petición
  siempre pasa la zona explícita.

## Verificación

- `make ci` → `kubo-iam`: prueba de que el token firmado incluye
  `tenant_timezone` con el valor del negocio.
- `kubo-gateway` (`npm test`): la cabecera `x-tenant-timezone` se reescribe con
  el valor del token y nunca conserva el del cliente.
- `kubo-erp` (integración con PostgreSQL real): `Sales.stats/2` respeta la zona
  recibida y `Sales.stats/1` cae al respaldo.
- `make smoke` (**109/109**): el ERP responde con la zona del negocio, honra una
  zona distinta recibida por cabecera y rechaza (400) una zona desconocida.
