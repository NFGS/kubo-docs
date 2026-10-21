# 09 — Guion de demostración (video)

**Duración objetivo: 6 minutos 25 segundos de base visual + 3 minutos de
sustentación técnica (opcional).** La base visual
[`evidencia/demo-kubo.webm`](evidencia/demo-kubo.webm) (6:25) recorre el sistema
con un subtítulo por bloque: narra sobre ella, o graba tu propia pantalla
siguiendo los mismos bloques y tiempos.

| Campo | Valor |
| --- | --- |
| Versión del guion | 2.0 — aligned con la fase de cierre 0–6 y la Fase 1 móvil |
| Base visual | `evidencia/demo-kubo.webm` (6:25, 15 secciones) |
| Estado del producto | v0.3.0 · fases 0–6 completadas · 31 ADR · app Android en Fase 1 completada |
| Verificación vigente | humo **192/192** (reverificado en vivo) · `make ci` 13/13 · 246 pruebas de servicio · contratos 23/23 · E2E 5/5 · bus 4/4 · restauración 14/14 · móvil 4/4 |
| Duración total si narras todo | ≈ 9–10 minutos |

> **Qué cambió respecto de la versión anterior del guion.** (1) La Fase 1 de la
> app móvil **ya está completada** y verificada en emulador: el bloque 15 decía
> "primera fase completada" y hoy se puede mostrar el APK funcionando. (2) Se
> incorpora la **sustentación técnica** con los dos diagramas nuevos —mapa de
> arquitectura y stack, y la secuencia animada del outbox— que son el respaldo
> visual del diseño. (3) Se narran las capacidades operativas que ya existen y
> no se narraban: mTLS en la malla, trazas OpenTelemetry, operador de respaldos
> con simulacro de restauración, CI/CD, carga a 50 cajas, sincronización de 4
> entornos y demo pública 100 % open source. (4) Los conteos de pruebas se
> actualizaron a los vigentes.

## Preparación (antes de grabar)

```bash
cd "Documents/Proyectos de Programación/Kubo"
make foreign-stop        # libera RAM (detiene Dolibarr, Guacamole, Open Notebook)
make up                  # levanta los 12 contenedores
make smoke               # verifica 192 comprobaciones end-to-end
make reset-demo          # deja la demostración limpia y presentable (borra lo que deja el humo y recarga la semilla)
```

Deja abiertas estas ventanas:
1. Terminal en la carpeta del proyecto.
2. Navegador en `http://localhost:3000` (sin sesión iniciada).
3. Terminal secundaria para consultar PostgreSQL.
4. Explorador de archivos con la carpeta `Kubo/`.
5. (Opcional) Teléfono con el APK de Kubo instalado, si quieres mostrar la app
   Android (ver `kubo-docs/14-plan-app-movil.md`).
6. (Opcional) Un segundo monitor o pestaña con
   `kubo-docs/diagramas/arquitectura-stack.png` y
   `kubo-docs/diagramas/flujo-venta-outbox.webm` para la sustentación técnica.

> **Antes de grabar, confirma el estado real** (esto también te da material para
> preguntas del jurado):
>
> ```bash
> make ps                 # los 12 contenedores en healthy
> make ci                 # gate completo: 13/13
> make observability      # opcional: levanta Tempo + Grafana (Grafana en :3001)
> make sync-status        # el estado de los 4 entornos (local, GitHub, Notion, Obsidian)
> ```

---

## Bloque 1 · Ingreso (0:00 – 0:27)

*En pantalla: la pantalla de ingreso con la marca y sus beneficios.*

> "Hola, soy [nombre], estudiante del Tecnólogo en Análisis y Desarrollo de
> Software. Este es **Kubo**, un ERP + CRM para pequeñas y medianas empresas,
> que se instala en el propio local —en un computador pequeño o un servidor
> económico— y funciona incluso sin internet. Un solo comando levanta todo el
> sistema. Ingreso con la cuenta del administrador: la contraseña se guarda con
> BCrypt y la sesión se firma con RSA."

---

## Bloque 2 · Tablero (0:27 – 0:53)

*En pantalla: el tablero con KPIs, la serie de 14 días, los productos más
vendidos y los medios de pago.*

