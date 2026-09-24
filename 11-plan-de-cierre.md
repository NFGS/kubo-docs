# 11 — Plan de cierre

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-23 |
| Objetivo | Producto comercializable en la región (Fases 0–4); la Fase 5 queda como backlog declarado |
| Punto de partida | 44/44 comprobaciones en verde · 10 contenedores sanos · 9 repositorios limpios |
| Dedicación | ~30 h/semana (≈ 3.75 jornadas de 8 h) |
| Estado | Fases 0–2 completadas (P-08 parcial) · Fase 3 en curso · Fases 4–5 planificadas |

Este documento ordena los 31 pendientes de [`10-auditoria.md`](10-auditoria.md) en
fases con criterio de cierre medible. No sustituye a la auditoría: la usa como
catálogo de origen.

## 1. Decisiones registradas

| Decisión | Elección |
| --- | --- |
| Objetivo del cierre | Producto comercializable (Fases 0–4; Fase 5 como backlog declarado) |
| Primer módulo de la Fase 3 | Compras + Caja |
| Dedicación | ~30 h/semana |

## 2. Hallazgos de la revisión de cierre (R-1…R-9)

La revisión que originó este plan encontró nueve inconsistencias. Todas quedaron
corregidas en la Fase 0 o asignadas a una fase con ID.

| ID | Hallazgo | Resolución | Estado |
| --- | --- | --- | --- |
| R-1 | IDs de hallazgos duplicados en la auditoría (las dos rondas colisionaron: cuatro secciones A-04/A-05) | Renumerados a **A-06** y **A-09** en §4 | Corregido |
| R-2 | La importación de datos (Excel/CSV/Dolibarr) no estaba en ningún plan | **P-24** · Fase 3 | Planificado |
| R-3 | El quinto servicio figuraba como «planificado» en trazabilidad pero sin fase | **P-25** Documentos + **P-19** Notificaciones · Fase 4 | Planificado |
| R-4 | Faltaban los ADR 0009–0012 que la propia auditoría exige | 0009 y 0010 · Fase 1 · 0011 · Fase 2 · 0012 · Fase 4 | Planificado |
| R-5 | La auditoría de accesibilidad (axe) estaba en pruebas pendientes sin ID | **P-26** · Fase 2 | Planificado |
| R-6 | TLS/HTTPS solo estaba en la guía de despliegue, no en el plan | **P-27** · Fase 1 | Planificado |
| R-7 | RLS versionada solo en `kubo-iam`, contra lo que afirmaba `04-seguridad.md` §4.3 | Script para CRM y ERP dentro de **P-02** · Fase 1 | Planificado |
| R-8 | Pendientes de `04-seguridad.md` §10 sin ID ni fase (mTLS, rotación de claves, 2FA, rate limiting por usuario) | **P-28…P-31** con fase asignada | Planificado |
| R-9 | Conteos y referencias de fase desactualizados (8/9 contenedores, 37 comprobaciones, «16 pendientes») | Corregidos en `01`, `04`, `05`, `07`, `08`, `09` y `10` | Corregido |

## 3. Fases

### Fase 0 — Consistencia (completada, 2–3 h)

| Paso | Acción | Estado |
| --- | --- | --- |
| F0.1 | Renumerar los A-04/A-05 duplicados (A-06, A-09) | Hecho |
| F0.2 | Corregir conteos y la afirmación de RLS | Hecho |
| F0.3 | Incorporar P-24…P-31 con ID y fase | Hecho |
| F0.4 | Renumerar fases 0–5 en todos los documentos y ADR | Hecho |
| F0.5 | Crear este documento, enlazarlo, añadirlo al PDF y commit | Hecho |

**Criterio**: el resumen y el detalle de la auditoría coinciden y el plan es
navegable desde el índice.

### Fase 1 — Confiabilidad (≈3 semanas) — bloqueante para un negocio real

