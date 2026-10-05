# 05 — Despliegue y operación

## 1. Requisitos

| Recurso | Mínimo | Recomendado |
| --- | --- | --- |
| CPU | 2 núcleos | 4 núcleos |
| RAM | 4 GB | 8 GB |
| Disco | 20 GB | 60 GB SSD |
| Sistema | Linux con Docker Engine 24+ y el plugin `docker compose` | Ubuntu 24.04 LTS |
| Red | Salida a internet solo para construir/actualizar | — |

El sistema completo consume **menos de 2 GB de RAM en reposo** (límites por
contenedor definidos en `kubo-infra/docker-compose.yml`).

## 2. Instalación en el local del negocio

```bash
git clone <url-del-workspace> kubo && cd kubo
cp kubo-infra/.env.example kubo-infra/.env
```

Editar `kubo-infra/.env` y **cambiar todos los valores**. Generar las claves:

```bash
openssl rand -hex 32   # KUBO_FIELD_ENCRYPTION_KEY
openssl rand -hex 32   # KUBO_BLIND_INDEX_KEY
openssl rand -hex 64   # KUBO_CRM_SECRET_KEY_BASE
openssl rand -base64 48 # KUBO_ERP_SECRET_KEY_BASE
```

Levantar:

```bash
make up      # construye y arranca los 12 contenedores
make seed    # datos de demostración (omitir en producción)
make smoke   # verificación end-to-end
```

Abrir `http://<ip-del-servidor>:3000` e ingresar con el administrador creado.

### Puertos

| Servicio | Host | Contenedor |
| --- | --- | --- |
| PWA | 3000 | 80 |
| **TLS (Caddy): HTTPS · HTTP** | **3443 · 3080** | 443 · 80 |
| **OTel collector: gRPC · HTTP** | **4317 · 4318** | 4317 · 4318 |
| Grafana (perfil `observability`) | 3001 | 3000 |
| API Gateway | 9080 | 8080 |
| IAM · CRM · ERP · Analítica | 9081–9084 | 8081–8084 |
| PostgreSQL · MongoDB | 5433 · 27018 | 5432 · 27017 |
| RabbitMQ (AMQP · consola) | 5673 · 15673 | 5672 · 15672 |
| Redis | 6380 | 6379 |

Los puertos se eligieron **fuera del rango 8000–8100** para no chocar con otros
servicios que ya corran en la máquina del negocio.

## 3. Puesta en producción (checklist)

- [ ] `kubo-infra/.env` con todas las claves cambiadas y el archivo **fuera del control de versiones**.
- [ ] `KUBO_JWT_PRIVATE_KEY` con una llave RSA real (si queda vacía, el servicio genera una efímera y los tokens se invalidan al reiniciar).
- [ ] TLS: `KUBO_TLS_DOMAIN` con el dominio del negocio (ver abajo). El servicio `kubo-tls` ya está en el compose.
- [ ] `KUBO_COOKIE_SECURE=true` cuando el acceso sea siempre por HTTPS.
- [ ] Correo real: `KUBO_MAIL_TRANSPORT=smtp` con `KUBO_SMTP_HOST` y credenciales (si se deja `log`, el enlace de recuperación queda en el buzón de demostración).
- [ ] **No publicar** los puertos 9080–9084 en producción: la PWA llega al gateway por la red interna de contenedores (nginx proxea `/api`), y los servicios de negocio solo deben ser alcanzables por el gateway. Publicar el 9080 permitiría inyectar `X-Forwarded-For` y saltarse el límite de autenticación.
- [ ] `KUBO_SEED_ENABLED=false` (no sembrar datos de demostración).
- [ ] Respaldos programados (sección 5) y un simulacro de restauración ejecutado.
- [ ] Monitoreo de las sondas `/api/v1/health` de los cinco servicios.

### TLS con Caddy (incluido)

El servicio `kubo-tls` (Caddy) termina HTTPS en el local y redirige HTTP a HTTPS:

- `https://<dominio>:3443` sirve la PWA; `http://<dominio>:3080` redirige.
- Con `KUBO_TLS_DOMAIN=localhost` (por defecto) Caddy usa su CA interna
  (`tls internal`): válido para la red del local, el navegador pedirá aceptar el
  certificado una vez.
