# 03 — API

Todas las peticiones entran por el **API Gateway** (`http://localhost:9080` en
desarrollo). El gateway valida el JWT, aplica límites de tasa y enruta al
servicio correspondiente. Ningún servicio de negocio está expuesto directamente.

- **Base**: `/api/v1`
- **Formato**: JSON UTF-8
- **Autenticación**: `Authorization: Bearer <access token>`
- **Trazabilidad**: cabecera `X-Correlation-Id` (si no llega, el gateway la crea)

## 1. Rutas públicas y protegidas

| Ruta | Acceso |
| --- | --- |
| `GET /api/v1/health` | Público (lo atiende el gateway) |
| `POST /api/v1/auth/login` | Público |
| `POST /api/v1/auth/register` | Público |
| `POST /api/v1/auth/refresh` | Público (cookie de refresco) |
| `POST /api/v1/auth/logout` | Público (cookie de refresco) |
| `POST /api/v1/auth/forgot-password` | Público |
| `POST /api/v1/auth/reset-password` | Público |
| `GET /api/v1/auth/.well-known/jwks.json` | Público |
| Todo lo demás | Requiere `Bearer` válido |

## 2. Enrutamiento

| Prefijo | Servicio |
| --- | --- |
| `/api/v1/auth`, `/api/v1/users`, `/api/v1/audit` | `kubo-iam` |
| `/api/v1/customers` | `kubo-crm` |
| `/api/v1/products`, `/api/v1/sales`, `/api/v1/stock` | `kubo-erp` |
| `/api/v1/dashboard`, `/api/v1/events` | `kubo-analytics` |

## 3. Identidad (`kubo-iam`)

### `POST /auth/register`

Crea un negocio y su usuario propietario.

```bash
curl -X POST http://localhost:9080/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "tenantName": "Tienda La Esquina",
    "fullName": "Administrador",
    "email": "admin@kubo.local",
    "password": "Admin123!"
  }'
```

### `POST /auth/login`

```bash
curl -X POST http://localhost:9080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@kubo.local","password":"Admin123!"}'
```

Respuesta:

```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6...",
  "tokenType": "Bearer",
  "expiresInSeconds": 900,
  "user": {
    "id": "…", "email": "admin@kubo.local", "fullName": "Administrador Kubo",
    "role": "OWNER", "tenantId": "…", "tenantName": "Tienda La Esquina"
  }
}
```

El **access token** dura 15 minutos y se firma con RS256. El **refresh token**
dura 7 días, se guarda hasheado y **rota en cada uso**; reutilizar uno revocado
invalida toda la familia de tokens del usuario. El gateway (BFF) lo entrega en una
**cookie `httpOnly` + `SameSite=Strict`** (`Path=/api/v1/auth`) y **nunca** aparece
en el cuerpo de la respuesta: un XSS no puede robarlo.

### `POST /auth/forgot-password`

Solicita el enlace de recuperación. Responde siempre `204`, exista o no la cuenta
(no permite enumerar usuarios).

```bash
curl -X POST http://localhost:9080/api/v1/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@kubo.local"}'
```

Con `KUBO_MAIL_TRANSPORT=log` (demostración) el correo queda en la tabla
`mail_outbox`; con `smtp` sale por el servidor configurado.

### `POST /auth/reset-password`

Consume el token del enlace (un solo uso, vence en 30 minutos) y cambia la
contraseña; además revoca todas las sesiones y levanta el bloqueo por intentos.

```bash
curl -X POST http://localhost:9080/api/v1/auth/reset-password \
  -H 'Content-Type: application/json' \
  -d '{"token":"<token del enlace>","newPassword":"NuevaClave123!"}'
```

### `GET /auth/me`

Devuelve el perfil del usuario autenticado.

### `GET /auth/.well-known/jwks.json`

Llave pública RSA que el gateway usa para verificar firmas.

## 4. Clientes (`kubo-crm`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/customers?q=&stage=` | Listado (documento y teléfono **enmascarados**) |
| GET | `/customers/{id}` | Detalle (valores descifrados) |
| GET | `/customers/by-document/{documento}` | Búsqueda exacta por documento (índice ciego) |
| POST | `/customers` | Crear |
| PATCH | `/customers/{id}` | Actualizar |
| DELETE | `/customers/{id}` | Borrado lógico |
| GET | `/customers/stats` | Conteos por etapa y cartera |

