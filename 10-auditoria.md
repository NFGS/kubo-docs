# 10 — Auditoría técnica y plan de mejora

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-23 |
| Alcance | Los 6 servicios, la base de datos, la infraestructura y la documentación |
| Método | Medición sobre el sistema en ejecución, planes de ejecución reales y revisión de código |
| Estado de partida | 33/33 comprobaciones end-to-end en verde, 10 contenedores sanos |

## 1. Resumen ejecutivo

El sistema **funciona de extremo a extremo y está verificado**, pero una auditoría
técnica seria no se conforma con que funcione: busca dónde se romperá al crecer,
dónde miente un indicador y qué falta para ser un producto y no una demostración.

Se encontraron **10 hallazgos**, todos corregidos y medidos en esta misma sesión, y
**16 pendientes** priorizados con su plan. El más grave no era de rendimiento sino
de **verdad del dato**: el indicador «ventas de hoy» usaba el día UTC, de modo que
en Colombia **todas las ventas posteriores a las 19:00 se contaban al día
siguiente** — justo las horas de mayor venta de una tienda de barrio.

El más silencioso, descubierto al construir la vista compuesta, fue otro error de
dato: la tarjeta de cartera de clientes del tablero **mostraba ceros siempre**,
porque el CRM devolvía `stats` sin el envoltorio `data` que el resto de la API sí
usa. Nada fallaba, nada avisaba: simplemente el dueño veía un dato falso.

### Correcciones aplicadas (con medición)

| ID | Hallazgo | Severidad | Medición antes → después |
| --- | --- | --- | --- |
| A-01 | El día comercial se calculaba en UTC | **Crítica** | Ventas de 19:00–23:59 caían en el día siguiente |
| A-02 | Búsqueda por texto sin índice (recorría todo) | Alta | ERP 46 ms → **5.7 ms** (8×) · CRM 28 ms → **4.4 ms** (6×) |
| A-03 | Tablero con 7 viajes de red secuenciales | Alta | 108 ms → **~25 ms** (BFF, 4×) |
| A-04 | Cadena de auditoría con condición de carrera | Alta | Cadena podía partirse sin detección |
| A-05 | Numeración de ventas con `COUNT(*)` | Media | O(n) → **O(log n)** por venta |
| A-06 | Cartera de clientes siempre en cero | Media | Contrato inconsistente → dato falso visible |
| A-07 | Sin red de seguridad en la interfaz | Media | Pantalla en blanco → mensaje accionable |
| A-08 | Efectos secundarios dentro de actualizadores de estado | Baja | Avisos duplicados en StrictMode |
| A-09 | Índice ciego implementado pero sin endpoint | Media | Función inalcanzable → `GET /customers/by-document/:doc` |
| A-10 | Listado de usuarios sin paginación | Media | Tabla completa → página acotada a 100 |

## 2. Método de auditoría

1. **Medición, no estimación.** Latencia por endpoint con `curl` (promedio de 5
   ejecuciones) a través del gateway, es decir, la latencia que percibe el usuario.
2. **Prueba a escala.** Se cargaron **50.000 productos y 50.000 clientes**
   sintéticos para que el planificador de PostgreSQL eligiera planes reales, y se
   compararon con `EXPLAIN (ANALYZE, BUFFERS)`. Los datos de prueba se eliminaron
   al terminar.
3. **Revisión de código** servicio por servicio buscando condiciones de carrera,
   rutas sin usar y supuestos implícitos.
4. **Verificación funcional** con la prueba de humo de 33 comprobaciones.

## 3. Rendimiento medido

### 3.1 Latencia por endpoint (a través del gateway, red local)

| Endpoint | Antes | Después |
| --- | --- | --- |
| `POST /auth/login` (BCrypt + firma RSA) | 75 ms | 75 ms |
| `GET /products` | 6 ms | 6 ms |
| `GET /customers` | 9 ms | 9 ms |
| `GET /products/stats` | 8 ms | 8 ms |
| `GET /dashboard/*` (6 endpoints) | 5–6 ms cada uno | — |
| **`GET /dashboard/overview`** (vista compuesta) | **108 ms** (7 viajes) | **~25 ms** (rango 11–42 ms) |

### 3.2 Búsqueda por texto con 50.000 registros