- Para un **dominio público**: ponga `KUBO_TLS_DOMAIN=kubo.minegocio.co` en el
  `.env`, quite `tls internal` de `kubo-infra/caddy/Caddyfile` y Caddy gestionará
  el certificado Let's Encrypt automáticamente.

La PWA ya proxea `/api` al gateway, así que un único dominio con HTTPS cubre todo
el sistema. La cabecera `Strict-Transport-Security` se envía en todas las
respuestas.

### Trazas (OpenTelemetry)

El collector `kubo-otel` recibe trazas OTLP de los cinco servicios y las escribe
en su log: `docker logs kubo-otel` es la comprobación básica (el humo la verifica).
Para el stack visual:

```bash
make observability   # agrega Tempo y Grafana; Grafana en http://localhost:3001
```

No forma parte de la instalación por defecto: un local de barrio no necesita el
stack visual y así el consumo se mantiene bajo. En producción, fije la versión de
las imágenes de observabilidad (hoy usan etiquetas).

## 4. Operación diaria

| Comando | Para qué |
| --- | --- |
| `make ps` | Ver el estado y la salud de cada contenedor |
| `make logs` | Logs en vivo de todos los servicios |
| `make restart` | Reiniciar los servicios de aplicación |
| `make smoke` | Verificar el flujo completo (útil tras una actualización) |
| `make down` | Detener el sistema conservando los datos |
| `make clean` | Detener **y borrar** los volúmenes (pierde los datos) |

### Actualización

```bash
git pull
make up      # reconstruye solo lo que cambió
make smoke   # confirma que todo sigue funcionando
```

Las migraciones se aplican solas al arrancar cada servicio
(`KUBO_RUN_MIGRATIONS=true`): Flyway en IAM, `db:prepare` en Rails y
`ecto.migrate` en Phoenix. Una migración aplicada **nunca se edita**; se crea una
nueva.

## 5. Respaldos

Automatizados con `make backup` (`kubo-infra/scripts/backup.sh`):

| Qué | Cómo | Frecuencia |
| --- | --- | --- |
| PostgreSQL | `pg_dump -Fc` por base (`kubo_iam`, `kubo_crm`, `kubo_erp`) | Diaria |
| MongoDB | `mongodump --archive` de `kubo_analytics` | Diaria |
| Configuración | `kubo-infra/.env` cifrado con `age` (si hay destinatario) o `chmod 600` | Diaria |
| Retención | `KUBO_BACKUP_RETENTION_DAYS` (14 por defecto) | Automática |

```bash
make backup          # deja un directorio con fecha en kubo-infra/backups/
make restore-drill   # restaura en bases kubo_drill_* y compara filas
```

Programación diaria con systemd (copiar a `/etc/systemd/system/`):

```bash
sudo cp kubo-infra/systemd/kubo-backup.{service,timer} /etc/systemd/system/
sudo systemctl enable --now kubo-backup.timer   # 03:30 con retraso aleatorio
```

**Objetivos**: RPO 24 h · RTO 4 h. **Un respaldo que nunca se restauró no es un
respaldo**: `make restore-drill` toma un respaldo nuevo, lo restaura en bases de
prueba, compara el número de filas de las tablas clave y mide el tiempo (en este
equipo: 14/14 en 6 segundos). Ejecútalo mensualmente y tras cada cambio de
esquema.

**Importante**: MongoDB guarda una **proyección** reconstruible desde los eventos
del ERP. PostgreSQL es la fuente de verdad y es lo que no puede perderse.

## 6. Diagnóstico rápido

| Síntoma | Primera revisión |
| --- | --- |
| La PWA carga pero no hay datos | `make ps` — ¿el gateway está *healthy*? |
| `401` en todas las llamadas | El gateway no puede leer el JWKS: revisa `kubo-iam` |
| `502 UPSTREAM_UNAVAILABLE` | El microservicio destino está caído: `docker logs kubo-erp` |
| El tablero no refleja ventas | `docker logs kubo-analytics` — ¿el consumidor está conectado? |
| `429` en operación normal | Ajusta `KUBO_RATE_LIMIT_PER_MINUTE` en el gateway |
| El inventario no cuadra | Compara `products.stock` con la suma del kardex (consulta en `02-modelo-datos.md`) |

## 7. Escalado

El sistema está diseñado para crecer sin reescribir:

