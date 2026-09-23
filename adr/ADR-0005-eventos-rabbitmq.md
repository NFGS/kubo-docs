# ADR-0005 — Eventos con RabbitMQ y publicador tolerante a fallos

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-23 |
| Estado | Aceptada (outbox diferido a fase 2) |

## Contexto

Cuando se registra una venta, varios procesos deben reaccionar: analítica
proyecta el indicador, notificaciones avisa al cliente, cartera actualiza el
saldo. Si el ERP llamara a cada uno por HTTP, una caída de analítica rompería la
venta y el acoplamiento crecería con cada consumidor nuevo.

## Decisión

1. El ERP publica **eventos de dominio** en el exchange de tipo *topic*
   `kubo.events`, con sobre estable y versionado (`sale.created` v1).
2. Los consumidores **deduplican por `event_id`**: analítica usa un índice único
   en MongoDB, de modo que una reentrega del broker no cuenta la venta dos veces.
3. Los mensajes que no se pueden procesar van a una **cola de mensajes muertos**
   (DLQ), nunca se pierden ni bloquean la cola principal.
4. **La venta nunca depende del bus**: la publicación es asíncrona y tolerante a
   fallos. Si RabbitMQ está caído, se registra la advertencia y el negocio sigue
   operando.

## Lo que queda pendiente y por qué

El patrón *transactional outbox* (guardar el evento en la misma transacción de la
venta y publicarlo después desde una tabla de salida) elimina la ventana en la
que un evento puede perderse si el proceso muere justo después del `commit`. En
el MVP se asume esa pérdida eventual y se documenta; la implementación del outbox
es el primer trabajo de la fase 2.

## Consecuencias

- **Positivas**: desacoplamiento real (analítica puede caer sin afectar la caja),
  reacción en segundos y camino abierto a nuevos consumidores sin tocar el ERP.
- **Negativas**: consistencia eventual (el tablero tarda milisegundos en
  reflejar la venta) y, en el MVP, posibilidad de perder un evento ante una
  caída en el instante exacto del `commit`.
- **Nota técnica**: se usa `amqp` 4.x; la serie 3.x depende de `rabbit_common`
  3.12, que no compila en Erlang/OTP 27.
