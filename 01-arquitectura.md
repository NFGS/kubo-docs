# 01 — Arquitectura

Kubo es un ERP + CRM autoalojable para PYMES. Se instala en el local del negocio
con un solo comando y opera como aplicación web instalable (PWA), incluso sin
conexión a internet.

## 1. Vista de contexto (C4 nivel 1)

```mermaid
flowchart LR
  DUENO["Dueño / Administrador"]
  VENDEDOR["Vendedor en mostrador"]
  KUBO["Kubo<br/>ERP + CRM autoalojable"]
  CLIENTE["Cliente del negocio<br/>(WhatsApp / correo)"]

  DUENO -->|"tablero, catálogo,<br/>clientes"| KUBO
  VENDEDOR -->|"punto de venta"| KUBO
  KUBO -.->|"comprobantes y avisos<br/>(Fase 4)"| CLIENTE
```

## 2. Vista de contenedores (C4 nivel 2)

```mermaid
flowchart TB
  subgraph NAVEGADOR["Navegador del negocio"]
    PWA["PWA instalada<br/>React 19 + Vite<br/>cola offline en IndexedDB"]
  end

  subgraph SERVIDOR["Servidor del negocio (Docker Compose)"]
    TLS["kubo-tls<br/>Caddy · HTTPS"]
    WEB["kubo-web<br/>nginx · activos + proxy /api"]
    GW["kubo-gateway<br/>NestJS · API Gateway<br/>JWT RS256 · límites · BFF"]
    IAM["kubo-iam<br/>Java 21 · Spring Boot 4"]
    CRM["kubo-crm<br/>Ruby 3.4 · Rails 8"]
    ERP["kubo-erp<br/>Elixir 1.17 · Phoenix 1.8"]
    ANA["kubo-analytics<br/>Python 3.13 · FastAPI"]

    PG[("PostgreSQL 17<br/>kubo_iam · kubo_crm · kubo_erp")]
    MG[("MongoDB 8<br/>kubo_analytics")]
    MQ[["RabbitMQ 4<br/>kubo.events"]]
    RD[("Redis 7<br/>límites de tasa")]
    OTEL["kubo-otel<br/>collector OTLP"]
  end

  PWA -->|"HTTPS 3443"| TLS
  TLS --> WEB
  WEB -->|"/api/v1"| GW
  GW -->|"verifica JWKS"| IAM
  GW --> IAM
  GW --> CRM
  GW --> ERP
  GW --> ANA
  GW --> RD

  IAM --> PG
  CRM --> PG
  ERP --> PG
  ANA --> MG

  ERP -.->|"outbox: sale.created"| MQ
  MQ -.-> ANA
```

### Responsabilidad de cada contenedor

| Contenedor | Responsabilidad | Base de datos |
| --- | --- | --- |
| `kubo-gateway` | Único punto de entrada: valida el JWT contra el JWKS, aplica límites de tasa, propaga la identidad y la trazabilidad, enruta | Redis (límites) |
| `kubo-iam` | Negocios, usuarios, roles, tokens, auditoría | `kubo_iam` |
| `kubo-crm` | Clientes, cifrado de datos personales, cartera | `kubo_crm` |
| `kubo-erp` | Catálogo, inventario (kardex), ventas, anulación y **outbox** de eventos | `kubo_erp` |
| `kubo-analytics` | Modelo de lectura de ventas, indicadores del tablero | `kubo_analytics` (MongoDB) |
| `kubo-web` | Interfaz PWA; sirve los activos y proxea `/api` al gateway | — |
| `kubo-tls` | Terminación TLS (Caddy): HTTPS, redirección de HTTP y HSTS | — |
| `kubo-otel` | Collector OpenTelemetry: recibe las trazas OTLP de los cinco servicios (opcional: Tempo + Grafana) | — |

## 3. Vista de componentes (C4 nivel 3, ejemplo: `kubo-erp`)

```mermaid
flowchart TB
  subgraph WEB["kubo-erp · capa de presentación"]
    ROUTER["Router /api/v1"]
    PLUG["Plug Identity<br/>(identidad del gateway)"]
    CTRL["ProductController<br/>SaleController<br/>StockController"]
    JSON["ProductJSON · SaleJSON"]
  end

  subgraph APP["Capa de aplicación"]
    CATALOG["Catalog<br/>catálogo e inventario"]
    SALES["Sales<br/>venta transaccional"]
    PUB["Events.Publisher<br/>(RabbitMQ)"]
    EVT["Events.SaleCreated"]
  end

  subgraph DOM["Capa de dominio"]
    PROD["Product"]
    MOVE["StockMovement"]
    SALE["Sale · SaleItem"]
  end

  subgraph INFRA["Infraestructura"]
    REPO["Ecto.Repo<br/>PostgreSQL"]
    BUS["AMQP"]
  end

  ROUTER --> PLUG --> CTRL --> JSON
  CTRL --> CATALOG
  CTRL --> SALES
  SALES --> PROD
  SALES --> SALE
  CATALOG --> PROD
  CATALOG --> MOVE
  SALES --> PUB
  PUB --> EVT
  PUB --> BUS
  CATALOG --> REPO
  SALES --> REPO
```

Los otros servicios siguen la misma separación. La regla es que el dominio no
conoce HTTP, ni la base de datos, ni el bus de eventos.

## 4. Flujo crítico: registrar una venta

