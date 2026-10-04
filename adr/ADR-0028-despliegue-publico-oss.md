# ADR-0028 — Despliegue público de demostración 100 % open source

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-04 |
| Estado | Aceptada e implementada (en ejecución) |
| Relacionada | ADR-0027 (sincronización de los 4 entornos) · ADR-0020 (mTLS) · ADR-0022 (respaldos) |

## Contexto

El producto necesita **mostrarse a cualquier persona con internet** (clientes,
jurados, reclutadores) sin presupuesto inicial. Restricciones del propietario:
$0, sin tarjeta de crédito, **tecnologías 100 % open source**, dominio gratis y
sin Kubernetes por ahora. El sistema no es un sitio estático: son 6 servicios,
4 almacenes, malla mTLS y un outbox, pensados para un servidor único con Docker
Compose (ADR-0002, ADR-0021).

La conexión del hogar tiene **IP pública real** (no CGNAT), lo que habilita la
ruta más pura: el tráfico no necesita pasar por ningún tercero.

## Decisión

1. **Host: el portátil**, directo (sin equipo de repuesto y sin presupuesto).
   Los puertos internos siguen en loopback; solo se publica el borde TLS.
2. **Borde: Caddy + Let's Encrypt** (ya en el proyecto) con **HTTP-01** y la
   imagen oficial (sin builds custom). El perfil público vive en
   `Caddyfile.public` y se selecciona con `KUBO_CADDYFILE`.
3. **Dominio gratis: deSEC** (`kubo.dedyn.io`) — sin ánimo de lucro, API DNS y
   protocolo DynDNS2; la IP dinámica se mantiene con `ddns-dedyn.sh` (cron).
4. **Respaldo offsite: restic/rclone hacia Storj** (S3, 25 GB gratis,
   tecnología abierta) como destino del operador de respaldos (ADR-0022).
5. **Descartes**: Vercel (solo estático; rompe el proxy mismo-origen y la
   cookie `SameSite=Strict`), PaaS gratuitos (512 MB, expiran o hibernan),
   nubes con tarjeta de verificación (Oracle/GCP/AWS), Kubernetes por ahora.
6. **Plan B**: si el ISP bloquea los puertos entrantes o no hay acceso al
   router, se usa un **túnel open source** (zrok/OpenZiti) — el compose no
   cambia, solo el borde.
7. **KVM/virt-manager** queda para la **VM de ensayo** (paridad de entornos y
   snapshots) antes de presentaciones a clientes; no es el host del demo.

## Consecuencias

- **Positivas**: la ruta de datos es 100 % propia y open source (sin túneles ni
  intermediarios); costo $0; la migración a un VPS pagado es lift-and-shift
  (mismo compose, mismo Ansible, solo cambia el host); el ensayo en VM permite
  probar todo antes de exponerlo.
- **Negativas**: el portátil debe estar encendido durante el demo (sin SLA);
  la IP es dinámica (mitigado con DDNS); el router del ISP debe permitir el
  reenvío de puertos (mitigado con el plan B); `KUBO_COOKIE_SECURE=true`
  implica que el acceso local de desarrollo debe ser por HTTPS o vía la URL
  pública.

## Verificación

- `https://kubo.dedyn.io` sirve la PWA con certificado Let's Encrypt válido.
- `check-host.net` confirma 80/443 abiertos desde nodos externos; los puertos
  9080–9084 y las bases **no** responden desde internet.
- Login por HTTPS con cookie de refresco `Secure`; el límite de autenticación
  sigue operando por IP real (sin túnel que la enmascare).
- `make backup` con copia offsite en Storj y `make restore-drill` en verde.
