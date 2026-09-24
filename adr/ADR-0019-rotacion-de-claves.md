# ADR-0019 — Rotación de claves de cifrado de campo (KEK/DEK)

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada (Fase 5) |
| Relacionada | ADR-0010 (RLS activo) · ADR-0015 (secreto TOTP cifrado) |

## Contexto

El CRM cifra los datos personales (documento y teléfono) con AES-256-GCM y una
llave en configuración (`KUBO_FIELD_ENCRYPTION_KEY`). Esa llave **nunca rota**:
si se filtra, si un empleado con acceso al servidor se va, o si la normativa
exige rotación periódica, hoy no hay camino —y re-cifrar todo de una sentada
dejaría el sistema inconsistente si algo falla a mitad.

Rotar una llave de cifrado de datos vivos tiene tres problemas clásicos:

1. **Ventana de inconsistencia**: mientras se re-cifra, conviven valores viejos y
   nuevos; el sistema debe poder leer ambos.
2. **Indisponibilidad**: no se puede parar la operación para re-cifrar.
3. **Pérdida de datos**: una rotación mal hecha (o interrumpida) destruye datos
   que no se pueden recuperar.

## Decisión

**Envelope encryption con anillo de llaves y formato versionado** (KEK/DEK):

1. **El texto cifrado dice con qué llave se escribió**:
   `v1:<key_id>:base64(iv|tag|ciphertext)`. Sin prefijo (valores anteriores al
   anillo) se descifra con la llave actual: **compatible hacia atrás**.
2. **Anillo de llaves**: `KUBO_FIELD_ENCRYPTION_KEYS` = `id:hex,id:hex,...` con la
   llave **nueva al frente** (la que cifra) y las viejas detrás (las que
   descifran). Sin esa variable se usa `KUBO_FIELD_ENCRYPTION_KEY` con el id
   `default`, así que el despliegue actual sigue funcionando sin cambios.
3. **La rotación es una tarea de sistema, por lotes e idempotente**
   (`rake kubo:rotate_field_keys`): recorre los clientes y re-cifra solo lo que
   está en una llave vieja; el índice ciego se recalcula en el mismo guardado
   (los setters del modelo lo hacen). Se puede repetir tras una interrupción y
   se puede correr en caliente.
4. **Nunca se destruye un dato ilegible**: si un valor no se puede descifrar
   (llave ausente, contenido manipulado), la fila **no se toca** y se cuenta en
   el resumen (`unreadable`). Una rotación no es una purga.
5. **La tarea cruza negocios con la marca `app.system`** (política de RLS del
   CRM, migración `000004`), igual que el entregador de notificaciones del ERP.
   El camino de la petición sigue aislado por negocio.

## Consecuencias

- **Positivas**: rotar es agregar una llave al frente del anillo y correr una
  tarea; no hay ventana de indisponibilidad ni de inconsistencia; una
  interrupción se reanuda repitiendo la tarea; los datos ilegibles se preservan y
  se reportan.
- **Negativas**: el anillo crece con cada rotación y hay que retirar las llaves
  viejas cuando ya no queden valores con su id (el resumen de la tarea lo
  permite saber: cuando `rotated` es 0, las viejas sobran). La llave raíz (KEK)
  sigue viviendo en la configuración: este ADR resuelve la rotación de las llaves
  de datos, no el gobierno de la KEK (un KMS o un cofre de secretos es el paso
  siguiente). El IAM tiene su propio cifrado (secreto TOTP, ADR-0015) que puede
  adoptar el mismo anillo cuando haga falta.

## Verificación

- `kubo-crm` puras **12/12**: el formato lleva la llave, un valor sin prefijo se
  descifra con la actual, una llave desconocida no descifra nada y rotar no
  pierde el valor.
- `kubo-crm` integración **3/3** (PostgreSQL real): un cliente guardado con la
  llave vieja queda con la nueva tras la rotación, se sigue leyendo y el índice
  ciego se recalcula (la búsqueda por documento sigue encontrándolo).
- `make ci` **10/10** con la tarea integrada en el runner del CRM.
