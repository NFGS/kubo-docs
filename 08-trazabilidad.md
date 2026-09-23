# 08 — Matriz de trazabilidad

Cada requisito del enunciado, cómo se implementó y **dónde se comprueba**. Si un
requisito no tiene evidencia verificable, aparece marcado como pendiente.

## 1. Requisitos del proyecto

| # | Requisito | Implementación | Evidencia | Estado |
| --- | --- | --- | --- | --- |
| R1 | ERP + CRM para PYMES sin acceso a tecnología, sin pagar SaaS | Instalación de un comando en el local, licencia MIT, sin dependencias de nube | `README.md` · `05-despliegue.md` · `make up` | Cumplido |
| R2 | Mínimo 4 microservicios | 5 servicios: IAM, CRM, ERP, Analítica y Documentos/Notificaciones (Fase 4, P-19 y P-25) | `docker compose ps` (10 contenedores) · `01-arquitectura.md` | Cumplido (4 desplegados) |
| R3 | Mínimo 3 tecnologías distintas | Java, Ruby, Elixir, Python, TypeScript (5) | `01-arquitectura.md` · ADR-0004 | Cumplido |
| R4 | Front dinámico y actual, nivel senior | React 19 + Vite 8 + Tailwind 4, design system con tokens, TanStack Query, gráficas, accesibilidad | `kubo-web/` · `kubo-web/src/components/ui.tsx` | Cumplido |
| R5 | Conexión con PostgreSQL y MongoDB | PostgreSQL 17 (IAM, CRM, ERP) + MongoDB 8 (analítica) | `docker compose ps` · `02-modelo-datos.md` | Cumplido |
| R6 | Interfaz UI/UX | 5 pantallas, estados de carga/vacío/error, toasts, modales accesibles, español, modo offline visible | `06-manual-usuario.md` · verificación manual en `07-pruebas.md` §3 | Cumplido |
| R7 | API Gateway | `kubo-gateway` (NestJS): validación JWT, límites de tasa, correlación, enrutamiento | `kubo-gateway/README.md` · `make smoke` bloque 3 | Cumplido |
| R8 | Cada microservicio con su base de datos | `database-per-service`: `kubo_iam`, `kubo_crm`, `kubo_erp` con roles aislados; `kubo_analytics` en MongoDB | `kubo-infra/scripts/init-db.sh` · ADR-0003 | Cumplido |
| R9 | Repositorio separado por parte del software | 9 repositorios: 5 componentes + infra + docs + web + raíz | `ls -d kubo-*/` · ADR-0002 | Cumplido |
| R10 | Documentación detallada del funcionamiento | 11 documentos + 8 ADRs + README por servicio + OpenAPI + guion de video | `kubo-docs/` · `Kubo-Documentacion.pdf` | Cumplido |
| R11 | Encriptado de datos | AES-256-GCM campo a campo + índice ciego HMAC + BCrypt + SHA-256 de refresh tokens + auditoría con cadena de hash | `make smoke` bloque 4 · `04-seguridad.md` | Cumplido |
| R12 | PWA | Service worker, manifest, instalable, cola offline en IndexedDB, sincronización automática | `curl localhost:3000/manifest.webmanifest` · `kubo-web/vite.config.ts` | Cumplido |
| R13 | JWT | RS256 con JWKS, access 15 min, refresh rotativo con detección de reuso | `make smoke` bloque 2 · ADR-0007 | Cumplido |
| R14 | Arquitectura idónea al tipo de proyecto | Microservicios con monolito modular, polyrepo, eventos, multi-tenancy híbrido | `01-arquitectura.md` · ADR-0001 a 0008 | Cumplido |
| R15 | Diseño y seguridad del proyecto | Modelo de confianza, STRIDE por servicio, OWASP, Ley 1581, límites de tasa, anti-suplantación | `04-seguridad.md` · `make smoke` bloque 3 y 8 | Cumplido |

## 2. Requisitos funcionales del dominio

| # | Requisito | Implementación | Evidencia |
| --- | --- | --- | --- |
| RF-01 | Autenticar usuarios y aislar negocios | `kubo-iam` + `tenant_id` en el token | `make smoke` bloques 2 y 8 |
| RF-02 | Gestionar clientes con datos personales protegidos | `kubo-crm` con cifrado de campo | `make smoke` bloque 4 |
| RF-03 | Gestionar catálogo de productos | `kubo-erp` CRUD + borrado lógico | `make smoke` bloque 5 |
| RF-04 | Controlar inventario con trazabilidad | Kardex `stock_movements` + proyección de stock | `make smoke` bloque 5 y 7 |
| RF-05 | Registrar ventas con descuento de inventario | Transacción con bloqueo pesimista | `make smoke` bloque 5 |
| RF-06 | Anular ventas devolviendo el inventario | `POST /sales/:id/void` | `make smoke` bloque 7 |
| RF-07 | Calcular impuestos (IVA) | Desagregación con `Decimal` en el ERP | `make smoke` bloque 5 |
| RF-08 | Tablero de indicadores del negocio | `kubo-analytics` sobre MongoDB | `make smoke` bloque 6 |
| RF-09 | Operar sin conexión | Cola IndexedDB + sincronización | Verificación manual `07-pruebas.md` §3 |
| RF-10 | Auditar las acciones sensibles | `audit_logs` con cadena de hash | `GET /api/v1/audit` |

