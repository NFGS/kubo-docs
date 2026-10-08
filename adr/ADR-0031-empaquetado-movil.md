# ADR-0031 — Empaquetado móvil: assets locales y servidor configurable en el primer arranque

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-07 |
| Estado | Aceptada e implementada (Fase 1 del plan 14) |
| Relacionada | ADR-0023 (app móvil) · ADR-0007 (JWT/cookies) · ADR-0011 (BFF) |

## Contexto

El plan [`14-plan-app-movil.md`](../14-plan-app-movil.md) activa la envoltura de
la PWA con Capacitor. Kubo es **autoalojado**: cada negocio tiene su propia URL
(el APK debería ser el mismo para todos), y el POS convive con el servidor en la
red local. La decisión clave de la Fase 0 es cómo sirve la app sus activos y
cómo llega al servidor de cada negocio sin tocar el contrato del API.

## Decisión

1. **Assets locales (modo empaquetado)**: la PWA se compila dentro del APK
   (`webDir: dist`); la app abre sin red desde el primer arranque.
2. **URL del servidor configurable en el primer arranque**: la app pide la URL
   del negocio (p. ej. `https://kubo-app.duckdns.org`), la guarda en el
   dispositivo y la usa como base de `/api`.
3. **HTTP nativo (CapacitorHttp) para el API**: evita CORS y conserva la cookie
   de refresco httpOnly (ADR-0007) **sin cambiar el contrato**; se valida en la
   prueba de sesión de la Fase 1. Si la cookie no sobreviviera en el puente
   nativo, se activa el plan B (modo remoto).
4. **Un solo binario por versión** (no builds por negocio): la configuración
   vive en el dispositivo, no en el build.
5. **La PWA no cambia su comportamiento**: los ajustes son aditivos y solo se
   activan en plataforma nativa (`Capacitor.isNativePlatform()`).

## Opciones consideradas

| Opción | Por qué no (o cuándo sí) |
| --- | --- |
| Modo remoto (`server.url` al servidor del negocio) | Un APK por negocio (URL estática en build) y el primer arranque sin red falla; queda como **plan B** si la sesión nativa no resulta viable |
| App nativa (Kotlin/Swift) | Reescribir la interfaz: doble mantenimiento (ADR-0023) |
| Tiendas como distribución | No requerido para autoalojado; decisión comercial posterior (ADR-0023) |

## Consecuencias

- **Positivas**: un APK para todos los negocios; offline desde el primer
  arranque; contrato intacto; el trabajo web es aditivo y testeable; la cola
  offline de la PWA se reutiliza tal cual.
- **Negativas**: la app necesita una pantalla de configuración inicial; el HTTP
  nativo debe validarse en dispositivo real (riesgo declarado, mitigado con la
  prueba temprana de la Fase 1).
- **Revisión**: al validar la sesión en dispositivo se confirma este ADR o se
  cambia al modo remoto mediante un mini-ADR.

## Verificación

- APK de depuración compilado en CI (job `android` de `kubo-web`) y artefacto
  subido por cada tag/ejecución manual.
- Fase 1 (siguiente tramo): ingreso + POS + cola offline funcionando en el
  binario; contrato OpenAPI validado igual que hoy (verificación del ADR-0023).

## Actualización — 2026-10-07 (prueba de sesión en emulador)

- La **prueba de sesión pasó en el emulador Android de CI** (Maestro, flujo
  `.maestro/sesion.yaml`): primer arranque, conexión a la demo, ingreso real y
  **restauración de la sesión por cookie tras relanzar la app** (cookie
  httpOnly a través del puente nativo).
- Dos hallazgos implementados en el camino: (1) en la app móvil el **service
  worker se desregistra** — interceptaba los GET y devolvía el `index.html`
  local; (2) las llamadas del API usan **`CapacitorHttp` directo**, porque el
  proxy del parche de `fetch` resultó frágil en el WebView (trataba el GET
  como documento y servía el `index.html`). El contrato no cambió.
- Queda como verificación opcional instalar el APK en un equipo físico del
  negocio (el APK se descarga del artefacto de CI o del release).

### Suite móvil completa (2026-10-07)

El job `Android` corre en cada push la suite `e2e-android/run-sesion.sh`
(cuatro flujos Maestro sobre el emulador): sesión con restauración por cookie,
**venta de POS con conexión**, **venta sin conexión a la cola local** (red
cortada y verificada con `ping` desde el propio emulador) y **sincronización
automática al reconectar** (la cola reintenta cada 30 s). Notas de operación:
el túnel público gratuito puede responder 502 en el primer cobro (la app
conserva el carrito y el flujo reintenta el cobro); y queda como backlog una
clave de idempotencia en las ventas del POS para que un reintento tras un
fallo ambiguo no pueda duplicar la venta.
