# 14 — Plan de la app móvil (Capacitor)

| Campo | Valor |
| --- | --- |
| Estado | **En ejecución** — activado por decisión del propietario (2026-10-07): vitrina móvil + preparación para clientes. Fase 0 completada; Fase 1 (envoltura Android) en curso |
| Decisión marco | [ADR-0023](adr/ADR-0023-app-movil.md): la PWA primero; Capacitor antes que reescribir |
| Disparadores | Cámara/código de barras · Notificaciones push · Biometría para el 2FA · Impresión térmica Bluetooth |
| Esfuerzo estimado | ~20–30 días hábiles de desarrollo + 1 semana de piloto (por tramos; cada fase deja valor) |
| Costo objetivo | $0 (APK directo; sin tiendas por defecto) |

## 1. Principios (heredados del ADR-0023)

1. **La PWA es la interfaz** mientras el navegador alcance: esto se activa con un
   caso real, no "porque sí".
2. **Capacitor antes que reescribir**: misma base de código (`kubo-web`), un solo
   contrato de API; nada de endpoints exclusivos (ADR-0011).
3. **La tienda no es requisito**: para un negocio autoalojado, el APK firmado
   desde su propio servidor es suficiente; publicar en Play/App Store es una
   decisión comercial posterior.
4. **Cada capacidad se encapsula**: los plugins viven detrás de interfaces
   propias para poder cambiarlos sin tocar el núcleo.
5. **iOS se difiere** hasta que un negocio lo pida y exista hardware Apple para
   firmar; la misma base lo habilitará.

## 2. Disparadores de activación (criterio de entrada)

| # | Disparador | Señal de negocio que lo justifica | Fase |
| --- | --- | --- | --- |
| D1 | Cámara y código de barras | Cargar inventario o vender escaneando (hoy: búsqueda manual) | 2a |
| D2 | Notificaciones push | El dueño no vive dentro del sistema; hoy revisa el buzón a mano | 2b |
| D3 | Biometría para el segundo factor | Fricción del TOTP con app externa (ADR-0015) en el día a día | 2c |
| D4 | Impresión térmica por Bluetooth | El POS necesita el ticket físico sin depender de impresora de red | 2d |

> Regla: **sin disparador documentado con un negocio real, el plan no arranca**
> (la Fase 0 exige esa evidencia).

## 3. Fases

### Fase 0 — Activación y alcance (1–2 días)

**Objetivo**: convertir el disparador en un alcance firmado.

- Documentar el caso real (qué negocio, qué flujo, qué duele hoy).
- Mini-ADR de las decisiones nuevas que aparezcan (p. ej. transporte de push en
  D2; estrategia de origen/sesión en WebView, §5).
- Modo de empaquetado elegido: **empaquetado** (activos locales + servidor
  configurable en el primer arranque), decisión en
  [ADR-0031](adr/ADR-0031-empaquetado-movil.md); el modo remoto queda como
  plan B si la sesión nativa no resulta viable.
- Priorizar capacidades si hay más de una y fijar el tramo presupuestado.

**Criterios de aceptación**: caso real escrito · mini-ADR aceptado · alcance y
tramo aprobados.

**Estado: completada (2026-10-07)** — activación por decisión del propietario
(vitrina móvil + preparación para clientes); alcance del primer tramo: Fase 1
(envoltura Android).

### Fase 1 — Envoltura Capacitor, Android primero (3–4 días)

**Objetivo**: la PWA corriendo como app Android firmada, sin tocar el contrato.

- Añadir Capacitor al repositorio `kubo-web` (proyecto `android/`; sin bifurcar
  el código).
- Validar plugins y versiones vigentes al activar (documentación actualizada,
  p. ej. con `context7`).
- Prueba temprana de sesión en dispositivo: cookie de refresco httpOnly
  (ADR-0007/0015) y origen del WebView; el ajuste es de configuración, **el
  contrato no cambia**.
- Build de depuración y **APK firmado de prueba**; keystore creado y respaldado
  cifrado desde este día (regla: sin keystore no hay actualización).
- Job de CI `android` (GitHub Actions + SDK de Android) que produce el APK por
  tag.
- Iconos, pantalla de arranque, safe areas y botón atrás.

**Criterios**: ingreso + POS + cola offline funcionan en el binario; APK
instalable en un equipo real; E2E móvil inicial con **Maestro** (OSS) cubriendo
ingreso y venta offline; contrato OpenAPI validado igual que hoy (verificación
del ADR-0023).

**Estado: avanzada (2026-10-07)** — proyecto Android + APK en CI + modo nativo
+ **prueba de sesión en emulador (Maestro) en verde**: primer arranque,
conexión a la demo, ingreso real y restauración de la sesión por cookie tras
relanzar. Pendiente del tramo: venta de POS y cola offline en el binario
(criterios de la fase) e instalación en un equipo físico (opcional).

### Fase 2 — Capacidades nativas, por prioridad

#### 2a — Cámara y código de barras (3–4 días)

- Escaneo en alta de producto (inventario) y en el POS (agregar al carrito).
- Permisos con degradación limpia (sin permiso, la app sigue usable).

**Criterios**: EAN-13/Code128 → carrito en < 2 s; sin red la venta se encola
igual; sin permiso no se bloquea la app.

#### 2b — Notificaciones push (3–5 días)

- Extender el **puerto de notificaciones (ADR-0017)** con un canal push detrás de
  una interfaz; el buzón in-app sigue siendo la fuente de verdad.