```
-- ERP: productos por nombre o SKU
ANTES   Limit → Sort → Index Scan → Filter → Rows Removed by Filter: 49999
        Execution Time: 46.6 ms
DESPUÉS Bitmap Heap Scan → BitmapOr → Bitmap Index Scan (idx_products_name_trgm)
        Execution Time: 5.7 ms      → 8× más rápido

-- CRM: clientes por nombre o correo
ANTES   28 ms (recorría todos los clientes del negocio)
DESPUÉS 4.4 ms con índices en nombre Y correo → 6× más rápido
```

> **Lección de diseño:** con un solo índice (nombre) el CRM seguía lento, porque
> el `OR` con la columna de correo obligaba a descartar el plan indexado. En
> búsquedas con `OR` hay que indexar **todas** las columnas participantes.

### 3.3 Recursos

| Recurso | Medición | Evaluación |
| --- | --- | --- |
| RAM total del sistema | ~930 MB | Cabe en un VPS de USD 6/mes |
| Servicio más pesado | `kubo-iam` 282 MB (JVM) | Esperable; acotado con `-Xmx256m` |
| Resto de servicios | 13–157 MB | Correcto |
| Arranque completo | ~50 s | Aceptable; se puede cachear mejor |

## 4. Hallazgos corregidos (detalle)

### A-01 · Día comercial en UTC — **Crítica**

```sql
-- Una venta registrada a las 20:00 hora Colombia (01:00 UTC del día siguiente)
momento_utc (columna)      = 2026-09-24 01:00:00
fecha que usaba Kubo       = 2026-09-24   ← incorrecta
fecha real del negocio     = 2026-09-23   ← correcta
```

**Impacto**: el KPI «Ventas de hoy» y la serie diaria del tablero atribuían al día
siguiente las ventas de 19:00 a 23:59. En un negocio de barrio esa franja es la de
mayor venta: el indicador más visible del producto mentía.

**Corrección**: zona horaria del negocio configurable (`KUBO_TIMEZONE`, por
defecto `America/Bogota`). El almacenamiento sigue en UTC (correcto); el cálculo
del día comercial se hace en la zona del negocio:

- ERP: `(? AT TIME ZONE 'UTC' AT TIME ZONE ?)::date = ?` — la doble conversión es
  necesaria porque las columnas son `timestamp without time zone`.
- Analítica: `$dateToString` con `timezone` y la ventana de «hoy» calculada en la
  zona del negocio y convertida a UTC para consultar.

### A-02 · Búsqueda sin índice — Alta

El `ILIKE '%termino%'` del POS y del CRM no puede apoyarse en un índice B-tree. Con
catálogos de barrio no se nota; con 50.000 referencias el sistema recorría todo.
Se añadieron índices **GIN con `pg_trgm`** mediante migraciones versionadas
(`pg_trgm` es extensión *trusted* desde PostgreSQL 13: no requiere superusuario).

### A-03 · Siete viajes para pintar el tablero — Alta

La PWA pedía 7 endpoints en secuencia. Se implementó el patrón **BFF (Backend For
Frontend)**: el gateway expone `GET /api/v1/dashboard/overview` y consulta los
servicios **en paralelo** dentro de la red privada, devolviendo una sola respuesta.

- `Promise.allSettled`: si una vista falla, el tablero se entrega **parcial** y
  avisa cuál falta, en lugar de mostrar una pantalla de error.
- Tiempo de espera por servicio: 5 s.
- La ruta la atiende el gateway (`GATEWAY_OWNED_PATHS`), no se reenvía.

### A-04 · Cadena de auditoría con condición de carrera — Alta

`record()` leía el último hash y luego insertaba. Dos peticiones concurrentes
podían leer el mismo hash anterior y **partir la cadena**: dos entradas apuntando
al mismo predecesor, y la manipulación dejaba de ser detectable.

**Corrección**: `pg_advisory_xact_lock` al inicio de la transacción. Serializa la
escritura de la cadena sin bloquear ninguna tabla y se libera automáticamente al
terminar la transacción.

### A-05 · Numeración de ventas con `COUNT(*)` — Media

Cada venta contaba todas las ventas del negocio (verificado con `EXPLAIN`: `Index
Only Scan` sobre 50.000 filas). Ahora se toma el **máximo** del consecutivo, que el
índice único `(tenant_id, number)` resuelve en tiempo logarítmico. La restricción
única sigue protegiendo la concurrencia y el reintento ya existente la resuelve.

### A-06 a A-10 · Robustez, contrato, interfaz y funciones incompletas

