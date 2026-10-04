# Runbook de operación — la semana uno

> **Para quién**: quien opera Kubo en el servidor del negocio (el operador).
> **Para qué**: que la primera semana real —el criterio de «proyecto
> terminado»— transcurra sin soporte presencial. Cada procedimiento dice qué se
> mira, qué significa y qué se hace.

## 1. Día cero (puesta en marcha)

1. **Instalar** con el playbook de `kubo-infra/ansible/` (`README.md` del
   directorio): genera los secretos en el host, levanta el stack y deja UFW
   cerrado salvo 80/443/22.
2. **Certificados**: `make certs` (los internos de la malla, ADR-0020) y el
   certificado público del dominio en Caddy.
3. **Negocio y dueño**: el seeder crea el negocio y el propietario
   (`KUBO_ADMIN_EMAIL`/`KUBO_ADMIN_PASSWORD`). El dueño **activa su segundo
   factor** en Configuración el primer día (sin él, el acceso queda en un solo
   factor).
4. **Respaldo**: `make backup-operator-loop` (o los timers de
   `kubo-infra/systemd/`) deja el ciclo respaldo → retención → verificación →
   manifiesto corriendo. **No se abre al público sin un respaldo verificado**.
5. **Prueba de restauración** antes de abrir: `make restore-drill` restaura en
   bases de usar y tirar y compara conteos.
6. **Plan**: `./kubo-infra/scripts/tenant-admin.sh renew <slug>` deja la
   vigencia; el panel del operador (`/plataforma`) muestra plan, estado y uso.

## 2. Cada mañana (5 minutos)

```bash
kubo-infra/scripts/operacion-check.sh
```

Debe terminar en **0 fallos**. Qué mira y qué hacer si falla:

| Chequeo | Si falla |
| --- | --- |
| El gateway responde su sonda | `docker compose ps`; si el contenedor no está, `docker compose up -d kubo-gateway` |
| Los servicios del núcleo corren | Levantar el que falte y mirar su log (`docker logs kubo-<servicio> --since 30m`) |
| La bandeja de salida sin eventos fallidos | Ver §4.1 (bus) |
| El respaldo de anoche pasó la verificación | Ver §4.2 (respaldo) |
| La copia fuera del sitio quedó hecha | Revisar el destino de rclone y su credencial |
| Disco por debajo del 85 % | Liberar respaldos viejos o ampliar el volumen (§4.3) |
| Certificados vigentes (>15 días) | `make rotate-ca` y reiniciar (§4.4) |

## 3. Cada semana

- **Restauración de prueba**: `make restore-drill` (o el respaldo ya la corre
  cada noche; el drill es la prueba completa).
- **Seguridad**: `./kubo-infra/scripts/tenant-admin.sh usage` muestra, por
  negocio, accesos fallidos de los últimos 7 días. Un pico sostenido se
  investiga con el registro de auditoría (`/auditoria` en la PWA).
- **Comercial**: revisar en `/plataforma` los planes que vencen y los pagos
  pendientes de confirmar.
- **Capacidad**: uso de disco, tamaño de los documentos y ventas del mes por
  negocio (el panel muestra los conteos; nunca datos de negocio).
- **Espejos**: `make sync-status` verifica que el directorio del proyecto,
  GitHub, Notion y Obsidian compartan la misma huella; `make sync` propaga los
  cambios (ADR-0027).

## 4. Playbooks (qué hacer cuando pasa)

### 4.1 El bus de eventos se cae
La bandeja de salida (`outbox`) **retiene** los eventos: no se pierde nada.
1. `docker compose ps kubo-rabbitmq`; levantarlo si está abajo.
2. Al volver, el publicador reintenta y la sonda del ERP deja
   `outbox.failed = 0`.
3. Si `failed > 0`, revisar el log del ERP y republicar; los eventos están en la
   tabla `outbox_events` con su carga completa.

### 4.2 Un respaldo no pasó la verificación
1. **No borrar** el respaldo anterior: la retención guarda los últimos
   (`retencion_minima=3`).
2. Mirar el `MANIFEST` del día (`verificacion=`, `conteos=`): dice qué base no
   cuadró.