```mermaid
sequenceDiagram
  autonumber
  participant V as Vendedor (PWA)
  participant G as API Gateway
  participant E as kubo-erp
  participant P as PostgreSQL
  participant M as RabbitMQ
  participant A as kubo-analytics
  participant N as MongoDB

  V->>G: POST /api/v1/sales (Bearer JWT)
  G->>G: verifica firma RS256 contra el JWKS
  G->>E: POST /sales + X-User-Id, X-Tenant-Id
  E->>P: BEGIN
  E->>P: SELECT ... FOR UPDATE (productos)
  E->>P: INSERT sale, sale_items
  E->>P: UPDATE products.stock
  E->>P: INSERT stock_movements (kardex)
  E->>P: INSERT outbox_events (sale.created)
  E->>P: COMMIT
  E-->>G: 201 Created (venta)
  G-->>V: 201 Created
  Note over E,P: La venta y su evento se confirman juntos (outbox)
  E-)M: el publicador de barrido entrega sale.created
  M-)A: entrega del evento
  A->>N: deduplica por event_id y proyecta la venta
  Note over V,A: El tablero refleja la venta en menos de un segundo,<br/>sin que la caja espere a analítica.
```

> Si el bus está caído, el evento **espera en la bandeja de salida**
> (`outbox_events`) y se entrega al volver; la venta ya está confirmada y el
> negocio sigue vendiendo. `make bus-drill` lo verifica (ver ADR-0009).

### Si no hay internet en el local

```mermaid
sequenceDiagram
  autonumber
  participant V as Vendedor (PWA)
  participant Q as Cola IndexedDB
  participant G as API Gateway
  participant E as kubo-erp

  V->>Q: cobra sin conexión (venta guardada)
  Note over V,Q: La venta queda "pendiente de sincronizar"
  V->>V: vuelve la conexión (evento online)
  Q->>G: reintenta POST /sales con el token vigente
  G->>E: registra la venta
  E-->>Q: 201 Created
  Q->>Q: elimina la venta de la cola
```

## 5. Atributos de calidad y cómo se sostienen

| Atributo | Mecanismo |
| --- | --- |
| **Escalabilidad** | Servicios sin estado (excepto las bases); el gateway escala horizontalmente porque los límites de tasa viven en Redis. Cada base puede migrar a su propia instancia sin tocar código. |
| **Disponibilidad** | Tolerancia a fallos en cadena: la venta no depende del bus ni de analítica; el gateway opera sin Redis (fail-open); cada contenedor tiene *healthcheck* y política de reinicio. |
| **Seguridad** | JWT asimétrico, cifrado de campos, aislamiento por negocio, auditoría encadenada, límites de tasa y validación en cada frontera. |
| **Mantenibilidad** | Un lenguaje por contexto con su ecosistema natural; arquitectura limpia dentro de cada servicio; contratos explícitos entre repos. |
| **Portabilidad** | Todo corre en Docker Compose: el mismo artefacto sirve para el mini-PC del local y para un servidor en la nube. |
| **Observabilidad** | Sonda `/health` en cada servicio con estado de sus dependencias, `correlation-id` propagado por el gateway y logs JSON estructurados. |
| **Costo** | Consumo en reposo cercano a 1 GB de RAM y 12 contenedores; cabe en un VPS de USD 6–12 al mes o en un equipo modesto del local. El stack visual de trazas (Tempo + Grafana) es opcional. |

## 6. Decisiones arquitectónicas

Cada decisión relevante está registrada como ADR:

| ADR | Decisión |
| --- | --- |
| [0001](adr/ADR-0001-microservicios-monolito-modular.md) | Microservicios con monolito modular interno |
| [0002](adr/ADR-0002-polyrepo-contratos.md) | Polyrepo con contratos como fuente de verdad |
| [0003](adr/ADR-0003-multitenancy-hibrido.md) | Multi-tenancy híbrido (`tenant_id` + RLS activo) |
| [0004](adr/ADR-0004-poliglotismo.md) | Poliglotismo deliberado: un lenguaje por contexto |
| [0005](adr/ADR-0005-eventos-rabbitmq.md) | Eventos con RabbitMQ y publicador tolerante a fallos |
| [0006](adr/ADR-0006-cifrado-campos.md) | Cifrado de campos personales con AES-256-GCM |
| [0007](adr/ADR-0007-jwt-rs256-jwks.md) | JWT RS256 con JWKS en el gateway |
| [0008](adr/ADR-0008-alcance-mvp.md) | Alcance declarado del MVP y recortes conscientes |
| [0009](adr/ADR-0009-outbox-transaccional.md) | Outbox transaccional para la entrega de eventos |
| [0010](adr/ADR-0010-rls-activo.md) | RLS activo con interceptor de transacción |
| [0011](adr/ADR-0011-bff-capa-formal.md) | BFF como capa formal del gateway |
| [0012](adr/ADR-0012-zona-horaria-por-negocio.md) | Zona horaria por negocio |
| [0013](adr/ADR-0013-vertical-packs.md) | Vertical Packs: el vertical como dato del negocio |
| [0014](adr/ADR-0014-puerto-facturacion-dian.md) | Facturación electrónica DIAN como puerto enchufable |
| [0015](adr/ADR-0015-segundo-factor-totp.md) | Segundo factor TOTP del propietario |

## 7. Estructura del workspace

```
Kubo/
├── README.md            índice y arranque rápido
├── Makefile             up · down · seed · smoke · pdf
├── kubo-gateway/        API Gateway (TypeScript + NestJS)
├── kubo-iam/            identidad (Java + Spring Boot)
├── kubo-crm/            clientes (Ruby + Rails)
├── kubo-erp/            catálogo, inventario y ventas (Elixir + Phoenix)
├── kubo-analytics/      tablero (Python + FastAPI + MongoDB)
├── kubo-web/            PWA (React + Vite + Tailwind)
├── kubo-infra/          Docker Compose, semilla y prueba de humo
└── kubo-docs/           esta documentación
```