```bash
TOKEN=$(curl -s -X POST http://localhost:9080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@kubo.local","password":"Admin123!"}' | jq -r .accessToken)

curl -X POST http://localhost:9080/api/v1/customers \
  -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' \
  -d '{"name":"Panadería El Trigal","document_number":"900123456-7",
       "phone":"3105551234","city":"Armenia","stage":"CUSTOMER"}'
```

## 5. Catálogo, inventario y ventas (`kubo-erp`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/products?q=&low_stock=` | Catálogo |
| POST | `/products` | Crear producto |
| PATCH | `/products/{id}` | Actualizar |
| DELETE | `/products/{id}` | Borrado lógico |
| GET | `/products/stats` | Totales y valor del inventario |
| POST | `/products/{id}/stock` | Movimiento de inventario |
| GET | `/stock/movements?product_id=` | Kardex |
| GET | `/sales?status=` | Ventas |
| POST | `/sales` | Registrar venta |
| GET | `/sales/{id}` | Detalle |
| POST | `/sales/{id}/void` | Anular venta (devuelve inventario) |
| GET | `/sales/stats` | Totales del día |
| GET | `/suppliers?q=&active=` | Proveedores (paginado) |
| POST | `/suppliers` | Crear proveedor |
| PATCH | `/suppliers/{id}` | Actualizar proveedor |
| DELETE | `/suppliers/{id}` | Borrado lógico |
| GET | `/purchases?status=&supplier_id=` | Compras (paginadas) |
| POST | `/purchases` | Registrar compra (suma inventario) |
| GET | `/purchases/{id}` | Detalle de compra |
| POST | `/purchases/{id}/void` | Anular compra (revierte inventario) |
| GET | `/purchases/stats` | Totales de compras y proveedores |

### Registrar una compra

```bash
curl -X POST http://localhost:9080/api/v1/purchases \
  -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' \
  -d '{
    "supplier_id": "…",
    "items": [{"product_id": "…", "quantity": 5, "unit_cost": 5000}]
  }'
```

La compra **suma** el inventario, deja el movimiento en el kardex
(`reference_type = PURCHASE`) y actualiza `products.cost` con el valor **sin
IVA** (el costo unitario se interpreta con IVA incluido, igual que el precio de
venta). `POST /purchases/{id}/void` la anula y revierte el stock.

### Registrar una venta

```bash
curl -X POST http://localhost:9080/api/v1/sales \
  -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' \
  -d '{
    "items": [
      {"product_id": "…", "quantity": 2},
      {"product_id": "…", "quantity": 1}
    ],
    "customer_id": "…",
    "customer_name": "Panadería El Trigal",
    "payment_method": "CASH"
  }'
```

Respuesta `201`:

```json
{
  "data": {
    "id": "…", "number": "V-000004", "status": "COMPLETED",
    "subtotal": "31680.67", "tax": "6019.33", "total": "37700.00",
    "items": [{ "product_name": "Cafe molido 250 g", "quantity": 2,
                "unit_price": "9500.00", "tax_amount": "3033.61", "total": "19000.00" }]
  }
}
```

**Reglas de negocio aplicadas**

| Situación | Respuesta |
| --- | --- |
| Venta sin líneas | `422 EMPTY_SALE` |
| Producto inexistente o de otro negocio | `422 PRODUCT_NOT_FOUND` |
| Cantidad mayor al stock | `409 INSUFFICIENT_STOCK` (con el stock disponible) |
| Venta ya anulada | `409 ALREADY_VOIDED` |
| Colisión del número de venta | reintento automático (hasta 3) |

### Ajustar inventario

```bash
curl -X POST http://localhost:9080/api/v1/products/{id}/stock \
  -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' \
  -d '{"kind":"IN","quantity":40,"reason":"Compra a proveedor"}'
```

`kind` acepta `IN` (entrada), `OUT` (salida) y `ADJUST` (fijar el stock exacto).

## 6. Tablero (`kubo-analytics`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/dashboard/overview` | **Vista compuesta (BFF)**: el gateway consulta en paralelo las 7 vistas y devuelve una sola respuesta |
| GET | `/dashboard/summary` | Ventas, ingreso, IVA, ticket promedio, unidades, hoy |
| GET | `/dashboard/sales-by-day?days=14` | Serie diaria (en la zona horaria del negocio) |
| GET | `/dashboard/top-products?limit=10` | Productos más vendidos |
| GET | `/dashboard/top-customers?limit=10` | Mejores clientes |
| GET | `/dashboard/payment-methods` | Distribución por medio de pago |
| GET | `/dashboard/recent-sales?limit=10` | Últimas ventas |
| GET | `/dashboard/rotation` | Productos con más salida en 7 días |
| POST | `/events` | Vía de respaldo para reenviar eventos por HTTP |

