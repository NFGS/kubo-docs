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
make up      # construye y arranca los 10 contenedores
make seed    # datos de demostración (omitir en producción)
make smoke   # verificación end-to-end
```

Abrir `http://<ip-del-servidor>:3000` e ingresar con el administrador creado.

### Puertos

| Servicio | Host | Contenedor |
| --- | --- | --- |
| PWA | 3000 | 80 |
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
- [ ] TLS terminado en un proxy inverso (Caddy, Traefik o nginx) con certificado válido.
- [ ] **No publicar** los puertos 9081–9084 en producción: los servicios de negocio solo deben ser alcanzables por el gateway dentro de la red de contenedores.
- [ ] `KUBO_SEED_ENABLED=false` (no sembrar datos de demostración).
- [ ] Respaldos programados (sección 5).
- [ ] Monitoreo de las sondas `/api/v1/health` de los cinco servicios.

### TLS con Caddy (ejemplo)

```
kubo.minegocio.co {
    reverse_proxy localhost:3000
}
```

La PWA sirve los activos y proxea `/api` al gateway, así que un único dominio
con HTTPS cubre todo el sistema.

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

| Qué | Cómo | Frecuencia |
| --- | --- | --- |
| PostgreSQL | `pg_dump` por base (`kubo_iam`, `kubo_crm`, `kubo_erp`) | Diaria |
| MongoDB | `mongodump` de `kubo_analytics` | Diaria |
| Configuración | `kubo-infra/.env` (cifrado con `age`) | En cada cambio |
| Volúmenes Docker | `docker run --rm -v kubo_pgdata:/data ...` | Semanal |

```bash
# Respaldo completo
docker exec kubo-postgres pg_dump -U kubo_root -d kubo_iam > respaldo_iam.sql
docker exec kubo-postgres pg_dump -U kubo_root -d kubo_crm > respaldo_crm.sql
docker exec kubo-postgres pg_dump -U kubo_root -d kubo_erp > respaldo_erp.sql
docker exec kubo-mongo mongodump --db kubo_analytics --archive > respaldo_analytics.archive

# Restauración
docker exec -i kubo-postgres psql -U kubo_root -d kubo_erp < respaldo_erp.sql
docker exec -i kubo-mongo mongorestore --archive --drop < respaldo_analytics.archive
```

**Objetivos**: RPO 24 h · RTO 4 h. Un respaldo que nunca se restauró no es un
respaldo: haz un simulacro mensual contra un entorno de prueba.

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
4. **Clúster**: los mismos artefactos corren en Kubernetes; falta mTLS entre servicios (Fase 5, P-28) y la activación de RLS (Fase 1, P-02).

## 8. Lo que falta para producción real

| Pendiente | ID · Fase | Impacto |
| --- | --- | --- |
| *Transactional outbox* | P-01 · Fase 1 | Un evento puede perderse si el proceso muere justo tras el `commit` |
| Activación de RLS | P-02 · Fase 1 | El aislamiento depende hoy de la disciplina del código |
| Refresh token en cookie `httpOnly` | P-03 · Fase 1 | Un XSS podría robar el token de refresco |
| Recuperación de contraseña | P-04 · Fase 1 | Hoy la cambia un administrador desde la base |
| TLS/HTTPS verificado en la instalación | P-27 · Fase 1 | Las credenciales viajan en claro por la red del local |
| CI/CD y escaneos automatizados | P-06 · Fase 2 | Las verificaciones son manuales (`make smoke`) |
| Monitoreo centralizado | P-07 · Fase 2 | Solo hay sondas de salud y logs locales |
