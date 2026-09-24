# ADR-0011 — BFF como capa formal del gateway

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada (Fase 2) |
| Relacionada | ADR-0007 (JWT RS256 con JWKS) |

## Contexto

El patrón *Backend For Frontend* apareció dos veces en el gateway sin haberse
declarado como decisión: primero con `GET /api/v1/dashboard/overview` (la vista
compuesta del tablero) y después con el BFF de autenticación, que guarda el
refresh token en una cookie `httpOnly`. Sin una decisión explícita, cada nueva
necesidad de la PWA corría el riesgo de resolverse con lógica de presentación
repartida entre el navegador y los microservicios.

## Decisión

El gateway es la **capa BFF formal** del sistema. Toda composición o adaptación
pensada para la PWA vive ahí, no en el navegador ni en los servicios de negocio:

1. **Composición de lecturas** (`/dashboard/overview`): el gateway consulta los
   servicios en paralelo (`Promise.allSettled`) y entrega una sola respuesta. Si
   una vista falla, el tablero llega parcial y lo informa en `unavailable`.
2. **Adaptación de credenciales** (`login`/`refresh`/`logout`): el refresh token
   se transforma en cookie `httpOnly` + `SameSite=Strict` y desaparece del
   cuerpo. El navegador nunca lo ve.
3. **Reglas del BFF**:
   - Los servicios de negocio conservan contratos limpios y sin conocimiento de
     la interfaz.
   - El BFF no duplica reglas de dominio: solo orquesta y adapta forma.
   - Las rutas compuestas se declaran en `GATEWAY_OWNED_PATHS` y no se reenvían.

## Consecuencias

- **Positivas**: un solo lugar para la composición y la seguridad de sesión; los
  microservicios pueden evolucionar sin romper a la PWA; la cookie `httpOnly` es
  posible sin tocar los servicios de negocio.
- **Negativas**: el gateway gana responsabilidad y debe probarse como capa
  propia (contratos OpenAPI + E2E + humo); una caída del gateway afecta a todas
  las vistas compuestas (mitigado con entrega parcial).

## Verificación

- `make smoke`: la vista compuesta trae las 7 vistas en una petición y el login
  no expone el refresh token.
- `make contracts`: el contrato OpenAPI declara `additionalProperties: false` en
  `LoginResponse`; un `refreshToken` filtrado rompería la validación.
- `make e2e`: el navegador inicia sesión y navega sin leer nunca el token de
  refresco.