- Implementación Android (FCM) y **alternativa OSS (ntfy/UnifiedPush) evaluada**
  en el mini-ADR de F0 — decisión explícita por el costo de la dependencia.
- Opt-in por usuario; sin tokens en logs; revocación al cerrar sesión del
  dispositivo.

**Criterios**: venta sincronizada, stock bajo y factura lista llegan como push;
si no hay permiso, todo sigue en el buzón; apagar la capacidad no deja rastro.

#### 2c — Biometría para el segundo factor (2–3 días)

- **Primero un spike de WebAuthn/passkeys**: puede resolver el disparador **sin
  envoltura** (funciona en la PWA); si no alcanza, plugin biométrico nativo.
- Secreto TOTP (ADR-0015) en Keystore si es nativo; nunca fuera del dispositivo.

**Criterios**: segundo factor con huella en < 2 s; desactivación limpia; el
secreto no sale del almacén seguro.

#### 2d — Impresión térmica Bluetooth (3–5 días)

- ESC/POS por BLE desde el POS (impresoras 58 mm genéricas); perfil de equipos
  objetivo definido en F0.

**Criterios**: ticket impreso ≤ 5 s; reconexión tras pausa; "sin impresora" no
bloquea la venta (fallback).

### Fase 3 — Calidad y verificación móvil (3–4 días)

- Matriz de dispositivos: 2–3 equipos Android de gama baja reales (o emuladores
  equivalentes); mínimo Android 10.
- E2E móvil (Maestro) en CI con emulador; humo del binario contra el sistema
  real.
- Accesibilidad (TalkBack), rendimiento de listas largas, tamaño del APK.
- Seguridad móvil: checklist MASVS-lite (almacenamiento, red solo HTTPS, sin
  secretos en el binario, permisos mínimos).

**Criterios**: E2E móvil verde en CI · checklist sin hallazgos altos · APK
razonable (< ~20 MB).

### Fase 4 — Distribución y operación (2–3 días)

- Versionado alineado con el producto (tag `vX.Y.Z`); APK adjunto al release de
  GitHub.
- Descarga para el negocio: página autenticada del operador o instrucciones del
  runbook.
- Runbook móvil: instalar, actualizar, perder el equipo (revocar sesión),
  desinstalar.
- Actualización: APK manual por ahora; evaluar Play (internal testing) solo si
  un negocio lo pide.

**Criterios**: un negocio instala el APK desde su servidor en ≤ 10 min siguiendo
el runbook; la revocación de sesión del dispositivo funciona.

### Fase 5 — Piloto con negocio real y cierre (1 semana calendario)

- Piloto con un negocio (uso real ≥ 5 días); métricas: adopción, ventas desde
  móvil, incidencias.
- Retrospectiva y decisión: cerrar, iterar o pausar; actualizar este plan y (si
  cambia la decisión) el ADR-0023.

**Criterios**: piloto documentado con feedback · decisión firmada.

## 4. Estimación

| Fase | Esfuerzo | Deja valor por sí sola |
| --- | --- | --- |
| 0 — Activación | 1–2 d | Alcance firmado + mini-ADRs |
| 1 — Envoltura | 3–4 d | APK firmado con sesión y offline |
| 2a — Cámara | 3–4 d | Inventario y POS por escaneo |
| 2b — Push | 3–5 d | Avisos fuera del sistema |
| 2c — Biometría | 2–3 d | 2FA sin fricción |
| 2d — Impresión | 3–5 d | Ticket físico |
| 3 — Calidad | 3–4 d | Confianza de release |
| 4 — Distribución | 2–3 d | Instalación por el negocio |
| 5 — Piloto | 1 semana | Decisión con evidencia |
| **Total** | **~20–30 d hábiles + piloto** | Ejecutable por tramos |

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Sesión por cookie en WebView (origen distinto) | Prueba temprana en Fase 1; estrategia de origen elegida en F0; el contrato no cambia |
| Fragmentación de WebView/permisos | Matriz de gama baja (F3) + mínimos soportados documentados |
| Plugins comunitarios sin mantenimiento | Encapsulados tras interfaces propias + versiones fijadas |
| Push = dependencia de terceros | Puerto con interfaz + alternativa OSS evaluada (mini-ADR) |
| Pérdida del keystore de firma | Respaldo cifrado desde Fase 1; sin keystore no hay actualización |
| Scope creep ("ya que estamos…") | Cada capacidad con disparador y criterio; lo demás, backlog |
| iOS | Diferido hasta negocio + hardware Apple (misma base) |

## 6. Trazabilidad

- **ADR-0023** → disparadores D1–D4 y su verificación (E2E contra el binario).
- **ADR-0011** (BFF) → sin cambios de contrato; validado en F1 y F3.
- **ADR-0015** (TOTP) → Fase 2c · **ADR-0017** (puerto de notificaciones) → Fase 2b.
- **ADR-0007** (JWT/cookies) → prueba de sesión en Fase 1.
- Historias de usuario (INVEST) y criterios Gherkin por capacidad: se redactan
  al activar cada tramo (Fase 0).

## 7. Estado

- **Activación**: 2026-10-07, por decisión explícita del propietario (vitrina
  móvil + preparación para los primeros clientes; el primer objetivo de prueba
  es la demo pública). Los disparadores D1–D4 siguen ordenando las capacidades
  cuando existan negocios reales.
- **Avance**: Fase 0 completada (alcance + ADR-0031) · Fase 1 avanzada (APK en
  CI, modo nativo y sesión verificada en emulador; faltan POS/cola offline en
  el binario). La PWA cubre el caso móvil mientras tanto.