| Hallazgo | Corrección |
| --- | --- |
| **`customers/stats` sin envoltorio `data`** (A-06) | Unificado al contrato del resto de la API. Además el gateway ahora cae al cuerpo completo si un servicio no envuelve: una inconsistencia degrada la forma, no borra una vista |
| Un error de render dejaba la pantalla en blanco (A-07) | `ErrorBoundary` con mensaje entendible, botón de recarga y registro del error |
| `notify()` dentro de actualizadores de estado de React (A-08) | Validaciones movidas fuera: sin avisos duplicados en StrictMode |
| `Customer.find_by_document` existía pero era inalcanzable (A-09) | `GET /api/v1/customers/by-document/:document` — el caso de uso real del mostrador |
| `GET /users` devolvía la tabla completa (A-10) | Paginación con tamaño acotado en el servidor (máx. 100) |

## 5. Pendientes priorizados

### 5.1 Bloqueantes para un negocio real

| ID | Pendiente | Riesgo | Esfuerzo |
| --- | --- | --- | --- |
| P-01 | ***Transactional outbox*** | Un evento se pierde si el proceso muere justo tras el `commit`: el tablero no reflejaría una venta ya cobrada | 1–2 días |
| P-02 | **Activar RLS** con interceptor de transacción | Hoy el aislamiento entre negocios depende de que toda consulta filtre por `tenant_id`. Un olvido no se detecta | 2–3 días |
| P-03 | **Refresh token en cookie `httpOnly`** (BFF) | Un XSS podría robar el token de refresco | 2 días |
| P-04 | **Recuperación de contraseña** | Hoy solo un administrador puede restablecerla desde la base | 1 día |
| P-05 | **Respaldos automatizados + simulacro de restauración** | Documentado pero no ejecutado: un respaldo sin probar no es un respaldo | 1 día |

### 5.2 Calidad e ingeniería

| ID | Pendiente | Por qué importa | Esfuerzo |
| --- | --- | --- | --- |
| P-06 | **CI/CD** (lint + pruebas + SAST + escaneo de secretos por repo) | Las verificaciones son manuales; un `make smoke` no protege contra una regresión de seguridad | 2–3 días |
| P-07 | **Observabilidad** (OpenTelemetry → Grafana/Loki/Tempo) | Hoy hay sondas de salud y logs locales: no hay trazas ni métricas históricas | 3 días |
| P-08 | **Pruebas de integración con Testcontainers** por servicio | Las pruebas actuales son unitarias puras + humo; falta cubrir los repositorios | 3 días |
| P-09 | **Pruebas de contrato** (OpenAPI ejecutable + Pact) | El contrato se verifica de facto en el humo; un cambio incompatible se detectaría tarde | 2 días |
| P-10 | **E2E de navegador** (Playwright) y **carga** (k6, 50 cajas) | La interfaz se verifica a mano; el comportamiento bajo concurrencia no está medido | 2 días |
| P-11 | **Bloqueo de cuenta** tras N intentos fallidos | Hoy solo hay límite de tasa por IP | 0.5 día |
| P-12 | **Caché del service worker por usuario** | En un equipo compartido, el caché de lecturas de un usuario podría servirse a otro si no cierra sesión | 0.5 día |
| P-13 | **Paginación** en productos, ventas y movimientos | El ERP corta en 300/200 registros; un negocio grande los supera | 1 día |
| P-14 | **Empaquetado de imágenes por digest** y reservas de recursos | Las etiquetas (`postgres:17`) pueden cambiar; conviene fijar el digest | 0.5 día |

### 5.3 Alcance funcional (lo que separa el MVP de un producto)

| ID | Módulo | Valor para el negocio |
| --- | --- | --- |
| P-15 | **Compras y proveedores** | Cierra el ciclo del inventario: hoy solo entran mercancías por ajuste manual |
| P-16 | **Sesiones de caja** (apertura, cierre, arqueo) | Control de efectivo por turno: es lo primero que pide un tendero |
| P-17 | **Vertical Packs** (retail, servicios, restaurantes, agro) | Convierte Kubo en multi-rubro sin duplicar código (ya diseñado) |
| P-18 | **Facturación electrónica DIAN** (UBL 2.1, CUFE, QR) | Requisito legal para facturar; exige ser Proveedor Tecnológico |
| P-19 | **Notificaciones** (WhatsApp / correo) | Cobranza, confirmaciones y avisos de stock: el quinto servicio planificado |
| P-20 | **Usuarios y roles en la interfaz** | Hoy el API existe pero el dueño no puede crear vendedores sin ayuda técnica |
| P-21 | **Reportes exportables** (CSV/PDF) | Contabilidad y bancos piden soportes |
| P-22 | **Multi-bodega** y transferencias | Para negocios con más de un punto |

