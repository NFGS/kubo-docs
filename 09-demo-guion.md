# 09 — Guion de demostración (video)

**Duración objetivo: 6 a 7 minutos.** La base visual
[`evidencia/demo-kubo.webm`](evidencia/demo-kubo.webm) (6:25) recorre el sistema
con un subtítulo por bloque: narra sobre ella, o graba tu propia pantalla
siguiendo los mismos bloques y tiempos.

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
> app móvil con su primera fase completada. Kubo corre en menos de dos gigas de
> memoria, se instala con un comando y está pensado para que un negocio de
> barrio digitalice sus ventas sin pagar suscripciones. Gracias."

---

## Si narras con tu propia pantalla (bloques extra)

Estos bloques no están en la base visual; sirven si grabas tu propia pantalla y
quieres profundizar (agregan ~2 minutos).

### Arquitectura

Muestra `kubo-docs/01-arquitectura.md` (o el diagrama renderizado).

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

### El cifrado en la base (terminal)

```bash
docker exec kubo-postgres psql -U kubo_root -d kubo_crm -c \
  "select name, left(document_number_encrypted, 28) as cifrado, left(document_number_bidx, 16) as indice from customers limit 3"
```

> "En la base de datos el documento no se puede leer, y a la vez se puede buscar
> por igualdad con el índice ciego."

---

## Frases de respaldo (por si algo falla en vivo)

| Situación | Qué decir |
| --- | --- |
| Un contenedor no responde | "Reviso la sonda de salud del servicio…" y ejecuta `make ps` |
| El tablero tarda | "La consistencia es eventual: el evento viaja por RabbitMQ" |
| Falla el modo offline | Muestra la cola en `IndexedDB` desde las herramientas del navegador |
| Falla la demo por completo | Ejecuta `make smoke` y muestra las 192 comprobaciones en verde |

## Evidencia complementaria

```bash
make smoke 2>&1 | tee evidencia-smoke.txt     # 192 comprobaciones end-to-end
docker compose -f kubo-infra/docker-compose.yml ps
docker stats --no-stream

# Regenerar la base visual y las capturas de la evidencia
make reset-demo
cd kubo-web && node ../kubo-docs/scripts/capturas-evidencia.mjs --video
```

La evidencia completa (capturas, comprobaciones y video) vive en
[`evidencia/`](evidencia/README.md).
