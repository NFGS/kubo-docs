# Documentación de Kubo
[!\[CI](https://github.com/NFGS/kubo-docs/actions/workflows/ci.yml/badge.svg)\]([https://github.com/NFGS/kubo-docs/actions/workflows/ci.yml](https://github.com/NFGS/kubo-docs/actions/workflows/ci.yml))
> Parte del proyecto **Kubo** — [kubo-workspace](https://github.com/NFGS/kubo-workspace) (ERP + CRM autoalojable para PYMES).
Documentación técnica y funcional del sistema. Está pensada para leerse en orden
la primera vez y para consultarse por secciones después.
## Contenido
<table header-row="true">
<tr>
<td>Documento</td>
<td>Para quién</td>
<td>Qué responde</td>
</tr>
<tr>
<td>[01 — Arquitectura](https://01-arquitectura.md)</td>
<td>Técnico</td>
<td>¿Cómo está construido y por qué así? Diagramas C4, flujos y atributos de calidad</td>
</tr>
<tr>
<td>[02 — Modelo de datos](https://02-modelo-datos.md)</td>
<td>Técnico</td>
<td>¿Qué se guarda, dónde y con qué reglas de integridad?</td>
</tr>
<tr>
<td>[03 — API](https://03-api.md)</td>
<td>Desarrollador</td>
<td>¿Qué endpoints existen y cómo se usan? Ejemplos con `curl`</td>
</tr>
<tr>
<td>[04 — Seguridad](https://04-seguridad.md)</td>
<td>Técnico · Auditoría</td>
<td>¿Cómo se protege la información y qué falta?</td>
</tr>
<tr>
<td>[05 — Despliegue](https://05-despliegue.md)</td>
<td>Operación</td>
<td>¿Cómo se instala, opera y respalda?</td>
</tr>
<tr>
<td>[06 — Manual de usuario](https://06-manual-usuario.md)</td>
<td>Dueño del negocio</td>
<td>¿Cómo se usa el sistema día a día?</td>
</tr>
<tr>
<td>[07 — Pruebas](https://07-pruebas.md)</td>
<td>Calidad</td>
<td>¿Qué se probó, cómo y con qué resultado?</td>
</tr>
<tr>
<td>[08 — Trazabilidad](https://08-trazabilidad.md)</td>
<td>Evaluación</td>
<td>¿Qué requisito se cumplió y dónde se comprueba?</td>
</tr>
<tr>
<td>[09 — Guion de demostración](https://09-demo-guion.md)</td>
<td>Presentación</td>
<td>Guion del video de 6 minutos</td>
</tr>
<tr>
<td>[10 — Auditoría técnica](https://10-auditoria.md)</td>
<td>Arquitectura · Calidad</td>
<td>Hallazgos, mediciones, correcciones aplicadas y catálogo de pendientes</td>
</tr>
<tr>
<td>[11 — Plan de cierre](https://11-plan-de-cierre.md)</td>
<td>Gestión · Arquitectura</td>
<td>¿Qué falta, en qué orden y con qué criterio se cierra cada fase?</td>
</tr>
<tr>
<td>[12 — Runbook de operación](https://12-runbook-operacion.md)</td>
<td>Operación</td>
<td>La semana uno del negocio: chequeo diario, playbooks y métricas</td>
</tr>
<tr>
<td>[13 — Guía del adaptador de facturación](https://13-guia-adaptador-facturacion.md)</td>
<td>Desarrollo · Integración</td>
<td>Cómo enchufar un proveedor tecnológico DIAN sin tocar el núcleo</td>
</tr>
<tr>
<td>[14 — Plan de la app móvil](https://14-plan-app-movil.md)</td>
<td>Producto · Móvil</td>
<td>¿Cuándo y cómo se envuelve la PWA con Capacitor? Disparadores, fases y criterios de aceptación</td>
</tr>
<tr>
<td>[ADRs](adr/)</td>
<td>Arquitectura</td>
<td>Las treinta y una decisiones que definen el sistema</td>
</tr>
</table>
## Decisiones de arquitectura (ADR)
<table header-row="true">
<tr>
<td>ADR</td>
<td>Decisión</td>
</tr>
<tr>
<td>[0001](adr/ADR-0001-microservicios-monolito-modular.md)</td>
<td>Microservicios con monolito modular interno</td>
</tr>
<tr>
<td>[0002](adr/ADR-0002-polyrepo-contratos.md)</td>
<td>Polyrepo con contratos como fuente de verdad</td>
</tr>
<tr>
<td>[0003](adr/ADR-0003-multitenancy-hibrido.md)</td>
<td>Multi-tenancy híbrido: `tenant_id`  • RLS activo</td>
</tr>
<tr>
<td>[0004](adr/ADR-0004-poliglotismo.md)</td>
<td>Poliglotismo deliberado: un lenguaje por contexto</td>
</tr>
<tr>
<td>[0005](adr/ADR-0005-eventos-rabbitmq.md)</td>
<td>Eventos con RabbitMQ y publicador tolerante a fallos</td>
</tr>
<tr>
<td>[0006](adr/ADR-0006-cifrado-campos.md)</td>
<td>Cifrado de campos personales con AES-256-GCM</td>
</tr>
<tr>
<td>[0007](adr/ADR-0007-jwt-rs256-jwks.md)</td>
<td>JWT RS256 con JWKS: la llave privada no sale del IAM</td>
</tr>
<tr>
<td>[0008](adr/ADR-0008-alcance-mvp.md)</td>
<td>Alcance declarado del MVP y recortes conscientes</td>
</tr>
<tr>
<td>[0009](adr/ADR-0009-outbox-transaccional.md)</td>
<td>Outbox transaccional para la entrega de eventos</td>
</tr>
<tr>
<td>[0010](adr/ADR-0010-rls-activo.md)</td>
<td>RLS activo con interceptor de transacción</td>
</tr>
<tr>
<td>[0011](adr/ADR-0011-bff-capa-formal.md)</td>
<td>BFF como capa formal del gateway</td>
</tr>
<tr>
<td>[0012](adr/ADR-0012-zona-horaria-por-negocio.md)</td>
<td>Zona horaria por negocio</td>
</tr>
<tr>
<td>[0013](adr/ADR-0013-vertical-packs.md)</td>
<td>Vertical Packs: el vertical como dato del negocio</td>
</tr>
<tr>
<td>[0014](adr/ADR-0014-puerto-facturacion-dian.md)</td>
<td>Facturación electrónica DIAN como puerto enchufable</td>
</tr>
<tr>
<td>[0015](adr/ADR-0015-segundo-factor-totp.md)</td>
<td>Segundo factor TOTP del propietario</td>
</tr>
<tr>
<td>[0016](adr/ADR-0016-stock-por-bodega.md)</td>
<td>Stock por bodega y transferencias</td>
</tr>
<tr>
<td>[0017](adr/ADR-0017-puerto-notificaciones.md)</td>
<td>Puerto de notificaciones y buzón del negocio</td>
</tr>
<tr>
<td>[0018](adr/ADR-0018-documentos.md)</td>
<td>Documentos en el ERP con puerto de almacenamiento</td>
</tr>
<tr>
<td>[0019](adr/ADR-0019-rotacion-de-claves.md)</td>
<td>Rotación de claves de cifrado de campo (KEK/DEK)</td>
</tr>
<tr>
<td>[0020](adr/ADR-0020-mtls-interno.md)</td>
<td>mTLS en la malla interna</td>
</tr>
<tr>
<td>[0021](adr/ADR-0021-multi-tenant-saas.md)</td>
<td>Multi-tenant SaaS como modo de despliegue</td>
</tr>
<tr>
<td>[0022](adr/ADR-0022-operador-de-respaldos.md)</td>
<td>Operador de respaldos con verificación de restauración</td>
</tr>
<tr>
<td>[0023](adr/ADR-0023-app-movil.md)</td>
<td>App móvil: la PWA primero, Capacitor cuando el negocio lo pida</td>
</tr>
<tr>
<td>[0024](adr/ADR-0024-superficie-del-operador.md)</td>
<td>Superficie del operador: script hoy, panel cuando haya rol</td>
</tr>
<tr>
<td>[0025](adr/ADR-0025-rol-de-plataforma.md)</td>
<td>Rol de plataforma y panel del operador</td>
</tr>
<tr>
<td>[0026](adr/ADR-0026-puerto-de-cobro.md)</td>
<td>Puerto de cobro y pasarela de pago</td>
</tr>
<tr>
<td>[0027](adr/ADR-0027-sincronizacion-4-entornos.md)</td>
<td>Sincronización de los 4 entornos con huella</td>
</tr>
<tr>
<td>[0028](adr/ADR-0028-despliegue-publico-oss.md)</td>
<td>Despliegue público de demostración 100 % open source</td>
</tr>
<tr>
<td>[0029](adr/ADR-0029-repositorios-publicos-y-ci.md)</td>
<td>Repositorios públicos, licencia MIT y CI en GitHub Actions</td>
</tr>
<tr>
<td>[0030](adr/ADR-0030-sincronizacion-bidireccional.md)</td>
<td>Sincronización bidireccional de los 4 entornos con reconciliación</td>
</tr>
<tr>
<td>[0031](adr/ADR-0031-empaquetado-movil.md)</td>
<td>Empaquetado móvil: assets locales y servidor configurable</td>
</tr>
</table>
Las 31 ADR están aceptadas; su estado y la fase en que se cerraron se detallan
en [`08-trazabilidad.md`](https://08-trazabilidad.md) §4.
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
