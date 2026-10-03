# 10 — Auditoría técnica y plan de mejora

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-23 |
| Alcance | Los 6 servicios, la base de datos, la infraestructura y la documentación |
| Método | Medición sobre el sistema en ejecución, planes de ejecución reales y revisión de código |
| Estado de partida | 33/33 comprobaciones end-to-end en verde, 10 contenedores sanos |
| Estado de cierre | **44/44** (se añadieron 11 comprobaciones para cubrir las correcciones) |
| Rondas | Primera: rendimiento y verdad del dato · Segunda: seguridad y consistencia |

## 1. Resumen ejecutivo

El sistema **funciona de extremo a extremo y está verificado**, pero una auditoría
técnica seria no se conforma con que funcione: busca dónde se romperá al crecer,
dónde miente un indicador y qué falta para ser un producto y no una demostración.

Se encontraron **17 hallazgos**, todos corregidos y medidos en esta misma sesión, y
**31 pendientes** priorizados con su plan. **Los 31 quedaron cerrados y verificados
en las fases 1–6** (ver [`11-plan-de-cierre.md`](11-plan-de-cierre.md)); lo que
sigue abierto es el backlog comercial y externo, declarado en §5.4 y en el plan.

Los dos más graves no eran de rendimiento:

1. **El indicador «ventas de hoy» usaba el día UTC**: en Colombia todas las ventas
   posteriores a las 19:00 se contaban al día siguiente — justo las horas de mayor
   venta de una tienda de barrio.
2. **La auditoría de seguridad se borraba a sí misma**: los intentos de acceso
   fallidos y la detección de robo de token se registraban dentro de la transacción
   que después se revertía al lanzar la excepción. La bitácora quedaba sin los dos
   eventos que más importan en una investigación, y la invalidación de la familia de
   tokens tampoco se guardaba: el sistema detectaba el robo y no hacía nada.

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
| A-04 | **La auditoría de fallos se revertía con la transacción** | **Alta** | El intento fallido y el robo de token no quedaban registrados |
| A-05 | **La llave JWT era efímera y el compose no la pasaba** | **Alta** | Cada reinicio invalidaba **todas** las sesiones |
| A-06 | Cadena de auditoría con condición de carrera | Alta | Dos peticiones podían partir la cadena sin detección |
| A-07 | Verificación de la cadena inalcanzable y mal definida | Media | Código muerto → endpoint `/audit/verify` que verifica enlace y contenido |
| A-08 | Hash calculado con nanosegundos, columna con microsegundos | Media | La verificación habría fallado siempre |
| A-09 | Numeración de ventas con `COUNT(*)` | Media | O(n) → **O(log n)** por venta |
| A-10 | Cartera de clientes siempre en cero | Media | Contrato inconsistente → dato falso visible |
| A-11 | Sin red de seguridad en la interfaz | Media | Pantalla en blanco → mensaje accionable |
| A-12 | Índice ciego implementado pero sin endpoint | Media | Función inalcanzable → `GET /customers/by-document/:doc` |
| A-13 | Listado de usuarios sin paginación | Media | Tabla completa → página acotada a 100 |
| A-14 | **Prueba del ERP con la expectativa mal calculada** | Baja | Esperaba 41650 donde el resultado correcto es 29750 (nunca se había ejecutado) |
| A-15 | Efectos secundarios dentro de actualizadores de estado | Baja | Avisos duplicados en StrictMode |
| A-16 | Regla de «stock bajo» duplicada en dos vistas | Baja | Una sola definición en el dominio |
| A-17 | Código muerto y nombres engañosos | Baja | `deleted?` sin uso, `low_stock_alerts` que devolvía rotación |

## 2. Método de auditoría

1. **Medición, no estimación.** Latencia por endpoint con `curl` (promedio de 5
   ejecuciones) a través del gateway, es decir, la latencia que percibe el usuario.
2. **Prueba a escala.** Se cargaron **50.000 productos y 50.000 clientes**
   sintéticos para que el planificador de PostgreSQL eligiera planes reales, y se
   compararon con `EXPLAIN (ANALYZE, BUFFERS)`. Los datos de prueba se eliminaron
   al terminar.
3. **Revisión de código** servicio por servicio buscando condiciones de carrera,
   rutas sin usar y supuestos implícitos.
4. **Verificación funcional** con la prueba de humo (33 comprobaciones al inicio, 44 al cierre).
5. **Prueba de manipulación**: se editó una fila de la bitácora con SQL para comprobar que la verificación la detecta.

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