## 3. Requisitos no funcionales

| # | Atributo | Objetivo | Cómo se sostiene | Evidencia |
| --- | --- | --- | --- | --- |
| RNF-01 | Rendimiento | Venta < 100 ms | Transacción única + Elixir | `07-pruebas.md` §5 |
| RNF-02 | Disponibilidad | El bus caído no bloquea la caja | Publicación asíncrona tolerante a fallos | ADR-0005 |
| RNF-03 | Escalabilidad | Escalar la caja sin reescribir | Servicios sin estado | `05-despliegue.md` §7 |
| RNF-04 | Seguridad | Sin datos personales legibles en la base | AES-256-GCM + índice ciego | `make smoke` bloque 4 |
| RNF-05 | Mantenibilidad | Un lenguaje por contexto con arquitectura limpia | ADR-0004 · README por servicio |
| RNF-06 | Portabilidad | Mismo artefacto en local y nube | Docker Compose | `05-despliegue.md` |
| RNF-07 | Consumo | < 2 GB de RAM en reposo | Límites por contenedor | `docker stats --no-stream` |
| RNF-08 | Usabilidad | Dueño sin conocimientos técnicos | Manual + modo simple + español | `06-manual-usuario.md` |
| RNF-09 | Observabilidad | Estado de cada servicio y su dependencia | Sondas `/health` | `make smoke` bloque 1 |
| RNF-10 | Trazabilidad | Reconstruir una operación completa | `X-Correlation-Id` propagado | Logs del gateway |

## 4. Decisiones de arquitectura

| ADR | Decisión | Estado |
| --- | --- | --- |
| 0001 | Microservicios con monolito modular interno | Aceptada |
| 0002 | Polyrepo con contratos como fuente de verdad | Aceptada |
| 0003 | Multi-tenancy híbrido (`tenant_id` hoy, RLS lista) | Aceptada |
| 0004 | Poliglotismo deliberado: un lenguaje por contexto | Aceptada |
| 0005 | Eventos con RabbitMQ y publicador tolerante a fallos | Aceptada (outbox diferido) |
| 0006 | Cifrado de campos personales con AES-256-GCM | Aceptada |
| 0007 | JWT RS256 con JWKS en el gateway | Aceptada |
| 0008 | Alcance declarado del MVP y recortes conscientes | Aceptada |

ADR planificadas: **0009** outbox transaccional (Fase 1), **0010** RLS activo
(Fase 1), **0011** BFF como capa formal (Fase 2) y **0012** zona horaria por
negocio (Fase 4). Ver [`11-plan-de-cierre.md`](11-plan-de-cierre.md).

## 5. Requisitos no cubiertos (declarados)

| Requisito | Motivo | Ruta |
| --- | --- | --- |
| *Transactional outbox* | Requiere tabla de salida y publicador de barrido | Fase 1 (P-01) |
| Activación de RLS | Requiere interceptor de transacción probado; hoy solo IAM tiene el script | Fase 1 (P-02) |
| Refresh token en cookie `httpOnly` | Exige BFF con cookies | Fase 1 (P-03) |
| Recuperación de contraseña | Requiere proveedor de correo | Fase 1 (P-04) |
| TLS/HTTPS verificado en la instalación | Documentado, pero sin verificación automática | Fase 1 (P-27) |
| CI automatizado | Las verificaciones son manuales | Fase 2 (P-06) |
| Importación de datos (Excel/CSV, ruta Dolibarr) | El MVP no la incluye: el catálogo se carga por API | Fase 3 (P-24) |
| Facturación electrónica DIAN (UBL 2.1, CUFE, QR) | Requiere ser Proveedor Tecnológico autorizado | Fase 4 (P-18) |
| Multi-rubro (Vertical Packs) | El MVP demuestra un vertical completo | Fase 4 (P-17) |
| Servicio de Documentos (adjuntos y plantillas) | El MVP despliega cuatro servicios; el quinto llega con las notificaciones | Fase 4 (P-25) |
| App móvil nativa | La PWA cubre el caso de uso | Fase 5 |
| Kubernetes | El despliegue objetivo es un local con Docker Compose | Fase 5 |

> Ningún requisito se declara cumplido sin evidencia verificable. Los recortes
> están documentados en el ADR-0008 y en esta matriz.