| Paso | Pendiente | ID | Esfuerzo |
| --- | --- | --- | --- |
| F1.1 | Outbox transaccional + publicador de barrido + ADR-0009 | P-01 | 1–2 d |
| F1.2 | Interceptor de tenant + RLS en las tres bases (escribir el script en CRM y ERP) + ADR-0010 | P-02 · R-7 | 2–3 d |
| F1.3 | Refresh token en cookie `httpOnly` + `SameSite` (BFF) | P-03 | 2 d |
| F1.4 | Recuperación de contraseña por correo | P-04 | 1 d |
| F1.5 | Respaldos automatizados + simulacro cronometrado | P-05 | 1 d |
| F1.6 | Bloqueo de cuenta tras N intentos fallidos | P-11 | 0.5 d |
| F1.7 | Límite de tasa por usuario | P-31 | 0.5 d |
| F1.8 | Versionado del algoritmo de hash de auditoría (`hash_version`) | P-23 | 1 d |
| F1.9 | TLS en la instalación (Caddy + verificación en el humo) | P-27 | 1 d |

**Criterio de aceptación**: prueba de caída del bus sin pérdida de eventos · una
consulta sin filtro de tenant devuelve cero filas · restauración completa
cronometrada por debajo de 4 h · `make smoke` con ≥ 55 comprobaciones en verde.

**Estado: completada (2026-09-24).** Evidencia: `make smoke` **73/73** ·
`make bus-drill` **4/4** (venta con el bus caído, evento `PENDING`, publicación al
volver) · `make restore-drill` **14/14** con RTO de 6 s · consulta sin contexto =
**0 filas** en IAM, CRM y ERP · ADR-0009 y ADR-0010 aceptados.

Dos defectos reales aparecieron al integrar la fase y quedaron corregidos:

1. **RLS en transacciones `REQUIRES_NEW`**: el contador de intentos fallidos y la
   revocación de la familia de tokens corrían en otra conexión sin contexto y
   actualizaban cero filas en silencio (el sistema detectaba el robo y no cerraba
   nada). `SecurityIncidentService` ahora fija su propia marca de sistema, y el
   humo comprueba la revocación completa de la familia.
2. **Transacciones anidadas de Ecto sin savepoint**: un `Repo.rollback` de negocio
   (stock insuficiente) abortaba la transacción externa del interceptor y tumbaba
   la petición después de responder. `Repo.scoped_transaction/1` usa savepoints.
   En el mismo paso se corrigió un contrato roto del ERP: `Catalog.adjust_stock`
   devolvía `{:ok, {product, movement}}` y el controlador esperaba
   `{:ok, product, movement}` (el ajuste de inventario respondía 500).

### Fase 2 — Calidad y observabilidad (≈4 semanas)

| Paso | Pendiente | ID | Esfuerzo |
| --- | --- | --- | --- |
| F2.1 | CI por repositorio (lint, pruebas, SAST, secretos, SBOM) + ADR-0011 | P-06 | 2–3 d |
| F2.2 | OpenTelemetry en los cuatro lenguajes → Grafana/Loki/Tempo | P-07 | 3 d |
| F2.3 | Pruebas de integración con Testcontainers | P-08 | 3 d |
| F2.4 | Contratos ejecutables (OpenAPI/Pact) | P-09 | 2 d |
| F2.5 | E2E (Playwright) + carga (k6, 50 cajas) | P-10 | 2 d |
| F2.6 | Caché del service worker por usuario + axe en CI | P-12 · P-26 | 1 d |
| F2.7 | Paginación en productos, ventas y movimientos + digests de imagen | P-13 · P-14 | 1.5 d |

**Criterio de aceptación**: una regresión de seguridad o de contrato bloquea el
merge · p95 del POS por debajo de 300 ms con 50 cajas · cobertura de dominio ≥ 80 %.

**Estado: completada (2026-09-24), con P-08 parcial.** Evidencia:

- **P-06 CI**: `.gitlab-ci.yml` en los ocho repositorios (pruebas, SAST, secretos,
  dependencias) y gate local `make ci` → **9/9 en verde** (secretos, suites,
  contratos, humo, E2E).
