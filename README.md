# Documentación de Kubo

Documentación técnica y funcional del sistema. Está pensada para leerse en orden
la primera vez y para consultarse por secciones después.

## Contenido

| Documento | Para quién | Qué responde |
| --- | --- | --- |
| [01 — Arquitectura](01-arquitectura.md) | Técnico | ¿Cómo está construido y por qué así? Diagramas C4, flujos y atributos de calidad |
| [02 — Modelo de datos](02-modelo-datos.md) | Técnico | ¿Qué se guarda, dónde y con qué reglas de integridad? |
| [03 — API](03-api.md) | Desarrollador | ¿Qué endpoints existen y cómo se usan? Ejemplos con `curl` |
| [04 — Seguridad](04-seguridad.md) | Técnico · Auditoría | ¿Cómo se protege la información y qué falta? |
| [05 — Despliegue](05-despliegue.md) | Operación | ¿Cómo se instala, opera y respalda? |
| [06 — Manual de usuario](06-manual-usuario.md) | Dueño del negocio | ¿Cómo se usa el sistema día a día? |
| [07 — Pruebas](07-pruebas.md) | Calidad | ¿Qué se probó, cómo y con qué resultado? |
| [08 — Trazabilidad](08-trazabilidad.md) | Evaluación | ¿Qué requisito se cumplió y dónde se comprueba? |
| [09 — Guion de demostración](09-demo-guion.md) | Presentación | Guion del video de 6 minutos |
| [10 — Auditoría técnica](10-auditoria.md) | Arquitectura · Calidad | Hallazgos, mediciones, correcciones aplicadas y catálogo de pendientes |
| [11 — Plan de cierre](11-plan-de-cierre.md) | Gestión · Arquitectura | ¿Qué falta, en qué orden y con qué criterio se cierra cada fase? |
| [12 — Runbook de operación](12-runbook-operacion.md) | Operación | La semana uno del negocio: chequeo diario, playbooks y métricas |
| [ADRs](adr/) | Arquitectura | Las veintiséis decisiones que definen el sistema |

## Decisiones de arquitectura (ADR)

| ADR | Decisión |
| --- | --- |
| [0001](adr/ADR-0001-microservicios-monolito-modular.md) | Microservicios con monolito modular interno |
| [0002](adr/ADR-0002-polyrepo-contratos.md) | Polyrepo con contratos como fuente de verdad |
| [0003](adr/ADR-0003-multitenancy-hibrido.md) | Multi-tenancy híbrido: `tenant_id` + RLS activo |
| [0004](adr/ADR-0004-poliglotismo.md) | Poliglotismo deliberado: un lenguaje por contexto |
| [0005](adr/ADR-0005-eventos-rabbitmq.md) | Eventos con RabbitMQ y publicador tolerante a fallos |
| [0006](adr/ADR-0006-cifrado-campos.md) | Cifrado de campos personales con AES-256-GCM |
| [0007](adr/ADR-0007-jwt-rs256-jwks.md) | JWT RS256 con JWKS: la llave privada no sale del IAM |
| [0008](adr/ADR-0008-alcance-mvp.md) | Alcance declarado del MVP y recortes conscientes |
| [0009](adr/ADR-0009-outbox-transaccional.md) | Outbox transaccional para la entrega de eventos |
| [0010](adr/ADR-0010-rls-activo.md) | RLS activo con interceptor de transacción |
| [0011](adr/ADR-0011-bff-capa-formal.md) | BFF como capa formal del gateway |
| [0012](adr/ADR-0012-zona-horaria-por-negocio.md) | Zona horaria por negocio |
| [0013](adr/ADR-0013-vertical-packs.md) | Vertical Packs: el vertical como dato del negocio |
| [0014](adr/ADR-0014-puerto-facturacion-dian.md) | Facturación electrónica DIAN como puerto enchufable |
| [0015](adr/ADR-0015-segundo-factor-totp.md) | Segundo factor TOTP del propietario |
| [0016](adr/ADR-0016-stock-por-bodega.md) | Stock por bodega y transferencias |
| [0017](adr/ADR-0017-puerto-notificaciones.md) | Puerto de notificaciones y buzón del negocio |
| [0018](adr/ADR-0018-documentos.md) | Documentos en el ERP con puerto de almacenamiento |
| [0019](adr/ADR-0019-rotacion-de-claves.md) | Rotación de claves de cifrado de campo (KEK/DEK) |
| [0020](adr/ADR-0020-mtls-interno.md) | mTLS en la malla interna |
| [0021](adr/ADR-0021-multi-tenant-saas.md) | Multi-tenant SaaS como modo de despliegue |
| [0022](adr/ADR-0022-operador-de-respaldos.md) | Operador de respaldos con verificación de restauración |
| [0023](adr/ADR-0023-app-movil.md) | App móvil: la PWA primero, Capacitor cuando el negocio lo pida |
| [0024](adr/ADR-0024-superficie-del-operador.md) | Superficie del operador: script hoy, panel cuando haya rol |
| [0025](adr/ADR-0025-rol-de-plataforma.md) | Rol de plataforma y panel del operador |
| [0026](adr/ADR-0026-puerto-de-cobro.md) | Puerto de cobro y pasarela de pago |

Las 26 ADR están aceptadas; su estado y la fase en que se cerraron se detallan
en [`08-trazabilidad.md`](08-trazabilidad.md) §4.

## Documentación por servicio

Cada repositorio tiene su propio README con lo específico:

- [`kubo-gateway`](../kubo-gateway/README.md) — enrutamiento, JWT, límites de tasa
- [`kubo-iam`](../kubo-iam/README.md) — identidad, tokens, auditoría
- [`kubo-crm`](../kubo-crm/README.md) — clientes y cifrado de campos
- [`kubo-erp`](../kubo-erp/README.md) — catálogo, kardex, ventas y eventos
- [`kubo-analytics`](../kubo-analytics/README.md) — proyección e indicadores
- [`kubo-web`](../kubo-web/README.md) — PWA y experiencia de usuario
- [`kubo-infra`](../kubo-infra/README.md) — orquestación, semilla y pruebas

## Generar el PDF consolidado

```bash
./kubo-docs/scripts/build-pdf.sh
```

Genera `Kubo-Documentacion.pdf` en la raíz del workspace, con todos los
documentos y los ADR unidos. Requiere Google Chrome o Chromium instalado.