3. Correr un respaldo manual: `docker compose run --rm kubo-backup`.
4. Si vuelve a fallar, restaurar el respaldo bueno anterior y avisar antes de
   seguir operando.

### 4.3 El disco se llena
1. `du -sh kubo-infra/backups/*` — los respaldos son lo que más crece.
2. La retención (`retencion_dias=14`, `retencion_minima=3`) ya borra lo viejo;
   para una urgencia, mover respaldos viejos al destino fuera del sitio y
   borrarlos del servidor.
3. Los documentos del negocio **no se borran nunca** sin orden del dueño.

### 4.4 Un certificado interno está por vencer
`make rotate-ca` regenera la CA y los certificados de la malla y reinicia los
servicios; después, `operacion-check.sh` debe volver a pasar. La malla rechaza a
quien no presente certificado: un certificado vencido se ve como servicios que
no se hablan.

### 4.5 Un negocio no puede entrar
1. `./kubo-infra/scripts/tenant-admin.sh list`: ¿está suspendido?
   → `activate <slug>`.
2. Si dice `PLAN_LIMIT_REACHED`: el plan limita usuarios activos
   → desactivar usuarios o renovar/ampliar el plan.
3. Si el acceso falla con `TENANT_SUSPENDED`, es el estado del negocio, no la
   clave.

### 4.6 El operador perdió el autenticador (o quedó bloqueado)

Si solo está **bloqueado** por intentos fallidos (el autenticador funciona, pero
la cuenta acumuló 5 códigos errados), se limpia el contador sin tocar el segundo
factor:

```bash
./kubo-infra/scripts/tenant-admin.sh platform-reset
```

Si de verdad **perdió el autenticador**, camino de emergencia (ADR-0025): borrar
su fila de `platform_admins` y reiniciar IAM; el seeder recrea el operador y
**registra la URI `otpauth` una vez** en el log:
```bash
docker exec kubo-postgres psql -U kubo_root -d kubo_iam -c "delete from platform_admins where email = 'operador@kubo.local'"
docker compose restart kubo-iam
docker logs kubo-iam --since 2m | grep otpauth
```

### 4.7 Un pago no cuadra
1. `/plataforma` → **Pagos por confirmar**: cada intención trae negocio, monto y
   la referencia del proveedor.
2. La referencia es única por proveedor: si el proveedor reintentó el webhook,
   **no** se extendió dos veces (idempotencia); el pago aparece una sola vez.
3. Si el monto no coincide, el webhook se rechaza (`AMOUNT_MISMATCH`) y la
   intención queda pendiente: revisar con el proveedor antes de confirmar a
   mano.

### 4.8 Sospecha de fuga entre negocios
1. **Suspender** el negocio sospechoso (`tenant-admin.sh suspend`) y preservar
   los registros.
2. Verificar el aislamiento: las pruebas de RLS (`make ci`, suites de integración
   de ERP/CRM/IAM) y el humo (§8 de `07-pruebas.md`).
3. La auditoría de IAM registra quién hizo qué y cuándo; no se borra.

## 5. Qué se vigila (métricas de la semana)

- **Disponibilidad**: sonda de salud del gateway (cada mañana y con el monitoreo
  externo si lo hay).
- **Accesos fallidos por negocio**: `tenant-admin.sh usage` (7 días).
- **Bandeja de salida**: `outbox.failed = 0`.
- **Respaldos**: verificación `ok` y copia fuera del sitio `ok`, cada día.
- **Disco y certificados**: el chequeo de la mañana.
- **Latencia**: panel de observabilidad (`make observability`, Grafana en
  `localhost:3001`) con las trazas OTel de los cinco servicios.

## 6. Criterio de salida de la semana

La semana uno se cierra bien cuando:

1. El negocio operó **sin soporte presencial** (se atendió por teléfono como
   máximo).
2. **Cero pérdida de datos**: ningún respaldo con verificación fallida y ningún
   evento perdido en el bus.
3. El **aislamiento** se mantuvo (sin hallazgos de fuga).
4. Hubo al menos **una restauración de prueba** exitosa.
5. Los incidentes de la semana quedaron escritos (qué pasó, qué se hizo, qué se
   cambió) — insumo directo del catálogo de mejoras.