- **P-07 OpenTelemetry**: collector OTLP propio (`kubo-otel`) y los **cinco
  servicios exportando trazas** (gateway, IAM, CRM, ERP y analítica), con
  `make observability` para el stack visual (Tempo + Grafana). El humo verifica
  que el collector recibe trazas.
- **P-09 contratos**: `kubo-docs/api/openapi.json` + `make contracts` →
  **10/10 contratos** validados con Ajv contra la API viva.
- **P-10 carga y E2E**: `make load` (50 cajas) → **100 % de ventas exitosas,
  p95 = 149.76 ms**; Playwright + axe → **4/4**, con tres defectos reales de
  accesibilidad corregidos (contraste y un `select` sin nombre accesible).
- **P-12 · P-13 · P-14 · P-26**: caché por sesión, paginación real con totales
  (los listados mentían en `total`), digests de imágenes y axe en CI.
- **Cobertura**: IAM **85.5 %** de dominio (gate JaCoCo ≥ 80 % en `mvn verify`)
  y analítica **91 %** en su módulo de dominio (gate `--cov-fail-under=80`).
- **P-08 parcial**: integración con Testcontainers en IAM (RLS + cadena de
  auditoría contra PostgreSQL real, 2 pruebas). Queda pendiente replicarlo en
  analítica y los demás servicios.

Defectos reales corregidos durante la fase (además de los de implementación):
numeración de ventas con `ON CONFLICT` que devolvía un id inexistente, RLS con
subconsulta inestable bajo concurrencia (denormalizado `tenant_id` en
`sale_items`), interceptor de tenant con `Repo.rollback` fuera de transacción
real, y la cobertura de listados que reportaba el tamaño de página como total.

### Fase 3 — Núcleo comercial (5–7 semanas) — orden aprobado: Compras + Caja

| Paso | Pendiente | ID | Esfuerzo |
| --- | --- | --- | --- |
| F3.1 | Compras y proveedores | P-15 | 5–7 d |
| F3.2 | Sesiones de caja (apertura, cierre, arqueo) | P-16 | 5–7 d |
| F3.3 | Usuarios y roles en la interfaz | P-20 | 3–4 d |
| F3.4 | Importación de datos (Excel/CSV; ruta Dolibarr) | P-24 | 3–4 d |
| F3.5 | Reportes exportables + comprobante de venta imprimible | P-21 | 3–4 d |

**Criterio de aceptación**: un negocio carga su catálogo desde Excel, abre caja,
vende, imprime el comprobante y cierra el turno con arqueo cuadrado.

**Estado: en curso (2026-09-24).** Completado el primer paso aprobado:

- **P-15 Compras y proveedores**: dominio completo en el ERP (proveedores con
  borrado lógico, compras con detalle, numeración atómica `C-000001`, RLS en las
  tres tablas nuevas), la compra suma inventario, deja el kardex (`PURCHASE`),
  actualiza el costo del producto **sin IVA** y emite `purchase.received` por la
  bandeja de salida; la anulación revierte el stock (`PURCHASE_VOID`).
- API expuesta por el gateway, 9 comprobaciones nuevas en el humo (87 en total),
  2 contratos OpenAPI nuevos (10 en total) y pantalla **Compras** en la PWA
  (proveedores, registro con líneas y anulación), auditada con axe.
- Pendiente de la fase: **P-16 sesiones de caja**, P-20 usuarios y roles en la
  interfaz, P-24 importación de datos y P-21 reportes y comprobante.

### Fase 4 — Diferenciadores (5–6 semanas)

| Paso | Pendiente | ID | Esfuerzo |
| --- | --- | --- | --- |
| F4.1 | Vertical Packs (retail, servicios, restaurantes, agro) | P-17 | 4–6 d |
| F4.2 | Facturación electrónica DIAN (UBL 2.1, CUFE, QR) como puerto enchufable | P-18 | 4–6 d |
| F4.3 | Notificaciones (WhatsApp/correo) + servicio de Documentos | P-19 · P-25 | 4–6 d |
| F4.4 | Multi-bodega y transferencias | P-22 | 2–3 d |
| F4.5 | Segundo factor (TOTP) del propietario | P-30 | 1–2 d |
| F4.6 | ADR-0012: zona horaria por negocio en la tabla `tenants` | — | 0.5 d |

