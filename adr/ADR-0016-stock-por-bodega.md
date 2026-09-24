# ADR-0016 — Stock por bodega y transferencias

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada (Fase 4) |
| Relacionada | ADR-0010 (RLS activo) · ADR-0013 (vertical packs) |

## Contexto

Hasta hoy el inventario del ERP es **un solo número por producto**
(`products.stock`), con el kardex (`stock_movements`) como historia. Eso alcanza
para una tienda con una trastienda, pero no para el negocio que creció: una
bodega y el local, dos locales, o el camión que reparte. El plan de cierre
(P-22) pide multi-bodega y transferencias.

El riesgo del cambio es que **todo el sistema lee `products.stock`**: el POS
valida existencias, el tablero cuenta stock bajo, los reportes valorizan el
inventario, el kardex calcula `stock_after`. Cambiar el modelo sin romper esas
lecturas es la restricción de diseño.

## Decisión

1. **`warehouses`** (por negocio, borrado lógico): una bodega es un lugar donde
   hay existencia. Exactamente **una por defecto** por negocio, garantizada con
   índice único parcial (`WHERE is_default AND deleted_at IS NULL`).
2. **`stock_levels` es la fuente de verdad por bodega**:
   `(tenant_id, warehouse_id, product_id, stock)` con índice único. Reemplaza a
   los movimientos como fuente de verdad (el kardex sigue siendo la **historia
   auditable**, no el saldo).
3. **`products.stock` se conserva como total denormalizado**, mantenido en la
   misma transacción. Es una decisión consciente: las lecturas existentes (POS,
   reportes, tablero, alertas) siguen funcionando sin cambios y el total es
   trivialmente consistente porque se escribe junto al detalle. Cuando el POS
   permita elegir bodega, la lectura por bodega saldrá de `stock_levels`.
4. **El kardex gana `warehouse_id`** (NOT NULL tras el backfill) y su índice de
   idempotencia pasa a incluir la bodega: una transferencia mueve el **mismo
   producto dos veces** con la misma referencia (sale de una bodega y entra en
   otra), y el índice anterior lo habría rechazado.
5. **Transferencia = par de movimientos atómicos**: `stock_transfers` +
   `stock_transfer_items`; al completarse, en **una sola transacción**, se
   descuenta el origen (`OUT`) y se suma el destino (`IN`), ambos con
   `reference_type = "TRANSFER"` y el id de la transferencia. Reglas: origen
   distinto del destino, cantidades positivas, producto con inventario y
   existencia suficiente en el origen. Si algo falla no se mueve nada.
6. **Venta, compra, ajuste e importación operan en la bodega por defecto**. El
   POS todavía no elige bodega: `Catalog.move_stock/3` recibe la bodega y
   resuelve la por defecto cuando no llega, en un solo punto.
7. **RLS `FORCE`** en `warehouses`, `stock_levels`, `stock_transfers` y
   `stock_transfer_items`, como el resto de tablas de negocio.

## Consecuencias

- **Positivas**: el inventario por bodega es real y auditable; las lecturas
  existentes no cambian; la transferencia es atómica por construcción; el
  negocio de una sola bodega no nota la diferencia (todo cae en la bodega por
  defecto).
- **Negativas**: hay **dos representaciones** del stock (el total del producto y
  el detalle por bodega) que deben escribirse juntas; se mitiga manteniéndolas
  en la misma transacción y con una prueba de integración que las compara. El
  total denormalizado deja de ser válido si alguien escribe `stock_levels` sin
  pasar por `Catalog`. El POS aún no permite elegir bodega ni hay mínimos por
  bodega: son los siguientes incrementos de P-22.

## Verificación

- `kubo-erp` integración **10/10** (PostgreSQL real): la transferencia mueve
  origen y destino y deja **dos movimientos** con la misma referencia (uno por
  bodega); sin existencia en el origen **no se mueve nada** (niveles intactos);
  el total del producto no cambia con la transferencia y sigue siendo la suma
  de las bodegas; la venta, la compra y el ajuste descuentan de la bodega por
  defecto.
- **Defectos reales corregidos durante la implementación**: el esquema del
  kardex no conocía `warehouse_id` (los movimientos fallaban con
  `not_null_violation`), el runner de pruebas montaba `lib/` y `config/` pero no
  `priv/` (las migraciones nuevas no se aplicaban) y la segunda pata de la
  transferencia usaba el producto **obsoleto**, inflando el total (10 → 14).
- **Siguiente incremento de P-22**: exponer bodegas y transferencias por el API
  (gateway + contrato), pantalla de bodegas/transferencias en la PWA, checks de
  humo y elección de bodega en el POS. La migración y el dominio ya quedaron
  cubiertos por las pruebas de integración.