### Vista compuesta (patrón BFF)

```bash
curl http://localhost:9080/api/v1/dashboard/overview -H "Authorization: Bearer ${TOKEN}"
```

```json
{
  "data": {
    "summary": { "sales_count": 10, "revenue": 141900.0, "today": { "revenue": 0, "sales_count": 0 } },
    "sales_by_day": [ { "date": "2026-09-23", "revenue": 141900.0, "sales_count": 10 } ],
    "top_products": [ { "product_name": "Cafe molido 250 g", "quantity": 6, "revenue": 57000.0 } ],
    "payment_methods": [ { "payment_method": "CASH", "revenue": 45300.0, "sales_count": 3 } ],
    "recent_sales": [ { "number": "V-000010", "total": 35700.0 } ],
    "rotation": [ { "product_name": "Panela 500 g", "quantity_7d": 4 } ],
    "customers": { "total": 11, "by_stage": { "LEAD": 8, "PROSPECT": 1, "CUSTOMER": 2 } }
  }
}
```

Por qué existe: sin esta capa la PWA necesitaba **siete viajes de red** para pintar
el tablero (108 ms medidos). El gateway consulta los servicios en paralelo dentro
de la red privada y responde en ~25 ms. Si una vista falla, la respuesta incluye
`unavailable: ["top_products"]` y el tablero se muestra parcial en lugar de caer.

### Zona horaria del negocio

Los indicadores de «hoy» y la serie diaria se calculan en la zona horaria del
negocio (`KUBO_TIMEZONE`, por defecto `America/Bogota`), no en UTC. Sin esto, en
Colombia las ventas de 19:00 a 23:59 se atribuirían al día siguiente. La respuesta
de `/sales/stats` incluye `timezone` y `business_date` para poder auditarlo.

## 7. Eventos de dominio

El ERP publica en el exchange *topic* `kubo.events`. Sobre del evento:

```json
{
  "event_id": "9f1c…",
  "event_type": "sale.created",
  "version": 1,
  "occurred_at": "2026-09-23T17:50:12.480Z",
  "tenant_id": "…",
  "data": {
    "sale_id": "…", "number": "V-000004", "status": "COMPLETED",
    "customer_id": "…", "customer_name": "Panadería El Trigal",
    "payment_method": "CASH",
    "subtotal": "31680.67", "tax": "6019.33", "total": "37700.00",
    "sold_by": "…", "sold_at": "2026-09-23T17:50:12.470Z",
    "items": [
      { "product_id": "…", "product_name": "Cafe molido 250 g", "quantity": 2,
        "unit_price": "9500.00", "tax_rate": "19.00",
        "tax_amount": "3033.61", "total": "19000.00" }
    ]
  }
}
```

**Contrato de consumo**: el consumidor debe deduplicar por `event_id` y tolerar
campos nuevos (versionado aditivo). Los mensajes fallidos van a la cola
`kubo.analytics.sale_created.dlq`.

## 8. Formato de errores

Todos los servicios responden con la misma forma:

```json
{
  "code": "INSUFFICIENT_STOCK",
  "message": "Stock insuficiente de Cafe molido 250 g: disponible 7"
}
```

| Código HTTP | Cuándo |
| --- | --- |
| `400` | Datos inválidos (`VALIDATION_ERROR`, `INVALID_QUANTITY`) |
| `401` | Sin token, token inválido/expirado, identidad ausente |
| `404` | Recurso inexistente o de otro negocio |
| `409` | Conflicto de estado (`INSUFFICIENT_STOCK`, `ALREADY_VOIDED`, `EMAIL_ALREADY_EXISTS`) |
| `422` | Regla de negocio incumplida (`EMPTY_SALE`, `PRODUCT_NOT_FOUND`) |
| `429` | Límite de tasa excedido |
| `502` | Microservicio no disponible (`UPSTREAM_UNAVAILABLE`) |

Los mensajes nunca incluyen trazas ni detalles internos; los detalles técnicos
quedan en los logs con el `correlation-id` de la petición.

## 9. Límites de tasa

| Ámbito | Límite por defecto |
| --- | --- |
| Rutas de negocio | 600 peticiones/minuto por negocio (o por IP si no hay token) |
| Rutas de autenticación | 40 peticiones/minuto (frena fuerza bruta) |

Las respuestas incluyen `X-RateLimit-Limit` y `X-RateLimit-Remaining`. Al
excederse: `429 RATE_LIMIT_EXCEEDED`.