> "Este es el tablero: todos los indicadores vienen de MongoDB, construidos a
> partir de los eventos de venta que publica el ERP —ventas de hoy, ingreso
> acumulado, ticket promedio, la serie de los últimos catorce días, los
> productos más vendidos y los medios de pago—. El navegador solo habla con el
> API Gateway, que valida el token JWT y enruta cada petición a los
> microservicios. Hace un momento no había nada aquí: los datos llegaron solos."

---

## Bloque 3 · Clientes (0:53 – 1:18)

*En pantalla: el listado de clientes con documento y teléfono enmascarados.*

> "En Clientes, el documento y el teléfono aparecen enmascarados en el listado:
> solo se muestran los últimos dígitos. El CRM está escrito en Ruby on Rails y
> los datos personales están protegidos según la Ley 1581 de habeas data; cada
> consulta queda auditada."

---

## Bloque 4 · Detalle del cliente (1:18 – 1:43)

*En pantalla: el detalle de un cliente con documento y teléfono completos.*

> "Al abrir un cliente, el detalle sí trae el documento completo. En la base de
> datos no se puede leer: está cifrado con AES-256-GCM, que además detecta
> cualquier manipulación. La columna de al lado es un índice ciego con HMAC:
> permite buscar por documento exacto sin descifrarlo."

---

## Bloque 5 · Catálogo (1:43 – 2:08)

*En pantalla: el catálogo con precio, IVA, stock y alerta de stock bajo.*

> "En Productos está el catálogo, con precio, IVA, stock y alerta de stock
> bajo. El ERP está escrito en Elixir y cada movimiento queda en el kardex con
> fecha, usuario y motivo. El vertical del negocio cambia la terminología: una
> tienda ve Productos y un restaurante, Platillos."

---

## Bloque 6 · Compras (2:08 – 2:34)

*En pantalla: proveedores, registro de compras y últimas compras.*

> "En Compras se registran los proveedores y las entradas de mercancía: al
> recibir una compra, el inventario sube y el costo del producto se actualiza
> sin IVA. Si algo llega mal, la anulación revierte todo en la misma bodega."

---

## Bloque 7 · Caja (2:34 – 2:59)

*En pantalla: la caja del turno con apertura, ventas en efectivo y arqueo.*

> "En Caja se abre el turno, se registran las ventas en efectivo y al cerrar se
> hace el arqueo: el sistema muestra la diferencia entre lo contado y lo
> esperado, y todo queda en la auditoría."

---

## Bloque 8 · Bodegas (2:59 – 3:24)

*En pantalla: las bodegas del negocio y una transferencia entre locales.*

> "En Bodegas se mueve mercancía entre locales con una transferencia: el stock
> baja en una y sube en la otra, con su movimiento de kardex en ambas; el total
> del negocio no cambia."

---

## Bloque 9 · Punto de venta (3:24 – 3:49)

*En pantalla: el POS con un producto en el carrito, IVA desagregado y total.*

> "Este es el punto de venta. Busco un producto, lo agrego al carrito y el
> total aparece con el IVA desagregado. Al cobrar, la venta se registra en una
> sola transacción: el inventario se descuenta y el evento ya viajó a
> analítica."

---

## Bloque 10 · Sin conexión (3:49 – 4:15)

*En pantalla: «Sin internet» y la venta guardada en la cola local.*

> "Si se cae el internet, la caja no se detiene: la venta queda en una cola
> local del navegador y la barra avisa que hay ventas esperando sincronización.
> Nunca se pierde una venta."

---

## Bloque 11 · Sincronización (4:15 – 4:40)

*En pantalla: «En línea» y la cola vaciándose sola.*

> "Al volver la conexión, Kubo envía las ventas pendientes sola, en orden, y el
> tablero se actualiza. Los errores de negocio se descartan para no bloquear la
> cola; los de red se reintentan."

---

## Bloque 12 · Documentos (4:40 – 5:05)

*En pantalla: facturas electrónicas, nota crédito y comprobantes PDF con
descarga autenticada.*

> "En Documentos quedan las facturas electrónicas con su CUFE, las notas
> crédito, los comprobantes PDF y los soportes, todos con descarga
> autenticada. El adaptador de la DIAN es un puerto enchufable: se conecta un
> proveedor tecnológico sin tocar el núcleo."

