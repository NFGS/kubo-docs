# ADR-0013 — Vertical Packs: el vertical como dato del negocio

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada (Fase 4) |
| Relacionada | ADR-0012 (zona horaria por negocio) · ADR-0011 (BFF del gateway) |

## Contexto

Kubo nace para el comercio de barrio, pero «comercio» abarca negocios con
operaciones distintas: una tienda vende productos con inventario y código de
barras, un restaurante vende platillos y maneja mesas, un prestador de servicios
no tiene inventario y el agro trabaja con insumos y bodegas. El plan de cierre
(P-17) pide «dos verticales activables sin tocar el núcleo».

La tentación es bifurcar el producto (ramas por vertical, campos `if
restaurante` repartidos por el código). Eso convierte cada vertical nuevo en un
cambio del núcleo — exactamente lo que el criterio de aceptación prohíbe.

## Decisión

Un **vertical es un dato del negocio** y un **paquete de configuración** es
declarativo:

1. **El catálogo de paquetes vive en el ERP** (`KuboErp.Packs`): el ERP es el
   dueño del núcleo comercial. Cada paquete declara terminología
   (`product_label`, `product_label_plural`), impuesto por defecto, si lleva
   inventario y el flujo del punto de venta (`sale`, `table`).
2. **IAM guarda cuál tiene activo el negocio** (`tenants.vertical`, valor por
   defecto `retail`) y lo valida contra la lista de paquetes conocidos: es un
   contrato entre servicios, igual que los roles.
3. **Viaja con la identidad**: el vertical va en el token (`tenant_vertical`) y
   el gateway lo propaga como `x-tenant-vertical`, reescribiéndolo siempre con
   el valor verificado (mismo patrón que la zona horaria, ADR-0012).
4. **El núcleo no pregunta por el vertical**: el ERP resuelve el paquete en un
   único punto (`Packs.get/1`) y la PWA adapta etiquetas con un contexto
   (`usePack`). Añadir un vertical es agregar una entrada al catálogo, no tocar
   la venta, el kardex ni la caja.
5. **Un vertical desconocido cae al paquete por defecto con aviso**, a
   diferencia de la zona horaria (que se rechaza): el paquete solo afecta
   etiquetas y valores por defecto —no la integridad de los datos—, así que un
   token viejo no debe tumbar la operación. El cambio aplica al siguiente
   refresco de sesión, que la propia interfaz dispara al guardar.

## Consecuencias

- **Positivas**: activar un vertical es un `PATCH /tenants/me` y un refresco de
  token; el núcleo permanece igual para todos los negocios; la terminología
  deja de estar cableada en la interfaz.
- **Negativas**: la lista de verticales se conoce en dos servicios (IAM valida,
  ERP aplica) y debe mantenerse en sincronía; se acepta porque cambia muy poco y
  el desajuste degrada a etiquetas, no a datos. La siembra de arranque crea
  productos de ejemplo: un negocio real deberá editarlos o borrarlos, y por eso
  es una acción explícita del usuario (nunca automática al registrar).

## Verificación

- `kubo-iam`: prueba del claim `tenant_vertical` y de la validación
  (`INVALID_VERTICAL`) en el cambio de perfil del negocio.
- `kubo-gateway`: la cabecera `x-tenant-vertical` se reescribe con el valor del
  token, nunca con el del cliente.
- `kubo-erp`: prueba pura del catálogo (cuatro verticales con etiquetas propias
  y respaldo ante un vertical desconocido).
- `make smoke` (**120/120**): el catálogo ofrece los cuatro verticales, la demo
  arranca en `retail`, un vertical desconocido responde `INVALID_VERTICAL`, el
  cambio a `restaurantes` se refleja en el token nuevo (`Platillo`) y el
  comportamiento también cambia: un producto con `tracks_stock: false` se vende
  sin existencias, no deja kardex, la venta guarda la mesa y `POST /packs/apply`
  siembra el catálogo de arranque sin duplicar al repetirse.
- `make e2e`: la pantalla de configuración pasa la auditoría de accesibilidad.