**Criterio de aceptación**: dos verticales activables sin tocar el núcleo · factura
DIAN emitida en ambiente de habilitación · notificación real entregada ·
transferencia entre dos bodegas con kardex en ambas.

### Fase 5 — Escala (backlog declarado)

| ID | Línea de trabajo |
| --- | --- |
| P-28 | mTLS entre gateway y servicios |
| P-29 | Rotación de claves de cifrado de campo (KEK/DEK) |
| — | Instalación remota (Terraform/Ansible) |
| — | Multi-tenant SaaS (onboarding y zona horaria por negocio) |
| — | App móvil nativa y operador de respaldos |

## 4. Camino crítico y calendario

```mermaid
flowchart LR
  F0["Fase 0<br/>2-3 h"] --> F1["Fase 1 · Confiabilidad<br/>3 semanas"]
  F1 --> F2["Fase 2 · Calidad<br/>4 semanas"]
  F2 --> F3["Fase 3 · Núcleo comercial<br/>5-7 semanas"]
  F3 --> F4["Fase 4 · Diferenciadores<br/>5-6 semanas"]
  F4 --> F5["Fase 5 · Escala<br/>backlog declarado"]
```

| Hito | Duración | Semanas acumuladas | Estado |
| --- | --- | --- | --- |
| Fase 0 | 2–3 h | día 1 | Completada |
| Fase 1 | ≈3 semanas | 1–3 | Completada |
| Fase 2 | ≈4 semanas | 4–7 | Siguiente |
| Fase 3 | 5–7 semanas | 8–14 | Planificada |
| Fase 4 | 5–6 semanas | 15–20 | Planificada |
| **Producto comercializable** | **≈17–20 semanas** | **~4–5 meses a 30 h/semana** | — |

Con las fases 0 y 1 cerradas, el camino restante a producto comercializable es de
**≈14–17 semanas** a 30 h/semana (fases 2 a 4).

## 5. Definición de «proyecto terminado»

1. Un negocio real opera una semana completa sin soporte presencial.
2. Cero pérdida de datos: caída del bus, del proceso o del equipo → nada se
   pierde (outbox + respaldos probados).
3. Aislamiento garantizado por el motor, no por el programador (RLS activo).
4. Una regresión no llega a `main`: CI con gates de seguridad y de contrato.
5. Los 5 módulos que el negocio pide (compras, caja, usuarios, comprobantes,
   reportes) funcionando en la PWA.
6. Documentación viva: cada decisión con su ADR, cada requisito con su prueba.

## 6. Riesgos y dependencias

| Riesgo | Mitigación |
| --- | --- |
| Push a GitLab bloqueado (falta Personal Access Token) | `GITLAB_TOKEN=... make push`; los commits quedan locales mientras tanto |
| Las pruebas del ERP no corren en el contenedor de producción (OOM con 512 MB) | Comando con `-m 3g` documentado en `07-pruebas.md`; el CI de la Fase 2 las ejecuta |
| DIAN exige ser Proveedor Tecnológico autorizado | Trámite externo; la Fase 4 avanza con el puerto y deja la habilitación como cierre |
| Capturas internas de la app y video demo pendientes | Guía en `evidencia/README.md` y guion en `09-demo-guion.md`; tarea del usuario |
| La Fase 3 no debe empezar sin la Fase 1 | Orden por riesgo: no se construye producto sobre una entrega de eventos no garantizada |

## 7. Catálogo de pendientes

El catálogo completo con IDs, riesgo y esfuerzo vive en
[`10-auditoria.md` §5](10-auditoria.md); este documento lo ordena por fase y fija
el criterio de cierre de cada una.
