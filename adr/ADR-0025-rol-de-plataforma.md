# ADR-0025 — Rol de plataforma y panel del operador

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada (Fase 6) |
| Relacionada | ADR-0015 (TOTP) · ADR-0021 (multi-tenant SaaS) · ADR-0024 (superficie del operador) |

## Contexto

La superficie del operador es hoy un script contra la base (ADR-0024), que basta
mientras el operador sea uno y tenga acceso al servidor. Cuando haya **varios
operadores o soporte delegado**, hace falta un panel con acceso propio —y eso
exige el rol de plataforma que ADR-0024 dejó explícitamente para después.

Ese rol es la credencial más poderosa del sistema: está **por encima de los
negocios**. Un error de diseño aquí no se arregla con un parche: se convierte en
la forma de leer los datos de todos los clientes.

## Decisión

1. **El rol de plataforma está separado de los roles del negocio**: una tabla
   propia (`platform_admins`) con sus credenciales y su segundo factor. Nunca es
   un usuario de un tenant: un usuario de negocio no puede tener poder de
   plataforma, y un administrador de plataforma **no puede entrar a un negocio
   como si fuera su dueño**.
2. **Segundo factor obligatorio** (TOTP, ADR-0015): sin código no hay sesión de
   plataforma. No es opcional para este rol.
3. **Reino de token separado**: el token de plataforma lleva `platform: true`
   (y `typ=access`); el gateway enruta `/platform/*` **solo** con ese claim y
   rechaza un token de negocio (y al revés: un token de plataforma no lee
   `/products`, `/sales` ni `/customers`). El aislamiento no depende de la
   interfaz.
4. **Poder mínimo**: el panel lista negocios, muestra su uso, plan y estado, y
   permite **suspender, reactivar y renovar**. No puede leer datos de negocio
   —ventas, clientes, documentos—: para eso está el dueño. El aislamiento por
   RLS sigue siendo la garantía, no la buena voluntad del operador.
5. **Auditoría propia** (`platform_audit`): cada acción con quién, qué, cuándo y
   desde dónde; el panel la muestra. Un poder sin registro no es auditable.
6. **La interfaz es una ruta de la PWA** (`/plataforma`) con su propio guardia
   por claim: reutiliza la pila (React, tokens, axe) sin abrir una aplicación
   aparte. El script (ADR-0024) queda como acceso de emergencia y automatización.
7. **Límite de tasa propio** para `/platform/*`: es una superficie pública más,
   y la más sensible.

## Consecuencias

- **Positivas**: el poder de plataforma queda acotado, auditado y separado del
  producto; un token de negocio comprometido no abre el panel; el operador ve lo
  que necesita (uso, plan, estado) sin poder espiar la operación de nadie.
- **Negativas**: hay una credencial más que proteger (por eso 2FA obligatorio,
  poder mínimo y auditoría propia) y un reino de token que el gateway debe
  validar con cuidado (una confusión de claims sería grave; se cubre con pruebas
  negativas en el humo). El soporte «entrar a mirar el negocio del cliente»
  queda **fuera** por diseño: se resuelve pidiendo al dueño, no suplantándolo.

## Verificación

- `make smoke` (**167/167**): el acceso de plataforma **siempre** pide el código
  (`totpRequired`), un código inválido responde `INVALID_TOTP` y un token de
  negocio contra `/platform/tenants` responde **403**.
- `kubo-iam` (**69 pruebas**, cobertura cumplida): el flujo positivo con el
  secreto bajo control (acceso → código vigente → token), la contraseña
  incorrecta auditada, la suspensión, la renovación (extiende desde la fecha
  vigente), el listado con la marca de sistema y la rotación del segundo factor
  (el código del secreto viejo deja de verificar).
- `make e2e` (**5/5**): la página del panel pasa la auditoría de accesibilidad.
- **Uso agregado del ERP en el panel (cerrado)**: el ERP expone
  `GET /api/v1/internal/usage` —sin plug de identidad, alcanzable solo por la
  malla mTLS y con la lista de negocios que le pasa el gateway— y consulta cada
  negocio **con su propia marca `app.tenant_id`** (no se amplía la política
  RLS). El gateway compone la vista (`/api/v1/platform/usage`, patrón BFF) y el
  panel muestra productos, bodegas, ventas del mes y documentos por negocio:
  **solo conteos, nunca datos de negocio**. Evidencia: 3 pruebas del gateway
  (composición y degradación parcial), el endpoint interno inalcanzable sin
  certificado y el humo 177/177 (un token de negocio responde 403 en
  `/platform/usage`).
- **Rotación del segundo factor del operador (cerrada)**: `POST
  /platform/totp/rotate` exige sesión de plataforma (haber pasado el código),
  invalida el secreto anterior en el acto y entrega la URI `otpauth` **una sola
  vez**; queda auditado como `TOTP_ROTATED`. Si el operador pierde el
  autenticador, el camino de emergencia es borrar su fila de `platform_admins` y
  reiniciar IAM: el seeder recrea el operador y registra la URI una vez en el
  log. Evidencia: prueba de rotación (el código del secreto viejo deja de
  verificar) y el panel con el aviso de «se muestra una sola vez».