---

## Bloque 13 · Notificaciones (5:05 – 5:30)

*En pantalla: el buzón del negocio con avisos de stock bajo, compras y resumen.*

> "El buzón del negocio avisa lo que hay que saber sin mirar el tablero: stock
> bajo, compras recibidas y el resumen del día. Las notificaciones salen por un
> puerto que admite correo o WhatsApp."

---

## Bloque 14 · Usuarios y roles (5:30 – 5:56)

*En pantalla: la gestión de usuarios y roles del negocio.*

> "En Usuarios, el propietario crea, edita y deshabilita cuentas y asigna
> roles —vendedor o propietario—; los permisos se aplican en todos los
> servicios. El segundo factor con aplicación autenticadora protege las
> acciones sensibles."

---

## Bloque 15 · Configuración y cierre (5:56 – 6:25)

*En pantalla: vertical, zona horaria, datos fiscales, plan y segundo factor.*

> "En Configuración se define el vertical, la zona horaria, los datos fiscales
> para la DIAN, el uso contra el plan y el segundo factor. La documentación
> incluye arquitectura con diagramas C4, modelo de datos, seguridad, despliegue,
> trazabilidad, treinta y una decisiones registradas como ADR y el plan de la
> app móvil. Kubo corre en cerca de un gigabyte de memoria repartido en doce
> contenedores, se instala con un comando y está pensado para que un negocio de
> barrio digitalice sus ventas sin pagar suscripciones. Gracias."

---

## Sustentación técnica (opcional, ~3 minutos)

> **Cuándo usarla.** Es la parte que responde "¿cómo está construido y por
> qué?" ante un jurado técnico. No está en la base visual: grábala con tu
> pantalla o muéstrala en vivo. Si el tiempo es corto, el bloque 15 + el bloque
> extra de arquitectura bastan.

### S1 · El mapa de arquitectura y el stack (≈1:20)

*Muestra `kubo-docs/diagramas/arquitectura-stack.png` (o el interactivo
`kubo-docs/diagramas/html/arquitectura-stack.html`, que trae vistas guiadas
por capa).*

> "Este es el mapa completo del sistema. Arriba, el cliente: una sola PWA en
> React 19 con Vite y Tailwind, que además se empaqueta como app Android con
> Capacitor —el mismo código, un solo binario por versión—. Sigue el borde:
> Caddy termina el HTTPS con HSTS y nginx sirve los activos y hace de proxy de
> `/api` hacia el gateway, de modo que todo es un solo origen y no hay CORS.
>
> En el centro, la puerta de entrada: `kubo-gateway` en TypeScript con NestJS.
> Es el único punto de entrada y aplica tres cosas: valida el JWT contra el
> JWKS del servicio de identidad, aplica límites de tasa con Redis y enruta.
> Detrás están los cinco servicios de aplicación, y deliberadamente cada uno
> está en un lenguaje distinto: **Java con Spring Boot** para identidad y
> auditoría, **Ruby con Rails** para clientes, **Elixir con Phoenix** para
> catálogo, inventario y ventas, y **Python con FastAPI** para analítica. No es
> arbitrario: cada servicio usa su ecosistema natural, y el dominio de ninguno
> conoce HTTP, la base de datos ni el bus —lo decide el ADR 0004—.
>
> Abajo, los cuatro almacenes: una instancia de PostgreSQL 17 con tres bases
> separadas —identidad, clientes y ERP—, MongoDB 8 para el modelo de lectura,
> Redis 7 para los límites y RabbitMQ 4 como bus de eventos. Y a la derecha, la
> plataforma: Docker Compose con doce contenedores, el collector de
> OpenTelemetry, Tempo y Grafana, el CI de GitHub Actions, las pruebas de carga
> con k6 y el operador de respaldos."

*Si te preguntan por el costo:* "En reposo el conjunto consume cerca de un
gigabyte: cabe en un VPS de seis a doce dólares al mes o en el mini-PC del
propio local, y no depende de ninguna nube."

### S2 · La venta y su outbox, en movimiento (≈1:00)

