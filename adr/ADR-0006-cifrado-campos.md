# ADR-0006 — Cifrado de datos personales con AES-256-GCM e índice ciego

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-23 |
| Estado | Aceptada |

## Contexto

El CRM guarda datos personales de clientes (documento, teléfono), protegidos por
la Ley 1581 de 2012 (habeas data). Si alguien obtiene una copia del respaldo o
accede a la base, esos datos no deben quedar legibles. Al mismo tiempo, el
negocio necesita **buscar por documento** con precisión.

## Decisión

1. **Cifrado a nivel de campo** con **AES-256-GCM** (confidencialidad +
   autenticidad: cualquier manipulación del texto cifrado se detecta y el valor
   se rechaza). Formato almacenado: `base64(iv ‖ tag ‖ ciphertext)`.
2. **Índice ciego** con HMAC-SHA256 sobre el valor normalizado, en una columna
   aparte. Permite buscar por igualdad sin descifrar y sin exponer el dato.
3. **Minimización**: los listados devuelven el valor enmascarado (`******432`);
   solo el detalle de un cliente concreto revela el valor completo.
4. Las claves llegan por variable de entorno (`KUBO_FIELD_ENCRYPTION_KEY`,
   `KUBO_BLIND_INDEX_KEY`) y **nunca** están en el repositorio.

## Alternativas consideradas

- **Cifrar toda la base** (TDE o disco cifrado): no está disponible en
  PostgreSQL comunitario y no protege contra un volcado lógico.
- **Guardar el dato en claro y confiar en los permisos**: insuficiente ante un
  respaldo filtrado, que es el escenario real más frecuente.
- **Cifrado determinista** (mismo texto cifrado para el mismo valor): permitiría
  buscar, pero filtra información por comparación. Se prefiere el índice ciego.

## Consecuencias

- **Positivas**: un volcado de la tabla no revela documentos ni teléfonos; el
  GCM detecta manipulaciones; la búsqueda sigue siendo exacta y rápida.
- **Negativas**: no se puede buscar por coincidencia parcial sobre el campo
  cifrado (solo por igualdad) y rotar la clave exige re-cifrar los registros.
- **Siguiente paso**: envoltura de claves (KEK/DEK por negocio) con un KMS para
  la versión en la nube.
