# 02 — Modelo de datos

Kubo aplica **una base de datos por servicio**: ningún servicio consulta el
esquema de otro. Las referencias entre dominios son identificadores lógicos, no
llaves foráneas.

## 1. Panorama

```mermaid
flowchart LR
  subgraph PG["PostgreSQL 17 · una instancia, tres bases aisladas"]
    subgraph IAMDB["kubo_iam"]
      TENANTS["tenants"]
      USERS["users"]
      REFRESH["refresh_tokens"]
      RESET["password_reset_tokens"]
      MAIL["mail_outbox"]
      AUDIT["audit_logs"]
    end
    subgraph CRMDB["kubo_crm"]
      CUSTOMERS["customers"]
    end
    subgraph ERPDB["kubo_erp"]
      PRODUCTS["products"]
      MOVEMENTS["stock_movements"]
      SALES["sales"]
      ITEMS["sale_items"]
      OUTBOX["outbox_events"]
    end
  end

  subgraph MONGO["MongoDB 8"]
    EVENTS["events<br/>(bitácora)"]
    PROJ["sales<br/>(proyección)"]
  end

  USERS -->|"tenant_id"| TENANTS
  REFRESH -->|"user_id"| USERS
  RESET -->|"user_id"| USERS
  CUSTOMERS -.->|"tenant_id (lógico)"| TENANTS
  PRODUCTS -.->|"tenant_id (lógico)"| TENANTS
  SALES -->|"sale_id"| ITEMS
  ITEMS -->|"product_id"| PRODUCTS
  MOVEMENTS -->|"product_id"| PRODUCTS
  SALES -.->|"customer_id (lógico, sin FK)"| CUSTOMERS
  SALES -.->|"sale.created (misma tx)"| OUTBOX
  OUTBOX -.->|"publicador de barrido"| EVENTS
  EVENTS -.->|"proyección"| PROJ
```

## 2. `kubo_iam` — identidad y auditoría

```mermaid
erDiagram
  TENANTS ||--o{ USERS : "tiene"
  USERS ||--o{ REFRESH_TOKENS : "emite"
  USERS ||--o{ PASSWORD_RESET_TOKENS : "recupera"

  TENANTS {
    uuid id PK
    varchar name
    varchar slug UK
    varchar plan
    timestamptz created_at
  }
  USERS {
    uuid id PK
    uuid tenant_id FK
    varchar email "único por negocio"
    varchar password_hash "BCrypt"
    varchar full_name
    varchar role "OWNER|ADMIN|SELLER|ACCOUNTANT|VIEWER"
    varchar status "ACTIVE|DISABLED"
    timestamptz last_login_at
    integer failed_login_attempts "bloqueo por intentos"
    timestamptz locked_until "temporal"
  }
  REFRESH_TOKENS {
    uuid id PK
    uuid user_id FK
    varchar token_hash UK "SHA-256, nunca el valor"
    timestamptz expires_at
    timestamptz revoked_at
    uuid replaced_by "rotación"
  }
  PASSWORD_RESET_TOKENS {
    uuid id PK
    uuid user_id FK
    varchar token_hash UK "SHA-256, un solo uso"
    timestamptz expires_at "30 minutos"
    timestamptz used_at
  }
  MAIL_OUTBOX {
    uuid id PK
    varchar recipient
    varchar subject
    text body "solo transporte log"
    varchar transport "log|smtp"
    timestamptz created_at
  }
  AUDIT_LOGS {
    uuid id PK
    uuid tenant_id
    uuid user_id
    varchar action
    varchar entity
    varchar entity_id
    varchar prev_hash
    varchar hash "cadena SHA-256"
    smallint hash_version "2 = vigente"
    timestamptz created_at
  }
```

**Decisiones del modelo**

- `refresh_tokens.token_hash`: si la base se filtra, los tokens no se pueden
  reutilizar (solo se guarda su SHA-256).
- `replaced_by`: al rotar un token se enlaza con el que lo reemplaza. Si vuelve a
  usarse uno revocado, se invalida toda la familia (detección de robo).
- `audit_logs.prev_hash` + `hash`: cada registro encadena el anterior; alterar un
  registro intermedio rompe la cadena y es detectable.
- `users.email` es único **por negocio**, no global.
- `password_reset_tokens`: solo el SHA-256 del enlace, con expiración y uso único;
  al consumirse se revocan todas las sesiones del usuario.
- `users.failed_login_attempts` + `locked_until`: el bloqueo por intentos vive en
  la misma fila y se levanta con un acceso correcto o una recuperación.
- `mail_outbox`: buzón de demostración (transporte `log`); con `smtp` el cuerpo no
  se persiste.
- `audit_logs.hash_version`: cada fila declara con qué algoritmo se calculó su
  hash; las de la versión 1 solo se verifican por enlace.

## 3. `kubo_crm` — clientes con datos personales cifrados

```
customers
├── id                        uuid  PK
├── tenant_id                 uuid  (aislamiento por negocio)
├── name                      varchar(160)
├── email                     varchar(180)
├── document_number_encrypted text      ← AES-256-GCM: base64(iv ‖ tag ‖ ciphertext)
├── document_number_bidx      varchar(64) ← HMAC-SHA256 normalizado (búsqueda exacta)
├── phone_encrypted           text      ← AES-256-GCM
├── phone_bidx                varchar(64) ← HMAC-SHA256
├── city, address, notes
├── stage                     LEAD | PROSPECT | CUSTOMER
├── credit_limit              numeric(14,2)  ≥ 0
├── deleted_at                timestamptz    (borrado lógico)
└── created_at / updated_at
```