### A-04 · La auditoría de seguridad se borraba a sí misma — Alta

El código registraba el intento fallido y el robo de token **dentro de la misma
transacción** de la petición:

```java
if (!passwordEncoder.matches(...)) {
    auditService.record(..., "LOGIN_FAILED", ...);   // se inserta...
    throw DomainException.unauthorized(...);          // ...y el rollback lo borra
}
```

Los dos eventos que más importan en una investigación forense (intentos de acceso
fallidos y reutilización de un token robado) **desaparecían de la bitácora**. Peor
aún: en el caso de reuso, la revocación de todas las sesiones del usuario ocurría
en esa misma transacción, así que el sistema **detectaba el robo y no cerraba nada**.

**Corrección**: dos caminos según la semántica del evento.

| Ruta | Transacción | Por qué |
| --- | --- | --- |
| Éxito (login, registro, rotación) | La de la operación | No debe existir un registro de algo que finalmente no ocurrió |
| Fallo (`LOGIN_FAILED`, `REFRESH_REUSE_DETECTED`) | **Independiente** (`REQUIRES_NEW`) | El registro debe sobrevivir al rollback |

La revocación de la familia de tokens se movió a `SecurityIncidentService`, que abre
su propia transacción: al no existir en ella ningún bloqueo de la cadena, tampoco
puede producirse un bloqueo muto con el `advisory lock` de auditoría.

Verificado en el humo: el intento fallido y el reuso **aparecen en la bitácora**.

### A-05 · La llave JWT era efímera — Alta

`TokenService` generaba un par RSA en memoria cuando no había llave configurada, y
el `docker-compose.yml` **nunca pasaba `KUBO_JWT_PRIVATE_KEY`**. Consecuencia: cada
reinicio del servicio de identidad invalidaba **todas las sesiones** de todos los
usuarios. Se descubrió porque el propio humo falló en cascada tras reconstruir el
contenedor.

**Corrección**: el compose propaga la llave y el entorno de demostración usa una
llave RSA real generada con `openssl`, guardada en el `.env` (no versionado).
Verificado: el mismo token sigue siendo válido **después** de reiniciar el servicio.

Además se redujo la ventana de caché del JWKS en el gateway (30 s → 10 s): si algún
día se rota la llave, el gateway reconoce el nuevo `kid` casi de inmediato. El
tiempo de espera existe para que nadie pueda saturar el servicio de identidad
pidiendo el JWKS con `kid` inventados.

### A-06 · Cadena de auditoría con condición de carrera — Alta

`record()` leía el último hash y luego insertaba. Dos peticiones concurrentes
podían leer el mismo hash anterior y **partir la cadena**: dos entradas apuntando
al mismo predecesor, y la manipulación dejaba de ser detectable.

**Corrección**: `pg_advisory_xact_lock` al inicio de la transacción. Serializa la
escritura de la cadena sin bloquear ninguna tabla y se libera automáticamente al
terminar la transacción.

### A-09 · Numeración de ventas con `COUNT(*)` — Media

Cada venta contaba todas las ventas del negocio (verificado con `EXPLAIN`: `Index
Only Scan` sobre 50.000 filas). Ahora se toma el **máximo** del consecutivo, que el
índice único `(tenant_id, number)` resuelve en tiempo logarítmico. La restricción
única sigue protegiendo la concurrencia y el reintento ya existente la resuelve.

### A-06 a A-08 · Integridad de la bitácora

| Hallazgo | Corrección |
| --- | --- |
| Condición de carrera al encadenar hashes (A-06) | `pg_advisory_xact_lock` al inicio de la transacción: serializa la escritura sin bloquear tablas |
| Verificación inalcanzable y mal definida (A-07) | Nuevo `GET /audit/verify`: verifica que cada entrada **enlace** con la anterior y que su **hash corresponda al contenido**. Se expone el hash más antiguo de la ventana para poder encadenar verificaciones |
| Hash con nanosegundos y columna con microsegundos (A-08) | El instante se trunca a microsegundos antes de calcular el hash: de otro modo la verificación fallaría siempre |

**Prueba de manipulación** (ejecutada): se editó una fila con SQL y la verificación
devolvió `chainIntact: false`. Una edición parcial rompe la verificación; falsificar
la bitácora completa exigiría recalcular toda la cadena.

### A-09 a A-17 · Consistencia, contrato, interfaz y limpieza

