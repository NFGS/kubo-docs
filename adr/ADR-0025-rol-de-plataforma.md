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

- `make smoke`: un token de negocio contra `/platform/*` responde 403; un token
  de plataforma contra `/products` responde 403; el panel lista negocios y
  suspende/activa/renueva con su auditoría.
- `kubo-iam`: pruebas del reino de token (claim ausente, claim de negocio,
  claim de plataforma) y del segundo factor obligatorio.
