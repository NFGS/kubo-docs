# ADR-0024 — Superficie del operador: script sobre la base, panel cuando haya rol

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada (Fase 5) |
| Relacionada | ADR-0021 (multi-tenant SaaS) · ADR-0015 (segundo factor) |

## Contexto

El corte SaaS (ADR-0021) dejó el estado comercial del negocio —plan, cupos y
suspensión— pero **sin forma de operarlo**: suspender un negocio por mora exigía
abrir `psql` y escribir el `UPDATE` a mano. El plan de cierre lo declara como
pendiente: «panel del operador (listar negocios, suspender/activar) con un
endpoint protegido».

Ese endpoint exige antes decidir **el rol de operador**: hoy todos los roles
(`OWNER`, `ADMIN`, `SELLER`, `ACCOUNTANT`, `VIEWER`) son **de un negocio**; el
operador de la plataforma está por encima de los negocios. Un rol así es la
credencial más poderosa del sistema: puede suspender a cualquier cliente y, si
se descuida, leer cualquier dato.

## Decisión

1. **Hoy: script de operación** (`kubo-infra/scripts/tenant-admin.sh`) contra la
   base de identidad: `list`, `suspend` y `activate` por slug o correo. El
   operador de un despliegue autoalojado (o del SaaS pequeño) ya tiene acceso al
   servidor; un script **no agrega superficie de ataque** y las acciones son
   raras (una mora, un abuso).
2. **La suspensión es reversible y no toca datos**: cambia `tenants.status`;
   el negocio no entra (`TENANT_SUSPENDED`) y todo lo demás queda intacto. El
   script imprime a quién afectó para que la acción quede en el registro de quien
   la ejecuta.
3. **El panel HTTP llega cuando haya rol de plataforma**, y ese rol tendrá su
   propio ADR con: ámbito separado (`/platform/*`, nunca `/tenants/me`), segundo
   factor **obligatorio** (ADR-0015), auditoría en tabla propia y un token con
   `platform: true` que el gateway valide. No se improvisa un rol omnipotente por
   comodidad.
4. **Ni el script ni el futuro panel pueden leer datos de negocio**: el script
   solo consulta `tenants` y `users` (identidad) y jamás las bases del CRM o del
   ERP; el aislamiento por RLS sigue siendo la garantía, no la buena voluntad del
   operador.

## Consecuencias

- **Positivas**: cero superficie nueva hoy; la suspensión queda verificada de
  extremo a extremo (humo); el día que haya varios operadores o soporte
  delegado, el ADR del rol acota el poder antes de construirlo.
- **Negativas**: el operador necesita acceso SSH al servidor (aceptable en
  autoalojado y en un SaaS pequeño; un SaaS con soporte delegado necesitará el
  panel y el rol, con las salvaguardas del punto 3). El script no valida reglas
  de negocio (por ejemplo, avisar al cliente antes de suspender): es una
  herramienta de operación, no un flujo comercial.

## Verificación

- `make smoke`: el negocio aislado se suspende con el script, su ingreso
  responde `TENANT_SUSPENDED` y al reactivarlo vuelve a entrar — el ciclo
  completo, no solo la unidad.
- El script lista plan, estado y usuarios activos de cada negocio (lo que el
  operador necesita para decidir).