| Hallazgo | Corrección |
| --- | --- |
| Numeración de ventas con `COUNT(*)` (A-09) | Se toma el **máximo** del consecutivo: el índice único lo resuelve en tiempo logarítmico |
| **`customers/stats` sin envoltorio `data`** (A-10) | Unificado al contrato del resto de la API. Además el gateway cae al cuerpo completo si un servicio no envuelve: una inconsistencia degrada la forma, no borra una vista |
| Un error de render dejaba la pantalla en blanco (A-11) | `ErrorBoundary` con mensaje entendible, botón de recarga y registro del error |
| `Customer.find_by_document` inalcanzable (A-12) | `GET /api/v1/customers/by-document/:document` — el caso de uso real del mostrador |
| `GET /users` devolvía la tabla completa (A-13) | Paginación con tamaño acotado en el servidor (máx. 100) |
| **Prueba del ERP con expectativa mal calculada** (A-14) | Esperaba `41650` donde el resultado correcto es `29750`. La prueba **nunca se había ejecutado**: el contenedor se quedaba sin memoria al compilar el entorno de pruebas. Ahora corre en 4/4 |
| Efectos secundarios en actualizadores de estado (A-15) | Validaciones movidas fuera: sin avisos duplicados en StrictMode |
| Regla de «stock bajo» duplicada (A-16) | Una sola definición en el dominio (`Product.low_stock?/1`) usada por las dos vistas |
| Código muerto y nombres engañosos (A-17) | `Customer#deleted?` eliminado; `low_stock_alerts` renombrado a `product_rotation` (devolvía rotación, no alertas) |

### Nota de migración: bitácora anterior a la corrección

Los registros de auditoría creados **antes** de A-08 se hashearon con nanosegundos,
por lo que no son verificables con el algoritmo corregido. En un sistema en
producción esto exigiría **versionar el algoritmo** (una columna `hash_version`) y
mantener el verificador anterior para el histórico. Aquí, al ser datos de
demostración, la bitácora se reinició para partir de una cadena verificable. Queda
como pendiente P-23.

## 5. Pendientes priorizados

> **Catálogo cerrado (2026-10-03).** Los 31 pendientes están resueltos y
> verificados; el detalle de cada uno, con su evidencia, vive en
> [`11-plan-de-cierre.md`](11-plan-de-cierre.md). Resumen por fase:
>
> | Fase | Pendientes cerrados |
> | --- | --- |
> | F1 · Confiabilidad | P-01, P-02, P-03, P-04, P-05, P-11, P-23, P-27, P-31 |
> | F2 · Calidad | P-06, P-07, P-08, P-09, P-10, P-12, P-13, P-14, P-26 |
> | F3 · Núcleo comercial | P-15, P-16, P-20, P-21, P-24 |
> | F4 · Diferenciadores | P-17, P-18, P-19, P-22, P-25, P-30 |
> | F5 · Escala | P-28, P-29 |
> | F6 · Operación | F6.1–F6.6 (uso, cobro, panel, respaldos, pasarela) |
>
> Evidencia de cierre: `make ci` 10/10 (secretos, suites, contratos 23/23, humo
> 184/184, E2E 5/5), gates de cobertura por servicio (IAM 85.2 %, analítica
> ≥ 80 %, gateway 95.6 %, CRM 100 %, web 100 % de líneas, ERP ratchet 36 %),
> `make bus-drill` 4/4 y `make restore-drill` 14/14.
>
> Las tablas de §5.1–5.3 conservan el catálogo original con el riesgo y el
> esfuerzo estimados al momento de la auditoría; su estado final es **cerrado**.

### 5.1 Bloqueantes para un negocio real

| ID | Pendiente | Riesgo | Esfuerzo |
| --- | --- | --- | --- |
| P-01 | ***Transactional outbox*** | Un evento se pierde si el proceso muere justo tras el `commit`: el tablero no reflejaría una venta ya cobrada | 1–2 días |
| P-02 | **Activar RLS** con interceptor de transacción | Hoy el aislamiento entre negocios depende de que toda consulta filtre por `tenant_id`. Un olvido no se detecta | 2–3 días |
| P-03 | **Refresh token en cookie `httpOnly`** (BFF) | Un XSS podría robar el token de refresco | 2 días |
| P-04 | **Recuperación de contraseña** | Hoy solo un administrador puede restablecerla desde la base | 1 día |
| P-05 | **Respaldos automatizados + simulacro de restauración** | Documentado pero no ejecutado: un respaldo sin probar no es un respaldo | 1 día |
| P-27 | **TLS/HTTPS en la instalación** (Caddy y verificación en el humo) | Sin cifrado en tránsito, las credenciales viajan en claro por la red del local | 1 día |

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
| P-23 | **Versionar el algoritmo de hash de auditoría** | Un cambio de algoritmo deja el histórico sin verificar (ver nota de migración) | 1 día |
| P-26 | **Accesibilidad automatizada** (axe en CI) | Hoy solo hay revisión manual de contraste y foco | 0.5 día |
| P-30 | **Segundo factor (TOTP)** para el propietario | Robo de credenciales del administrador | 1–2 días |
| P-31 | **Límite de tasa por usuario** (no solo por negocio o IP) | Abuso desde una cuenta comprometida | 0.5 día |

