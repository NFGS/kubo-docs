# ADR-0017 — Puerto de notificaciones y buzón del negocio

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada (Fase 4) |
| Relacionada | ADR-0009 (outbox transaccional) · ADR-0014 (puerto de facturación) |

## Contexto

El plan de cierre (P-19 · P-25) pide notificaciones (WhatsApp/correo) y un
servicio de Documentos. La parte difícil no es enviar: es **no acoplar el
núcleo** a un proveedor —WhatsApp Business, SMTP, un agregador— ni a su
disponibilidad. Una venta no puede fallar porque la pasarela de mensajes esté
caída, y cambiar de proveedor no debe tocar la venta.

Además, el negocio necesita **enterarse**: que el sistema avise «se está
agotando el arroz» o «entró una compra» es más útil que un panel que hay que
recordar mirar.

## Decisión

1. **Puerto** (`KuboErp.Notifications`): el núcleo dice *qué* pasó; el
   adaptador decide *cómo* se entrega (`deliver/1`). El adaptador por defecto
   (`Log`) escribe en el **buzón del negocio** (`notifications`): sirve de
   demostración, de auditoría de lo enviado y de punto de partida para un
   proveedor real.
2. **El buzón es una tabla de negocio**: `notifications` (tenant, tipo, canal,
   destinatario, asunto, cuerpo, estado, referencia, fecha de envío) con RLS
   `FORCE`, como el resto. La PWA puede leerlo (`GET /notifications`).
3. **La notificación viaja en la transacción que la provoca**: si la venta se
   revierte, el aviso desaparece con ella. Nunca se avisa de algo que no pasó.
4. **Aviso de stock bajo con histéresis**: se notifica cuando el producto
   **cruza** el mínimo (`antes > mínimo` y `después <= mínimo`), no en cada venta
   por debajo. Sin esa regla, un producto agotado genera un aviso por venta y el
   buzón se vuelve ruido que nadie lee.
5. **Configurable**: `KUBO_NOTIFICATIONS_ADAPTER` (por defecto, el buzón). Un
   adaptador de WhatsApp o de correo implementa el mismo contrato.

## Consecuencias

- **Positivas**: el núcleo no conoce al proveedor ni depende de su
  disponibilidad; el buzón deja rastro auditable y es aislado por negocio;
  añadir un canal es escribir un adaptador.
- **Negativas**: el adaptador por defecto **no entrega nada fuera del
  sistema** —es una demostración, no un canal real— y el plan lo declara. Los
  envíos reales necesitarán reintentos y una cola: hoy la notificación se
  escribe en la transacción, así que un proveedor lento bloquearía la venta;
  cuando se enchufe uno real, el camino correcto es encolar el aviso (la
  bandeja de salida ya existe, ADR-0009) y entregarlo en segundo plano.

## Verificación

- `make smoke` (**139/139**): una venta que cruza el mínimo deja un aviso
  `LOW_STOCK` en el buzón con las unidades restantes en el cuerpo.
- `kubo-erp` integración: la notificación se escribe en la misma transacción que
  la venta y respeta RLS.
- `make contracts` (**19/19**): `NotificationList` validado contra la API viva.
- **Pendiente del paso**: adaptador real de WhatsApp/SMTP, notificaciones de
  compra y de resumen diario, buzón en la PWA y el servicio de Documentos
  (P-25).