*Muestra `kubo-docs/diagramas/flujo-venta-outbox.webm` (6 s en bucle) o el
estático `flujo-venta-outbox.png`.*

> "Este diagrama es la respuesta al punto más difícil del diseño: cómo se
> registra una venta sin que la caja espere al tablero. La caja envía la venta
> al gateway, el gateway verifica la firma contra el JWKS de identidad y
> reenvía al ERP. Ahí empieza la parte importante: el ERP abre una transacción
> y escribe tres cosas —la venta, sus líneas y el movimiento de inventario— y
> en la *misma* transacción inserta el evento en una bandeja de salida, el
> *outbox*.
>
> Cuando la transacción confirma, el evento y la venta ya están garantizados
> juntos: es imposible vender sin registrar el evento. Después, y solo después,
> un publicador entrega el evento a RabbitMQ, la analítica lo consume y proyecta
> la venta en MongoDB. La caja recibió su respuesta 201 mucho antes de que
> eso ocurra.
>
> Esto es lo que hace que el sistema sea tolerante a fallos: si el bus se cae,
> el evento espera en la bandeja y se entrega cuando vuelve. La venta ya está
> confirmada y el negocio sigue vendiendo. Hay un simulacro automatizado que
> lo comprueba, `make bus-drill`, y da cuatro de cuatro."

*Si te preguntan por el modo sin conexión:* "El mismo patrón resuelve el
internet caído: la venta se guarda en una cola local del navegador y se
reintenta sola al volver la conexión."

### S3 · Qué respalda cada afirmación (≈0:40)

*Muestra la terminal con `make smoke` en verde.*

> "Nada de esto es una captura de pantalla bonita: cada afirmación tiene una
> prueba. La prueba de humo ejecuta ciento noventa y dos comprobaciones
> contra el sistema en ejecución, usando el API Gateway como un cliente real.
> A eso se suman las doscientos cuarenta y seis pruebas unitarias y de
> integración de los cinco servicios, veintitrés contratos OpenAPI validados
> contra la API viva, cinco pruebas de navegador con auditoría de
> accesibilidad, la carga a cincuenta cajas —ciento por ciento de ventas
> exitosas— y los simulacros de caída del bus y de restauración. Todo eso
> converge en un único gate, `make ci`, que es trece de trece."

---

## Bloques extra (si narras con tu propia pantalla)

Estos bloques no están en la base visual; sirven si grabas tu propia pantalla y
quieres profundizar (agregan ~2 minutos).

### La app Android (Fase 1 completada)

*Muestra el teléfono con el APK, o el emulador con la suite de Maestro.*

> "Esta es la misma PWA empaquetada con Capacitor. No reescribimos nada:
> primero se probó la PWA y solo cuando el negocio lo pidió se envolvió. La
> Fase 1 ya está completada y verificada: el APK se construye en el CI, la
> sesión funciona sobre la cookie httpOnly, y la suite móvil cubre el ingreso,
> la venta en el punto de venta, la cola sin conexión y la sincronización —
> cuatro de cuatro en verde en el emulador."

### Operación, escala y continuidad

*Muestra `make ps`, `docker stats --no-stream` y, si levantaste el perfil, el
panel de Grafana.*

> "Los doce contenedores se levantan con un comando y se vigilan con sondas de
> salud. Las trazas de los cinco servicios van por OpenTelemetry a Tempo y
> Grafana, que se activa con un perfil opcional. Entre los servicios hay mTLS:
> la malla exige certificado de cliente, así que un servicio comprometido no
> puede hablar con otro sin credencial. Los respaldos son automáticos y
> verificados: no basta con hacerlos, hay que restaurarlos, y por eso existe
> un simulacro de restauración cronometrado. Y el escalado es horizontal
> porque los servicios no tienen estado."

### Sincronización de cuatro entornos y demo pública

*Muestra `make sync-status` y, si la tienes abierta, la demo pública.*

> "La documentación no vive en un solo sitio: hay un comando que sincroniza
> los cuatro entornos —local, GitHub, Notion y Obsidian— y otro que detecta
> la deriva entre ellos. Y el sistema completo se puede exponer sin pagar
> nada: hay una demo pública que se levanta con un túnel cien por ciento open
> source, con licencia MIT en los nueve repositorios."