### 5.3 Alcance funcional (lo que separa el MVP de un producto)

| ID | Módulo | Valor para el negocio |
| --- | --- | --- |
| P-15 | **Compras y proveedores** | Cierra el ciclo del inventario: hoy solo entran mercancías por ajuste manual |
| P-16 | **Sesiones de caja** (apertura, cierre, arqueo) | Control de efectivo por turno: es lo primero que pide un tendero |
| P-17 | **Vertical Packs** (retail, servicios, restaurantes, agro) | Convierte Kubo en multi-rubro sin duplicar código (ya diseñado) |
| P-18 | **Facturación electrónica DIAN** (UBL 2.1, CUFE, QR) | Requisito legal para facturar; exige ser Proveedor Tecnológico |
| P-19 | **Notificaciones** (WhatsApp / correo) | Cobranza, confirmaciones y avisos de stock: el quinto servicio planificado |
| P-20 | **Usuarios y roles en la interfaz** | Hoy el API existe pero el dueño no puede crear vendedores sin ayuda técnica |
| P-21 | **Reportes exportables** (CSV/PDF) y **comprobante de venta imprimible** (ticket) | Contabilidad y bancos piden soportes; el mostrador necesita el comprobante |
| P-22 | **Multi-bodega** y transferencias | Para negocios con más de un punto |
| P-24 | **Importación de datos** (Excel/CSV y ruta Dolibarr) | Sin esto, digitalizar un catálogo existente es manual: la primera barrera de adopción |
| P-25 | **Servicio de Documentos** (adjuntos y plantillas) | Completa el quinto servicio planificado junto con las notificaciones |

### 5.4 Escala (Fase 5, backlog declarado)

| ID | Pendiente | Por qué |
| --- | --- | --- |
| P-28 | mTLS entre gateway y servicios | Movimiento lateral dentro del clúster |
| P-29 | Rotación de claves de cifrado de campo (KEK/DEK) | Compromiso de una clave a largo plazo |

Líneas declaradas sin ID: instalación remota (Terraform/Ansible), multi-tenant SaaS
(zona horaria por negocio y onboarding), app móvil nativa y operador de respaldos.

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

| Cambio | Motivo | ADR a escribir | Fase |
| --- | --- | --- | --- |
| Outbox transaccional | Único punto donde el sistema puede perder un dato ya confirmado al usuario | ADR-0009 | Fase 1 |
| Interceptor de tenant + RLS activo | Convertir el aislamiento en garantía del motor, no del programador | ADR-0010 | Fase 1 |
| BFF como capa formal | Ya existe para el tablero; conviene declararlo patrón del gateway y no un caso puntual | ADR-0011 | Fase 2 |
| Zona horaria por negocio en la tabla `tenants` | Hoy es global por instalación; en multi-tenant debe ser un atributo del negocio | ADR-0012 | Fase 4 |

### Escalado

| Nivel | Qué hacer | Cuándo |
| --- | --- | --- |
| 1 negocio | Un VPS, Docker Compose (estado actual) | Ahora |
| Varias cajas | Escalar `kubo-erp` (sin estado) y separar PostgreSQL a su instancia | > 5 cajas |
| Varios negocios | Activar RLS, zona horaria por tenant, BFF, caché de lecturas | Producto SaaS |
| Clúster | k3s + mTLS entre servicios + operador de respaldos | > 50 negocios |

## 7. Plan de mejora

El plan de cierre completo vive en [`11-plan-de-cierre.md`](11-plan-de-cierre.md).
Resumen:

