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
3. **El aviso se encola en la transacción que lo provoca** (`PENDING`): es una
   escritura local y rápida, así que un canal lento o caído no puede frenar ni
   revertir una venta. Si la operación se revierte, el aviso desaparece con ella.
   El **entregador** (`Notifications.Deliverer`) barre pendientes cada 5 s como
   proceso de sistema (marca `app.system`), entrega por el adaptador y anota el
   resultado: estado, intentos y último error. Tras 5 intentos queda `FAILED`
   para que un humano lo revise.
4. **Aviso de stock bajo con histéresis**: se notifica cuando el producto
   **cruza** el mínimo (`antes > mínimo` y `después <= mínimo`), no en cada venta
   por debajo. Sin esa regla, un producto agotado genera un aviso por venta y el
   buzón se vuelve ruido que nadie lee.
5. **Configurable**: `KUBO_NOTIFICATIONS_ADAPTER` (`log` por defecto, `smtp`
   para correo real con Swoosh y la familia `KUBO_SMTP_*` de IAM). Un adaptador
   de WhatsApp implementa el mismo contrato.

## Consecuencias

- **Positivas**: el núcleo no conoce al proveedor ni depende de su
  disponibilidad; el buzón deja rastro auditable y es aislado por negocio;
  añadir un canal es escribir un adaptador.
- **Negativas**: el adaptador por defecto **no entrega nada fuera del
  sistema** —es una demostración, no un canal real— y el plan lo declara. La
  entrega es de al-menos-una-vez: si el entregador muere tras enviar y antes de
  marcar, el aviso se reenvía (aceptable para un correo interno; un canal con
  costo por mensaje necesitaría idempotencia en el proveedor).

## Verificación

- `make smoke` (**146/146**): una venta que cruza el mínimo deja un aviso
  `LOW_STOCK` con las unidades restantes y el entregador lo marca **`SENT`** en
  segundo plano.
- `kubo-erp` integración **12/12**: el aviso nace `PENDING` y el barrido de
  sistema lo entrega; el adaptador SMTP se valida construyendo el correo (sin
  enviarlo).
- Buzón en la PWA con filtro por stock bajo; auditoría axe del E2E en verde.
- `kubo-erp` integración: la notificación se escribe en la misma transacción que
  la venta y respeta RLS.
- `make contracts` (**19/19**): `NotificationList` validado contra la API viva.
- **Pendiente del paso**: adaptador de WhatsApp, notificaciones de compra y de
  resumen diario, y soportes de compra como documentos (P-25).
