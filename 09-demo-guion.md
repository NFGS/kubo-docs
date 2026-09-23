# 09 — Guion de demostración (video)

**Duración objetivo: 6 a 7 minutos.** El guion está escrito para grabarse en una
sola toma, sin edición, con el sistema ya levantado.

## Preparación (antes de grabar)

```bash
cd "Documents/Proyectos de Programación/Kubo"
make foreign-stop        # libera RAM (detiene Dolibarr, Guacamole, Open Notebook)
make up                  # levanta los 8 contenedores
make seed                # carga catálogo, clientes y ventas de ejemplo
make smoke               # verifica 33 comprobaciones end-to-end
```

Deja abiertas estas ventanas:
1. Terminal en la carpeta del proyecto.
2. Navegador en `http://localhost:3000` (sin sesión iniciada).
3. Terminal secundaria para consultar PostgreSQL.
4. Explorador de archivos con la carpeta `Kubo/`.

---

## 1. Presentación (0:00 – 0:45)

> "Hola, soy [nombre], estudiante del Tecnólogo en Análisis y Desarrollo de
> Software. Este es **Kubo**, un ERP + CRM para pequeñas y medianas empresas que
> no tienen acceso a tecnología y no quieren pagar suscripciones mensuales.
> Se instala en el propio local, en un computador pequeño o en un servidor
> económico, y funciona incluso sin internet."

Muestra la terminal:

```bash
make up
```

> "Un solo comando levanta todo el sistema: cuatro microservicios, un API
> Gateway, la aplicación web y cuatro servicios de datos. Cada microservicio
> está escrito en un lenguaje distinto y tiene su propia base de datos."

---

## 2. Arquitectura (0:45 – 1:45)

Muestra `kubo-docs/01-arquitectura.md` (o el diagrama renderizado).

> "El navegador solo habla con el API Gateway. El gateway valida el token JWT
> contra el JWKS del servicio de identidad y enruta cada petición.
>
> - **kubo-iam** en Java con Spring Boot: identidad, roles y auditoría.
> - **kubo-crm** en Ruby on Rails: clientes, con los datos personales cifrados.
> - **kubo-erp** en Elixir con Phoenix: catálogo, inventario y ventas.
> - **kubo-analytics** en Python con FastAPI: el tablero, sobre MongoDB.
>
> El ERP publica un evento cuando se registra una venta, y analítica lo consume
> por RabbitMQ. La caja nunca espera al tablero."

Muestra la carpeta raíz con los 9 repositorios:

```bash
ls -d kubo-*/
```

> "Nueve repositorios: uno por cada parte del software, más la infraestructura y
> la documentación."

---

## 3. Inicio de sesión (1:45 – 2:15)

En el navegador, en `http://localhost:3000`:

1. Muestra la pantalla de ingreso con la marca.
2. Ingresa con `admin@kubo.local` / `Admin123!`.
3. Menciona: *"La contraseña se guarda con BCrypt y el token se firma con RSA."*

---

## 4. Tablero (2:15 – 3:00)

> "Este es el tablero del negocio. Todos estos indicadores vienen de MongoDB,
> construidos a partir de los eventos de venta: ventas de hoy, ingreso
> acumulado, ticket promedio, unidades vendidas, la serie de los últimos 14
> días, los productos más vendidos y los medios de pago."

Señala la tarjeta **Ventas de hoy** y la gráfica.

> "Hace un momento no había nada aquí; estos datos llegaron solos desde el ERP."

---

## 5. Clientes y cifrado (3:00 – 4:00)

1. Entra a **Clientes**.
2. Señala que el documento aparece enmascarado: `*******636`.
3. Abre un cliente y muestra que el detalle sí trae el documento completo.
4. En la terminal secundaria:

```bash
docker exec kubo-postgres psql -U kubo_root -d kubo_crm -c \
  "select name, left(document_number_encrypted, 28) as cifrado, left(document_number_bidx, 16) as indice from customers limit 3"
```

> "En la base de datos el documento no se puede leer: está cifrado con
> AES-256-GCM, que además detecta cualquier manipulación. La columna de al lado
> es un índice ciego con HMAC: permite buscar por documento exacto sin
> descifrarlo. En el listado mostramos solo los últimos dígitos."

---

## 6. Productos e inventario (4:00 – 4:30)

1. Entra a **Productos**: muestra precio, IVA, stock y la alerta de stock bajo.
2. Usa el botón de inventario en un producto y registra una entrada:

   Tipo: **Entrada (compra)**, cantidad `10`, motivo `Compra a proveedor`.

3. Menciona: *"Cada movimiento queda en el kardex con fecha, usuario y motivo."*

---

## 7. Venta en el POS (4:30 – 5:15)

1. Entra a **Vender**.
2. Busca un producto, agrégalo dos veces, agrega otro.
3. Selecciona el cliente *Panadería El Trigal* y el medio de pago *Efectivo*.
4. Muestra el total y el IVA incluido desagregado.
5. Presiona **Cobrar**.

> "La venta se registró como V-00000X. El inventario se descontó en la misma
> transacción y el evento ya viajó a analítica."

6. Vuelve al **Tablero**: el indicador de hoy ya cambió.

---

## 8. Funcionamiento sin internet (5:15 – 5:50)

1. En el navegador, activa el **modo avión** (o desconecta el Wi-Fi).
2. Señala la etiqueta **Sin internet** en la barra superior.
3. Registra otra venta en el POS.

> "Sin conexión la venta no se pierde: queda en una cola local del navegador."

4. Reactiva la conexión.

> "Al volver la conexión, Kubo la envía sola y el tablero se actualiza."

5. Muestra el botón **Sincronizar** o la etiqueta de pendientes desapareciendo.

---

## 9. Cierre (5:50 – 6:30)

Muestra la documentación:

```bash
ls kubo-docs/
```

> "La documentación incluye arquitectura con diagramas C4, modelo de datos,
> contrato de la API, seguridad, despliegue, plan de pruebas, matriz de
> trazabilidad y ocho decisiones de arquitectura registradas como ADR.
>
> Kubo se instala con un comando, corre en menos de 2 GB de memoria y está
> pensado para que un negocio de barrio digitalice sus ventas sin pagar
> suscripciones. Gracias."

---

## Frases de respaldo (por si algo falla en vivo)

| Situación | Qué decir |
| --- | --- |
| Un contenedor no responde | "Reviso la sonda de salud del servicio…" y ejecuta `make ps` |
| El tablero tarda | "La consistencia es eventual: el evento viaja por RabbitMQ" |
| Falla el modo offline | Muestra la cola en `IndexedDB` desde las herramientas del navegador |
| Falla la demo por completo | Ejecuta `make smoke` y muestra las 33 comprobaciones en verde |

## Evidencia complementaria

```bash
make smoke 2>&1 | tee evidencia-smoke.txt
docker compose -f kubo-infra/docker-compose.yml ps
docker stats --no-stream
```