| Fase | Foco | Duración estimada (30 h/semana) |
| --- | --- | --- |
| 0 | Consistencia de la documentación | 2–3 h (completada) |
| 1 | Confiabilidad: outbox, RLS, cookie, respaldos, TLS | ≈3 semanas |
| 2 | Calidad y observabilidad: CI, OTel, pruebas, accesibilidad | ≈4 semanas |
| 3 | Núcleo comercial: compras, caja, usuarios, importación, comprobantes | 5–7 semanas |
| 4 | Diferenciadores: verticales, DIAN, notificaciones, multi-bodega | 5–6 semanas |
| 5 | Escala: k3s + mTLS, SaaS multi-tenant, app móvil | backlog declarado |

Cada fase cierra solo con su criterio medido; el detalle de pasos, IDs y criterios
de aceptación está en el documento enlazado.

## 8. Conclusión

El sistema pasó de **«funciona»** a **«es correcto y sostiene la escala de su
mercado»**. La primera ronda arregló la **verdad del dato** (un indicador que
mentía a partir de las 19:00 y una tarjeta que mostraba ceros sin fallar) y el
**rendimiento** (búsquedas que recorrían la tabla completa, un tablero que pedía
siete viajes). La segunda ronda cerró la **seguridad**: la auditoría registraba los
eventos de éxito pero borraba los de fallo —justo los que sirven para investigar—,
y la detección de robo de token no llegaba a cerrar las sesiones.

Ninguno de esos defectos aparecía en una prueba funcional: el sistema respondía
200, el humo pasaba en verde y la interfaz se veía bien. Los encontró la revisión
del **código y de los datos**, no la de las respuestas.

Lo que falta no es cosmético: son las piezas que convierten una demostración
técnica sólida en un producto que un tendero puede usar todos los días sin
sobresaltos — **garantía de entrega de eventos, aislamiento impuesto por el motor,
automatización de calidad y los módulos que el negocio realmente pide** (compras,
caja, usuarios). El plan de las fases 1 a 4 está ordenado por riesgo, no por
lucimiento: primero lo que puede perder o mezclar datos, después lo que evita
regresiones, y al final lo que amplía el mercado.

## 9. Cómo se sostiene este nivel de rigor

La auditoría no fue una lista de buenas intenciones: cada hallazgo se **midió**
(`EXPLAIN ANALYZE` con 50.000 filas sintéticas, latencia promedio de 5 ejecuciones,
`docker stats`) y cada corrección se **verificó** con una comprobación añadida al
humo. Once de las 44 comprobaciones existen porque un defecto concreto obligó a
escribirlas.

Ese es el criterio para presentar el MVP con tranquilidad: no que no tenga fallos
—los tenía, diecisiete— sino que **cada fallo tiene ahora una prueba que lo vigila**.

## 10. Auditoría de seguridad final (2026-10-03)

Revisión estática OWASP sobre el estado final del sistema, después de las fases
0–6. Se encontraron seis hallazgos residuales y **los seis quedaron atendidos**.

| ID | Hallazgo | Severidad | Resolución |
| --- | --- | --- | --- |
| KUBO-01 | `SECRET_KEY_BASE` de CRM/ERP con valor por defecto en compose | **Crítica** | compose exige la variable (`:?`) y Rails falla en producción si falta: el arranque ya no puede firmar con una clave pública |
| KUBO-02 | Semilla activada por defecto con credenciales conocidas | Alta | `KUBO_SEED_ENABLED` por defecto `false` (el `.env` local lo activa), contraseñas obligatorias en compose y el seeder se omite sin `KUBO_ADMIN_PASSWORD` |
| KUBO-03 | Cookie de refresco sin `Secure` en producción | Alta | nginx propaga el esquema original de Caddy y Ansible despliega solo el borde TLS (3080/3443) con `KUBO_COOKIE_SECURE=true` |
| KUBO-04 | Contenedores IAM y ERP como root | Media | IAM corre como usuario `kubo`; ERP ajusta el volumen de documentos y baja privilegios con `gosu` en el entrypoint |
| KUBO-05 | `erl_crash.dump` en el historial de git | Media | **Resuelto**: historial purgado (`filter-branch` + `gc`), el objeto no existe en ningún commit ni en el almacén, y el archivo se retiró del disco y se ignoró |
| KUBO-06 | Cabeceras internas: TLS por defecto apagado y roles sin whitelist | Media | `KUBO_INTERNAL_TLS` fail-closed por defecto (las pruebas lo apagan de forma explícita) y whitelist de roles en IAM y ERP |

Evidencia: `make ci` 10/10, humo **184/184** tras desplegar el endurecimiento,
IAM 79 pruebas, ERP 55 pruebas, `make bus-drill` 4/4 y `make restore-drill` 14/14.
