# ADR-0020 — mTLS en la malla interna

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada (Fase 5) |
| Relacionada | ADR-0007 (JWT RS256) · ADR-0010 (RLS) · ADR-0011 (BFF) |

## Contexto

Los servicios internos (IAM, CRM, ERP y analítica) se hablan por HTTP plano
dentro de la red del compose: la única defensa es que el gateway **borra las
cabeceras de identidad** del cliente y las reescribe con el token verificado. Eso
protege contra un cliente externo, pero no contra un contenedor comprometido o
añadido a la red: cualquiera que alcance `kubo-erp:8083` puede enviar
`x-tenant-id` y `x-user-role` y suplantar a un negocio entero. El plan de cierre
(P-28) pide mTLS entre el gateway y los servicios.

En un producto autoalojable, la malla interna no sale del host del dueño; el
riesgo realista no es un atacante en internet, sino el aislamiento entre
contenedores y el principio de menor privilegio.

## Decisión

1. **Una CA interna propia** (`kubo-infra/certs/`, generada con
   `scripts/gen-internal-certs.sh`): no se usa una CA pública porque los nombres
   son de la red del compose (`kubo-erp`, `kubo-iam`, …) y no deben existir en
   internet. Las llaves **no se versionan** (`.gitignore`); cada despliegue
   genera las suyas.
2. **Cada servicio presenta su certificado y exige el del cliente**
   (`client-auth: need` / `verify_mode: peer` / `verify: :verify_peer` con
   `fail_if_no_peer_cert`). Un contenedor sin certificado de la CA no puede
   hablar con la malla, aunque esté en la red.
3. **El gateway es el único cliente** de la malla: presenta su certificado en
   cada reenvío y **verifica el del servicio** (`rejectUnauthorized: true` con la
   CA interna). El navegador sigue entrando por HTTP/HTTPS público al gateway; el
   salto interno es el que se cifra y autentica.
4. **Los SAN incluyen `localhost`**: los *healthchecks* corren dentro del
   contenedor y usan `https://localhost:PUERTO` con la CA, de modo que la
   verificación de nombre también se ejerce ahí.
5. **La CA es un artefacto de despliegue**: `make certs` la genera; el runbook
   documenta su rotación (regenerar y recrear la malla) y que **no** entra al
   repositorio.

## Consecuencias

- **Positivas**: la suplantación por cabeceras deja de ser posible desde fuera de
  la malla; el tráfico interno viaja cifrado; la rotación de la CA es explícita y
  local; el patrón es el mismo para cualquier servicio nuevo (un certificado más
  en el bucle del script).
- **Negativas**: un certificado vencido o una CA regenerada tumba la malla
  completa (se mitiga con la vigencia de 825 días, un `make certs` idempotente y
  la verificación de `make ci`); los *healthchecks* y las llamadas directas de
  los scripts pasan por la CA (`--cacert`), lo que agrega un parámetro a las
  herramientas de operación. En un despliegue con orquestador (Kubernetes) esto
  se reemplaza por una malla de servicio (Istio/Linkerd) o `cert-manager`: este
  ADR cubre el despliegue de compose.

## Verificación

- `make ci` (**10/10**) y humo (**150/150**) con la malla cifrada: el gateway
  habla con los cuatro servicios por HTTPS mutuo.
- Un cliente **sin** certificado no obtiene respuesta de la malla (comprobación
  negativa en el humo: `curl` con la CA pero sin certificado → error de TLS).
- `make certs` genera la CA y los certificados de forma idempotente; `make up`
  depende de él, así que un clon nuevo no puede arrancar sin malla.
- **Hallazgos de la implementación**: `fetch` nativo de Node **no** presenta
  certificado de cliente, así que el gateway usa un agente de `undici`
  compartido (`src/lib/internal-fetch.ts`) para el BFF de autenticación, el
  tablero compuesto y la descarga del JWKS; `jose` no permite inyectar un
  `fetch` propio en su variante remota, de modo que el gateway **descarga el
  JWKS con el agente** y verifica con `createLocalJWKSet` y caché (refresco ante
  un `kid` desconocido, que es una rotación de llave); y el agente mTLS se aplica
  **solo a destinos HTTPS** (pasarlo en un salto HTTP rompía la conexión).