## 6. Evaluación arquitectónica

### Lo que está bien y no conviene tocar

- **Fronteras por contexto delimitado**: cada servicio es dueño de su esquema y
  ningún servicio consulta la base de otro. Es la decisión que más ha simplificado
  todo lo demás.
- **Seguridad en el borde**: un único punto de validación de identidad (gateway +
  JWKS) evita repartir la llave privada y centraliza la política.
- **Tolerancia a fallos en cadena**: la caja no depende del bus ni de analítica.
  Verificado: con RabbitMQ caído la venta se registra igual.
- **Cifrado de campo con índice ciego**: resuelve la tensión entre proteger el dato
  y poder buscarlo, sin cifrado determinista (que filtra información).

### Lo que hay que cambiar

| Cambio | Motivo | ADR a escribir |
| --- | --- | --- |
| Outbox transaccional | Único punto donde el sistema puede perder un dato ya confirmado al usuario | ADR-0009 |
| Interceptor de tenant + RLS activo | Convertir el aislamiento en garantía del motor, no del programador | ADR-0010 |
| BFF como capa formal | Ya existe para el tablero; conviene declararlo patrón del gateway y no un caso puntual | ADR-0011 |
| Zona horaria por negocio en la tabla `tenants` | Hoy es global por instalación; en multi-tenant debe ser un atributo del negocio | ADR-0012 |

### Escalado

| Nivel | Qué hacer | Cuándo |
| --- | --- | --- |
| 1 negocio | Un VPS, Docker Compose (estado actual) | Ahora |
| Varias cajas | Escalar `kubo-erp` (sin estado) y separar PostgreSQL a su instancia | > 5 cajas |
| Varios negocios | Activar RLS, zona horaria por tenant, BFF, caché de lecturas | Producto SaaS |
| Clúster | k3s + mTLS entre servicios + operador de respaldos | > 50 negocios |

## 7. Plan de mejora propuesto

### Fase 2 — Confiabilidad (2 semanas)

1. Outbox transaccional en el ERP + publicador de barrido (P-01).
2. Interceptor de transacción y activación de RLS en las tres bases (P-02).
3. Respaldos automatizados con simulacro de restauración documentado (P-05).
4. Cookie `httpOnly` para el refresh token (P-03) y recuperación de contraseña (P-04).

**Criterio de aceptación**: `make smoke` en verde + prueba de caída del bus sin
pérdida de eventos + restauración cronometrada por debajo de 4 h.

### Fase 3 — Calidad y observabilidad (2 semanas)

5. CI por repositorio con lint, pruebas, SAST, escaneo de secretos y SBOM (P-06).
6. OpenTelemetry en los cuatro lenguajes, con tablero en Grafana (P-07).
7. Pruebas de integración con Testcontainers y contrato OpenAPI ejecutable (P-08, P-09).
8. E2E con Playwright y carga con k6 a 50 cajas concurrentes (P-10).

**Criterio de aceptación**: una regresión de seguridad o de contrato bloquea el
merge; p95 del POS por debajo de 300 ms con 50 cajas.

### Fase 4 — Producto (4 semanas)

9. Compras y proveedores, sesiones de caja, usuarios y roles en la interfaz (P-15, P-16, P-20).
10. Vertical Packs para los cuatro rubros (P-17).
11. Notificaciones por WhatsApp y correo (P-19) y reportes exportables (P-21).
12. Facturación electrónica DIAN como puerto enchufable (P-18).

**Criterio de aceptación**: un negocio real opera una semana completa sin soporte
técnico presencial, con cierre de caja diario y factura emitida.

## 8. Conclusión

El sistema pasó de **«funciona»** a **«es correcto y sostiene la escala de su
mercado»**: el indicador principal ya no miente, las búsquedas dejaron de recorrer
la tabla completa, el tablero carga en una quinta parte del tiempo, la auditoría no
puede partirse y la interfaz no se queda en blanco.

Lo que falta no es cosmético: son las piezas que convierten una demostración
técnica sólida en un producto que un tendero puede usar todos los días sin
sobresaltos — **garantía de entrega de eventos, aislamiento impuesto por el motor,
automatización de calidad y los módulos que el negocio realmente pide** (compras,
caja, usuarios). El plan de las fases 2 a 4 está ordenado por riesgo, no por
lucimiento: primero lo que puede perder o mezclar datos, después lo que evita
regresiones, y al final lo que amplía el mercado.
