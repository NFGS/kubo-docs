# ADR-0015 — Segundo factor TOTP del propietario

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada (Fase 4) |
| Relacionada | ADR-0007 (JWT RS256 con JWKS) · ADR-0011 (BFF del gateway) |

## Contexto

El propietario de un negocio concentra los permisos: gestiona usuarios, cambia
el perfil del negocio y ve toda la operación. Una contraseña filtrada —reutilizada
de otro sitio, vista por encima del hombro en el mostrador— entrega el negocio
completo. El plan de cierre (P-30) pide el segundo factor del propietario, y el
estándar de facto para una app de barrio es TOTP: lo entienden Google
Authenticator, Authy y 1Password, y no depende de SMS (costoso y vulnerable a
SIM swapping).

Dos decisiones no obvias hay que registrar: **dónde vive el secreto** y **cómo
entra el segundo paso en un login que hoy emite tokens de una vez**.

## Decisión

1. **El secreto se cifra en reposo** (AES-256-GCM, llave en
   `KUBO_TOTP_ENCRYPTION_KEY`). El secreto es la llave para generar códigos
   válidos: en claro, una copia de la base convierte el segundo factor en
   decorativo. Sin llave configurada el servicio **no arranca** (fail-fast), y
   la llave marcador de la plantilla se rechaza, igual que en el cifrado de
   campos del CRM.
2. **Implementación propia y sin dependencias** (`TotpService`): HMAC-SHA1, 6
   dígitos, paso de 30 s y **ventana de ±1 paso**. Se verifican los vectores del
   RFC 6238 en las pruebas para no validar la implementación contra sí misma.
   Cada paso extra de tolerancia multiplicaría las oportunidades de un atacante
   con un código observado.
3. **El acceso se parte en dos**: con el segundo factor activo, `POST
   /auth/login` responde `{totpRequired: true, challengeToken}` en lugar de la
   sesión. El desafío es un JWT firmado de 5 minutos con **`typ=totp`**, y el
   gateway solo acepta `typ=access`: sin esa comprobación, un desafío serviría
   como credencial de API. `POST /auth/totp/verify` (ruta pública) cambia
   desafío + código por la sesión.
4. **La activación exige un código**: `setup` genera el secreto y lo deja
   *pendiente*; `enable` lo confirma con el primer código válido (así se detecta
   un escaneo mal hecho antes de bloquear el acceso); `disable` exige un código
   vigente. Todo queda en la auditoría (`TOTP_CHALLENGED`, `TOTP_ENABLED`,
   `TOTP_FAILED`, `TOTP_DISABLED`).
5. **El estado viaja en el perfil**: `UserResponse.totpEnabled` permite que la
   interfaz muestre el estado real sin adivinar.

## Consecuencias

- **Positivas**: el segundo factor es real (secreto cifrado, desafío de un solo
  uso, tolerancia acotada) y no agrega dependencias al servicio; el flujo de
  login normal no cambia para quien no lo activa; el gateway queda blindado
  contra el uso cruzado de tokens por tipo.
- **Negativas**: si el propietario pierde el autenticador no hay recuperación
  automática —el camino es un administrador con acceso a la base o un
  procedimiento de soporte, que el plan deja como manual—; el desafío dura 5
  minutos y un código observado en ese lapso sigue siendo válido por la ventana
  de tolerancia. El segundo factor es opcional: se recomienda, no se impone.

## Verificación

- `kubo-iam` **46 pruebas**: vectores del RFC 6238, ventana de tolerancia,
  cifrado del secreto (round-trip y rechazo de la llave marcador), desafío
  firmado/verificado de verdad, ciclo setup → enable → disable y accesos
  inválidos.
- `kubo-gateway` **9/9**: el desafío no sirve como token de acceso (el `typ` se
  comprueba) y `/auth/totp/verify` es pública.
- `make smoke` (**130/130**): con un código TOTP real calculado en Python
  (implementación independiente) se activa, se entra en dos pasos, se rechaza un
  código inválido y se desactiva; el usuario de prueba queda restaurado.
- `make e2e`: el ingreso normal (sin segundo factor) sigue pasando la auditoría
  de accesibilidad y llegando al tablero.
