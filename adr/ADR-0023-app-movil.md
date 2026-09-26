# ADR-0023 — App móvil: la PWA primero, Capacitor cuando el negocio lo pida

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada (Fase 5) |
| Relacionada | ADR-0011 (BFF) · ADR-0013 (vertical packs) |

## Contexto

El plan de cierre deja la app móvil nativa como backlog declarado. La PWA ya
resuelve buena parte del caso móvil: es instalable, funciona sin conexión (el
service worker encola ventas y sincroniza al reconectar, P-12) y pasa la
auditoría de accesibilidad. Un negocio de barrio vende desde el mismo equipo del
mostrador; el caso "móvil" realista es el celular del dueño para mirar el
tablero, o un vendedor en la calle con el catálogo.

Escribir una app nativa (Kotlin/Swift) significa mantener **dos** interfaces
sobre el mismo API: el doble de trabajo para la misma función.

## Decisión

1. **La PWA es la interfaz** mientras el negocio no pida capacidades que el
   navegador no dé. No se escribe una app nativa "porque sí": cada interfaz
   nueva es deuda de mantenimiento.
2. **Cuando haga falta, se envuelve la PWA con Capacitor** antes que reescribir:
   la misma base de código, empaquetada como app para Android/iOS, con acceso a
   las capacidades nativas que el navegador no expone. Criterios objetivos para
   dar el paso:
   - **Cámara y código de barras** para cargar inventario y vender.
   - **Notificaciones push** (además del buzón actual).
   - **Biometría** para el segundo factor (hoy TOTP con app externa, ADR-0015).
   - **Impresión térmica** por Bluetooth en el POS.
3. **El API no cambia**: la app (envuelta o nativa) consume el mismo gateway;
   nada de endpoints exclusivos que bifurquen el contrato.
4. **La tienda de aplicaciones no es un requisito del producto**: una app
   interna (distribución directa del APK) sirve a un negocio autoalojado; la
   publicación en las tiendas es una decisión comercial posterior.

## Consecuencias

- **Positivas**: cero trabajo hoy y una ruta de escape concreta y barata
  (Capacitor) cuando aparezca una necesidad real; el contrato del API y el BFF
  ya están preparados (ADR-0011); la cola offline de la PWA es reutilizable.
- **Negativas**: una PWA no tiene el rendimiento de una app nativa en listas
  largas ni el acceso a todos los periféricos; se acepta porque el caso de uso
  (catálogo de barrio, tablero, POS de mostrador) está cubierto. El segundo
  factor por biometría queda pendiente hasta que exista la app envuelta.

## Verificación

- Hoy: `make e2e` (Playwright + axe) sobre la PWA en viewport móvil y la cola
  offline verificada en el humo (una venta sin conexión se sincroniza).
- Al envolver con Capacitor (cuando se decida): la suite E2E debe correr contra
  el binario empaquetado y el contrato OpenAPI debe validarse igual que hoy.
