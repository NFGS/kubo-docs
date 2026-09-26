# ADR-0021 — Multi-tenant SaaS: modo de despliegue, no un producto aparte

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada (Fase 5) |
| Relacionada | ADR-0010 (RLS activo) · ADR-0012 (zona horaria por negocio) · ADR-0013 (vertical packs) |

## Contexto

Kubo nace **autoalojable**: cada negocio instala su copia y es dueño de sus
datos. La arquitectura ya es multi-negocio de forma nativa —RLS con `FORCE` en
las tres bases, cada petición con su `app.tenant_id`, y por negocio la zona
horaria, el vertical y los usuarios—, pero eso es aislamiento **técnico**, no un
modelo comercial: no hay planes, límites, suspensión ni facturación.

Ofrecer Kubo como SaaS (una instalación, muchos negocios) es tentador y
peligroso: si se bifurca el código, se mantienen dos productos. El plan de
cierre lo deja como backlog declarado justamente por eso.

## Decisión

1. **El SaaS es un MODO de despliegue del mismo producto**, no un fork: la
   misma imagen, la misma base de código. Lo que cambia es la operación (quién
   aprovisiona, quién paga, cuánto se permite), no la arquitectura.
2. **El plan es un dato del negocio** (`tenants.plan`, ya existente), con un
   catálogo declarativo —igual que los vertical packs (ADR-0013)— y viaja en el
   token como `tenant_plan`, de modo que cada servicio aplica sus límites sin
   consultar a IAM en cada petición.
3. **Los límites son del plan, no del código**: usuarios, bodegas, productos y
   almacenamiento. Se aplican como **límites suaves con aviso** (el servicio
   responde `PLAN_LIMIT_REACHED` con el límite y el uso) y nunca borrando datos:
   un negocio que creció no pierde nada por bajar de plan.
4. **La suspensión es un estado del negocio** (`tenants.status`): suspendido no
   puede iniciar sesión (`TENANT_SUSPENDED`), pero sus datos quedan intactos y
   exportables. La morosidad no puede convertirse en rehén de los datos.
5. **El cobro es un puerto** (como la facturación DIAN y las notificaciones):
   el producto registra el estado comercial y un adaptador lo sincroniza con la
   pasarela o con la cobranza manual. Para el mercado de barrio, el adaptador por
   defecto es **manual** (transferencia/Nequi y activación por el operador): la
   pasarela automática es un adaptador más, no un requisito del núcleo.
6. **Los datos del negocio son suyos**: exportación completa (documentos,
   catálogo, ventas) y borrado con confirmación explícita al terminar la
   relación; el operador no retiene copias más allá del respaldo.

## Consecuencias

- **Positivas**: un solo producto para autoalojado y SaaS; los límites y la
  suspensión no tocan el núcleo comercial (son datos + validaciones); el
  aislamiento ya está probado (RLS) y auditado.
- **Negativas**: el SaaS exige operación que el autoalojado no —aprovisionar,
  medir uso, cobrar, atender—; el plan viaja en el token, así que un cambio de
  plan aplica al siguiente refresco de sesión (aceptable: no es un dato
  transaccional). La facturación automática queda declarada como adaptador
  pendiente; hoy el ciclo es manual y así se documenta al cliente.

## Verificación

- `kubo-iam`: el plan viaja en el token; crear usuarios por encima del límite
  responde `PLAN_LIMIT_REACHED`; un negocio suspendido no inicia sesión
  (`TENANT_SUSPENDED`) y sus datos siguen consultables por el operador.
- `make smoke`: el negocio de la demo (plan `community`) mantiene sus límites y
  el catálogo de planes es consultable.
- **Pendiente declarado**: medir uso agregado, pasarela de pago automática y
  panel del operador (aprovisionar/suspender desde una interfaz).
