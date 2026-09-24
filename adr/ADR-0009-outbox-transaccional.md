# ADR-0009 — Outbox transaccional para la entrega de eventos

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada (Fase 1) |
| Relacionada | ADR-0005 (eventos con RabbitMQ) |

## Contexto

La venta se confirmaba en PostgreSQL y **después** se publicaba `sale.created` en
RabbitMQ. Entre el `commit` y la publicación existe una ventana en la que el
proceso puede morir: la venta ya se cobró al cliente, pero el evento se pierde y
el tablero jamás se entera. Es el único punto del sistema donde se podía perder
un dato que el usuario ya confirmó.

Publicar antes del `commit` tampoco sirve: un rollback dejaría un evento de una
venta que no ocurrió.

## Decisión

Patrón **transactional outbox**:

1. La venta y su evento se guardan en la **misma transacción**: `Sales.insert_sale`
   inserta el sobre completo en `outbox_events` (`PENDING`) antes del `commit`.
   Si la transacción se revierte, el evento desaparece con ella.
2. Un **publicador de barrido** (`KuboErp.Events.Publisher`) toma lotes con
   `FOR UPDATE SKIP LOCKED` —seguro con varias instancias del ERP— y los entrega
   a RabbitMQ. Una venta lo despierta (`kick/0`); además barre cada 500 ms.
3. Entrega **al-menos-una-vez**: si el proceso muere después de publicar y antes
   de marcar la fila, el evento se reentrega. Los consumidores ya deduplican por
   `event_id` (índice único en MongoDB).
4. Reintentos con espera exponencial (2, 4, 8… hasta 300 s). Tras 10 intentos el
   evento queda `FAILED`, visible en la sonda de salud: un evento que no se puede
   entregar es un incidente, no un detalle.
5. La conexión AMQP se **monitorea** (`Process.monitor`): si el bus cae, el
   publicador vuelve a estado desconectado y los eventos esperan en la bandeja.

## Alternativas descartadas

| Alternativa | Por qué no |
| --- | --- |
| Reintentos en memoria tras el fallo de publicación | No sobreviven a la muerte del proceso: la ventana seguía abierta |
| Transacción distribuida (2PC/XA) con el broker | Complejidad alta y soporte limitado en los cuatro lenguajes |
| CDC (Debezium) sobre el WAL | Una pieza más de infraestructura para el mismo resultado |

## Consecuencias

- **Positivas**: cero pérdida de eventos confirmados; la caja nunca depende del
  bus; el tablero se recupera solo tras una caída; trazabilidad de reintentos.
- **Negativas**: tabla operativa que crece (requiere política de purga en Fase 2);
  entrega duplicada posible, asumida por consumidores idempotentes.
- `outbox_events` queda fuera de RLS: es una tabla operativa que el publicador lee
  cruzando negocios para entregar los eventos.

## Verificación

- `make bus-drill` (4/4): con RabbitMQ detenido la venta se registra, el evento
  queda `PENDING`, y al volver el bus se publica y llega a analítica.
- `make smoke`: el evento de la venta queda en la bandeja y se publica.
- La sonda de salud del ERP expone `outbox: {pending, published, failed}`.
