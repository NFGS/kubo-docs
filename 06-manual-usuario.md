# 06 — Manual de usuario

Guía para el dueño del negocio y sus vendedores. No requiere conocimientos
técnicos.

## 1. Ingresar

1. Abre el navegador en la dirección que te entregó el instalador
   (por ejemplo `http://192.168.1.50:3000`).
2. Escribe tu correo y contraseña.
3. Presiona **Ingresar**.

**Instala Kubo como aplicación** (recomendado): en el navegador busca el ícono
de instalar (o el menú ⋮ → *Instalar aplicación*). Queda un acceso directo como
cualquier otro programa y abre a pantalla completa.

> La primera vez recibirás el usuario administrador. Cámbialo apenas puedas.

## 2. El tablero

Es la primera pantalla y responde una pregunta: **¿cómo va el negocio hoy?**

| Indicador | Qué significa |
| --- | --- |
| **Ventas de hoy** | Cuánto se vendió hoy y cuántas transacciones |
| **Ingreso acumulado** | Total vendido desde que usas Kubo |
| **Ticket promedio** | Lo que gasta un cliente en promedio |
| **Unidades vendidas** | Cuántos productos salieron |
| **Ventas de los últimos 14 días** | La tendencia: ¿sube o baja? |
| **Medios de pago** | Cuánto entra en efectivo, tarjeta o transferencia |
| **Productos más vendidos** | En qué se está yendo la mercancía |
| **Últimas ventas** | El detalle reciente, venta por venta |

Si el local se queda sin internet, verás la etiqueta **Sin internet**: el
tablero muestra lo último que se sincronizó y puedes seguir vendiendo.

## 3. Vender (punto de venta)

1. Entra a **Vender**.
2. Toca los productos para agregarlos al carrito (usa el buscador si tienes
   muchos).
3. Ajusta cantidades con **+** y **−**.
4. Elige el **cliente** (o deja *Consumidor final*).
5. Elige el **medio de pago**: efectivo, tarjeta, transferencia o crédito.
6. Presiona **Cobrar**.

Lo que ocurre al cobrar:

- Se descuenta el inventario en el mismo instante.
- Se asigna un número de venta (V-000001, V-000002…).
- El tablero se actualiza solo, en segundos.

### Vender sin internet

Si se cae la conexión, Kubo **no te deja tirado**: la venta se guarda en el
navegador y aparece la etiqueta *«1 venta por sincronizar»*. Cuando vuelva la
conexión:

- La aplicación la envía automáticamente, o
- Presiona **Sincronizar** en la barra superior.

> Mientras no haya conexión no podrás consultar el stock más reciente de otros
> equipos, pero las ventas nunca se pierden.

## 4. Productos e inventario

En **Productos** ves el catálogo con precio, IVA y existencias.

- **Nuevo producto**: pide código (SKU), nombre, precio de venta, costo, tarifa
  de IVA y stock mínimo.
  - El **precio de venta es el precio final que paga el cliente** (con IVA
    incluido). Kubo desagrega el impuesto al facturar.
  - El **stock mínimo** dispara la alerta de reposición.
- **Ajustar inventario** (ícono de cajas): registra entradas por compra, salidas
  por merma o conteos físicos.

  | Tipo | Cuándo usarlo |
  | --- | --- |
  | **Entrada (compra)** | Llegó mercancía del proveedor |
  | **Salida (merma, consumo)** | Se dañó, se venció o se usó internamente |
  | **Fijar stock exacto** | Después de un conteo físico |

  Escribe siempre el **motivo**: queda en el kardex con fecha y usuario.

- **Archivar** (papelera): el producto deja de venderse pero su historia se
  conserva. Nunca se borra nada de verdad.

Cuando algo está en o por debajo del mínimo, aparece un aviso amarillo arriba:
es el momento de programar una compra.

## 5. Clientes

En **Clientes** está tu cartera.

- **Nuevo cliente**: nombre o razón social, documento (NIT o cédula), teléfono,
  correo, ciudad, dirección, etapa y cupo de crédito.
- **Etapas**: *Prospecto nuevo* → *En negociación* → *Cliente*. Sirve para saber
  a quién hay que llamar.
- El **documento y el teléfono se guardan cifrados**: si alguien se lleva una
  copia de la base de datos, no puede leerlos.
- En la lista solo se ven los últimos dígitos (`*******432`); el dato completo
  aparece al abrir el cliente.

> **Protección de datos**: Kubo guarda los datos personales únicamente para
> gestionar la relación comercial. Informa a tus clientes qué guardas y para
> qué, y atiende sus solicitudes de corrección o eliminación.

## 6. Preguntas frecuentes

**¿Necesito internet para vender?**
No. Solo para sincronizar; las ventas se guardan localmente.

**¿Puedo tener varias cajas al mismo tiempo?**
Sí. Cada equipo entra con su propio usuario. El stock se descuenta en el
servidor, así que dos cajas no pueden vender la misma unidad.

**¿Dónde están mis datos?**
En el equipo donde se instaló Kubo, no en la nube de terceros.

**¿Cuánto cuesta?**
El software es tuyo (licencia MIT). Solo pagas el equipo donde corre.

**Me equivoqué en una venta.**
Pídele al administrador que la **anule**: el inventario vuelve y queda registrada
la anulación (no se borra la historia).

**¿Puedo usar mi lector de código de barras?**
Sí, si escribe el código como texto. Escribe o escanea en el buscador del POS.

**Olvidé mi contraseña.**
En la pantalla de ingreso pulsa **«¿Olvidaste tu contraseña?»** y escribe tu
correo: recibirás un enlace para crear una nueva. El enlace vence en 30 minutos y
solo sirve una vez. Si el correo del servidor aún no está configurado, pídele al
administrador que la restablezca.

## 7. Buenas prácticas

1. **Registra el costo** de cada producto: es lo que permite saber tu margen.
2. **Haz un conteo físico** una vez al mes y ajusta el stock con el motivo
   *«Conteo físico»*: así el kardex cuenta la historia real.
3. **Usa las etapas de cliente**: es tu lista de trabajo comercial.
4. **Revisa el tablero cada mañana**: cinco segundos para saber cómo arrancó el día.
5. **No compartas el usuario administrador**: crea un usuario por vendedor.