**Índices y restricciones**

| Objeto | Propósito |
| --- | --- |
| `idx_customers_tenant_document_unique` (único, parcial) | Un documento no puede repetirse dentro del mismo negocio; ignora borrados |
| `idx_customers_tenant_stage` | Filtros del tablero por etapa |
| `customers_stage_check` | Solo los tres estados previstos |
| `customers_credit_limit_check` | El cupo no puede ser negativo |

## 4. `kubo_erp` — catálogo, inventario y ventas

```mermaid
erDiagram
  PRODUCTS ||--o{ STOCK_MOVEMENTS : "registra"
  PRODUCTS ||--o{ SALE_ITEMS : "se vende en"
  SALES ||--|{ SALE_ITEMS : "contiene"

  PRODUCTS {
    uuid id PK
    uuid tenant_id
    varchar sku "único por negocio"
    varchar name
    numeric price "precio final con IVA"
    numeric cost
    numeric tax_rate "19.00 por defecto"
    integer stock "proyección del kardex"
    integer min_stock "alerta de reposición"
    boolean active
    timestamptz deleted_at
  }
  STOCK_MOVEMENTS {
    uuid id PK
    uuid tenant_id
    uuid product_id FK
    varchar kind "IN|OUT|ADJUST"
    integer quantity "> 0"
    integer stock_after
    varchar reason
    varchar reference_type "SALE|VOID|MANUAL"
    uuid reference_id
    uuid created_by
    timestamptz inserted_at
  }
  SALES {
    uuid id PK
    uuid tenant_id
    varchar number "V-000001, único por negocio"
    uuid customer_id "referencia lógica al CRM"
    varchar customer_name "copia histórica"
    varchar status "COMPLETED|VOIDED"
    varchar payment_method "CASH|CARD|TRANSFER|CREDIT"
    numeric subtotal
    numeric tax
    numeric total
    uuid sold_by
    timestamptz voided_at
  }
  SALE_ITEMS {
    uuid id PK
    uuid sale_id FK
    uuid product_id FK
    varchar product_name "copia histórica"
    integer quantity "> 0"
    numeric unit_price "copia histórica"
    numeric tax_rate
    numeric tax_amount
    numeric total
  }
```

**Reglas de integridad en el motor**

| Restricción | Qué garantiza |
| --- | --- |
| `products_stock_not_negative` | El motor rechaza stock negativo aunque el código falle |
| `stock_movements_reference_unique` (único parcial) | Una venta no puede descontar dos veces el mismo producto (idempotencia) |
| `sale_items_quantity_positive` | No existen líneas con cantidad cero o negativa |
| `sales_total_not_negative` | No existen ventas con total negativo |
| `products_tenant_sku_unique` (único parcial) | Un SKU no se repite dentro del negocio |

**Por qué el stock es una proyección**: la verdad está en `stock_movements`.
`products.stock` se mantiene por velocidad de lectura y se actualiza **dentro de
la misma transacción** que inserta el movimiento, con el producto bloqueado
(`SELECT ... FOR UPDATE`). Ante cualquier duda se puede reconstruir el saldo
sumando el kardex y compararlo con la proyección.

**Bandeja de salida (`outbox_events`)**: el evento `sale.created` se guarda en la
misma transacción de la venta (`status PENDING`), con `event_id` único, el
`payload` completo y `attempts`/`available_at` para reintentos. El publicador de
barrido lo marca `PUBLISHED` (o `FAILED` tras 10 intentos). Queda fuera de RLS a
propósito: se lee cruzando negocios para entregar los eventos (ADR-0009).

## 5. `kubo_analytics` — modelo de lectura en MongoDB

```
events (bitácora cruda)
├── _id           = event_id del evento  ← índice único: deduplicación
├── event_type    "sale.created"
├── version       1
├── tenant_id
├── occurred_at   date
├── payload       documento original completo
└── received_at   date

sales (proyección consultable)
├── _id            ObjectId
├── sale_id        índice único
├── tenant_id      + sold_at  (índice compuesto)
├── number, status, payment_method
├── customer_id, customer_name
├── subtotal, tax, total        (double: analítica, no contabilidad)
├── items[]        {product_id, product_name, quantity, unit_price, tax_amount, total}
├── sold_at, created_at, updated_at
```

**Idempotencia**: `events._id` es el `event_id`. Si el mismo evento llega dos
veces, la segunda inserción falla con clave duplicada y se descarta: una venta
nunca se cuenta dos veces.

**Precisión numérica**: el sistema de registro contable es `kubo-erp`, con
aritmética decimal. Aquí los importes se guardan como punto flotante porque las
agregaciones sobre miles de documentos no necesitan precisión de centavo y así
se aprovechan los operadores nativos de MongoDB. Es una decisión consciente: el
tablero es para decidir, la factura es para cobrar.

## 6. Convenciones transversales

| Convención | Decisión |
| --- | --- |
| Identificadores | UUID (v4) en todas las tablas; nunca enteros autoincrementales expuestos |
| Fechas | `timestamptz` en PostgreSQL, almacenadas en UTC; la interfaz muestra `America/Bogota` |
| Dinero | `numeric(14,2)` y aritmética decimal en el ERP; nunca coma flotante |
| Borrado | Lógico (`deleted_at`), nunca físico: la historia comercial se conserva |
| Aislamiento | `tenant_id` en toda tabla de negocio + **RLS activo con `FORCE`** en las tres bases (ADR-0010) |
| Migraciones | Versionadas y **inmutables** una vez aplicadas; nunca se edita una migración ya ejecutada |