1. **Más memoria/CPU**: subir los `mem_limit` del compose.
2. **Más carga en la caja**: escalar el ERP horizontalmente (`docker compose up -d --scale kubo-erp=3`) porque es sin estado; el gateway reparte.
3. **Bases separadas**: mover cada base a su propia instancia cambiando solo la URL de conexión.
4. **Clúster**: los mismos artefactos corren en Kubernetes; la malla mTLS
   (ADR-0020) y el RLS activo (ADR-0010) ya están implementados; el empaquetado
   (manifiestos/Helm) queda como backlog declarado (ADR-0028).

## 8. Lo que queda (declarado)

| Pendiente | Tipo | Impacto |
| --- | --- | --- |
| Adaptador del proveedor tecnológico DIAN | Externo (habilitación) | La firma XAdES y el envío los hace el PT; el puerto ya está listo (guía `13`) |
| Adaptadores reales de notificaciones (WhatsApp/SMTP) | Proveedor externo | El puerto y el buzón ya funcionan; falta la entrega real |
| Empaquetado Kubernetes (manifiestos/Helm) | Backlog | Necesario solo para multi-nodo (>50 negocios); el compose es el despliegue soportado |
| App móvil nativa (Capacitor) | Decisión tomada | Solo cuando el negocio pida cámara, push o impresión (ADR-0023) |
| Capturas internas y video narrado | Tarea del usuario | Evidencia de demostración (`09-demo-guion.md`) |

> Las fases 0–6 están cerradas y verificadas; ver
> [`11-plan-de-cierre.md`](11-plan-de-cierre.md).

## 9. Demo público 100 % open source (ADR-0028)

### 9.1 Con acceso al router (ruta directa)

1. **Dominio gratis**: crear cuenta en [DuckDNS](https://www.duckdns.org)
   (login con GitHub) y el subdominio `kubo`; copiar el token y guardarlo en
   `.env` como `KUBO_DUCK_TOKEN`. (Alternativas: dynv6 —hoy con su dominio
   padre `dynv6.net` caído en DNS— y deSEC —con `dedyn.io` pausado—.)
2. **Perfil público** en `kubo-infra/.env`: `KUBO_TLS_DOMAIN=kubo.duckdns.org`,
   `KUBO_CADDYFILE=Caddyfile.public`, `KUBO_TLS_HTTP_PORT=80`,
   `KUBO_TLS_HTTPS_PORT=443` y `KUBO_COOKIE_SECURE=true`.
3. **IP dinámica**: `./kubo-infra/scripts/ddns-duckdns.sh` (cron cada 5 minutos)
   mantiene el registro A al día.
4. **Router**: reenviar 80 y 443 a la IP del portátil (reservarla antes en el
   DHCP del router) y no abrir nada más.
5. `make up` y verificar con `./kubo-infra/scripts/demo-check.sh`: Caddy emite
   el certificado Let's Encrypt (HTTP-01) y `https://kubo.dedyn.io` sirve la
   PWA. Los puertos 9080–9084 y las bases no deben responder desde internet
   (siguen en loopback).
6. **Respaldo offsite**: Storj (S3, 25 GB gratis) configurando
   `KUBO_BACKUP_OFFSITE_DIR=storj:kubo-backups` y las credenciales
   `KUBO_STORJ_ACCESS_KEY`/`KUBO_STORJ_SECRET_KEY` en `.env` (el operador trae
   rclone y verifica la copia); luego `make backup-operator` +
   `make restore-drill`.

### 9.2 Sin acceso al router (túnel 100 % OSS con zrok)

Si el router no permite administración (ni UPnP), el borde es un túnel
open source; el compose no cambia:

1. Instalar el cliente `zrok2` (Apache-2.0) desde
   [zrok releases](https://github.com/openziti/zrok/releases).
2. Crear la cuenta: `zrok2 invite` (el token de invitación se obtiene en
   [zrok.io](https://zrok.io)) y `zrok2 enable <token>`.
3. Compartir: `./kubo-infra/scripts/demo-tunnel.sh start` (URL estable
   `https://kubo.shares.zrok.io`; `status` y `stop` para operarlo). Manualmente:
   `zrok2 share public --headless -n public:kubo http://localhost:3000`.
4. `KUBO_COOKIE_SECURE=true` en `.env` y
   `docker compose up -d kubo-gateway`.
5. Detrás del túnel todos los visitantes comparten IP: el límite de
   autenticación se vuelve global (súbelo temporalmente si hay muchos
   espectadores).