### El cifrado en la base (terminal)

```bash
docker exec kubo-postgres psql -U kubo_root -d kubo_crm -c \
  "select name, left(document_number_encrypted, 28) as cifrado, left(document_number_bidx, 16) as indice from customers limit 3"
```

> "En la base de datos el documento no se puede leer, y a la vez se puede buscar
> por igualdad con el índice ciego."

### La arquitectura en texto (si no quieres mostrar la imagen)

> "El navegador solo habla con el API Gateway. El gateway valida el token JWT
> contra el JWKS del servicio de identidad y enruta cada petición:
> **kubo-iam** en Java con Spring Boot —identidad, roles y auditoría—;
> **kubo-crm** en Ruby on Rails —clientes, con los datos personales cifrados—;
> **kubo-erp** en Elixir con Phoenix —catálogo, inventario y ventas—; y
> **kubo-analytics** en Python con FastAPI —el tablero, sobre MongoDB—.
> El ERP publica un evento cuando se registra una venta y analítica lo consume
> por RabbitMQ: la caja nunca espera al tablero."

Muestra la carpeta raíz con los 9 repositorios:

```bash
ls -d kubo-*/
```

> "Nueve repositorios: uno por cada parte del software, más la infraestructura y
> la documentación. El acceso por HTTPS lo termina Caddy y el token de sesión
> vive en una cookie que el navegador no puede leer."

---

## Frases de respaldo (por si algo falla en vivo)

| Situación | Qué decir |
| --- | --- |
| Un contenedor no responde | "Reviso la sonda de salud del servicio…" y ejecuta `make ps` |
| El tablero tarda | "La consistencia es eventual: el evento viaja por RabbitMQ" |
| Falla el modo offline | Muestra la cola en `IndexedDB` desde las herramientas del navegador |
| Falla la demo por completo | Ejecuta `make smoke` y muestra las 192 comprobaciones en verde |
| No hay red para el túnel de la demo | "La demo pública es opcional; el sistema corre igual en el local" |
| Te preguntan por el costo de operación | "Cerca de 1 GB en reposo: cabe en un VPS de 6 a 12 USD al mes" |
| Te preguntan qué pasa si el bus se cae | "El evento espera en el outbox y se entrega al volver; `make bus-drill` lo verifica" |
| Te preguntan por la disponibilidad de los datos | "Cada negocio ve solo lo suyo: RLS activo en las tres bases de PostgreSQL" |

## Evidencia complementaria

```bash
make smoke 2>&1 | tee evidencia-smoke.txt     # 192 comprobaciones end-to-end
make ci                                       # gate completo (13 verificaciones)
docker compose -f kubo-infra/docker-compose.yml ps
docker stats --no-stream
make observability                            # opcional: Tempo + Grafana en :3001
make sync-status                              # estado de los 4 entornos
make bus-drill                                # 4/4: caída del bus sin perder eventos
make restore-drill                            # 14/14: restauración cronometrada
make load                                     # 50 cajas, p95 < 300 ms

# Regenerar la base visual y las capturas de la evidencia
make reset-demo
cd kubo-web && node ../kubo-docs/scripts/capturas-evidencia.mjs --video
```

La evidencia completa (capturas, comprobaciones y video) vive en
[`evidencia/`](evidencia/README.md).

## Los diagramas de la sustentación

| Archivo | Qué muestra | Formato |
| --- | --- | --- |
| `diagramas/arquitectura-stack.png` | Mapa de arquitectura y stack tecnológico | PNG + SVG |
| `diagramas/flujo-venta-outbox.png` | Secuencia de la venta con el outbox transaccional | PNG + SVG |
| `diagramas/flujo-venta-outbox.webm` | La misma secuencia en movimiento (traza animada de 6 s) | WebM |
| `diagramas/html/arquitectura-stack.html` | Mapa interactivo: vistas guiadas por capa, modo claro/oscuro | HTML |
| `diagramas/html/flujo-venta-outbox.html` | Secuencia interactiva con animación encendida/pausada | HTML |

Los HTML son autocontenidos (funcionan sin conexión) y los PNG/SVG/WebM son sus
exportaciones, de modo que la imagen y el vídeo no pueden divergir.
