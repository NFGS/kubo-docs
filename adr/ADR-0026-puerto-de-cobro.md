# ADR-0026 — Puerto de cobro y pasarela de pago

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada e implementada (Fase 6) |
| Relacionada | ADR-0021 (multi-tenant SaaS) · ADR-0025 (rol de plataforma) |

## Contexto

El cobro es **manual** (ADR-0021): el negocio paga por transferencia o Nequi y el
operador registra el pago renovando la fecha (F6.2). Funciona para los primeros
clientes, pero no escala: cada renovación depende de que alguien mire quién
debe, y no hay rastro del pago más allá de una fecha.

Una pasarela automática (Wompi, MercadoPago o ePayco en Colombia) resuelve eso,
pero mete al producto en el negocio de los pagos: webhooks públicos, firmas,
idempotencia, conciliación. Como en la facturación DIAN y las notificaciones, la
decisión es **puerto + adaptador**, no acoplar el núcleo a un proveedor.

## Decisión

1. **Puerto de cobro en IAM** (`Payments`): `create_checkout(tenant, plan,
   ciclo)` devuelve el enlace/token de pago; `confirm(evento)` aplica el
   resultado. Adaptador por defecto: **manual** (el operador registra el pago,
   que es lo que hoy hace `renew`); un proveedor real implementa el mismo
   contrato.
2. **Los pagos son datos**: tabla `payment_intents` (negocio, plan, ciclo,
   monto, moneda, proveedor, referencia, estado `PENDING|PAID|FAILED|EXPIRED`,
   fecha). La renovación del plan se deriva del pago **pagado**, no de la buena
   voluntad: un pago manual también crea su intento (historia completa).
3. **Idempotencia por referencia del proveedor**: un webhook repetido (los
   proveedores reintentan) **no extiende dos veces** el plan. La clave es la
   transacción del proveedor, no el evento.
4. **Los webhooks son la fuente de verdad**, con **verificación de firma** y
   límite de tasa propio; el retorno del navegador solo muestra el estado (un
   usuario puede cerrar la pestaña antes de volver).
5. **La suspensión sigue siendo humana**: la pasarela registra pagos; el corte
   por mora lo decide el operador con la lista de vencidos delante (ADR-0024).
   Ningún webhook suspende un negocio en plena jornada.
6. **Los precios son datos del plan** (por moneda y ciclo), en el catálogo, no
   en el código.

## Consecuencias

- **Positivas**: cambiar de proveedor —o volver al cobro manual— es cambiar el
  adaptador; la historia de pagos queda auditada y conciliable; el núcleo no
  conoce la pasarela.
- **Negativas**: aparece un endpoint público de webhooks que hay que proteger
  (firma, tasa, idempotencia) y una conciliación que alguien debe mirar cuando un
  pago no cuadra. Los precios en varias monedas agregan una tabla que mantener.
  El adaptador por defecto sigue siendo manual: la pasarela es una mejora, no un
  requisito para operar.

## Verificación

- `kubo-iam`: un evento firmado válido marca el pago `PAID` y extiende la
  renovación; un evento repetido **no** la extiende otra vez; una firma inválida
  responde 401 y no toca nada.
- `make smoke` (F6.6 implementado): el negocio pide pagar (`POST
  /tenants/me/payments`) y el monto sale del catálogo; el webhook sin firma
  responde 401; el webhook firmado confirma el pago y extiende la vigencia; un
  reintento responde igual y **no** extiende otra vez; un monto distinto al de la
  intención se rechaza (`AMOUNT_MISMATCH`). 176/176.
- El panel del operador lista los pagos pendientes con el negocio y registra el
  pago manual (`POST /platform/payments/{id}/confirm`), que es el mismo camino
  que usa un proveedor: una sola historia de pagos.
