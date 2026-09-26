# ADR-0022 — Operador de respaldos: contenedor con verificación de restauración

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada (Fase 5) |
| Relacionada | ADR-0018 (documentos) · ADR-0020 (malla interna) |

## Contexto

El respaldo existe desde la Fase 0 (`make backup`): `pg_dump` de las tres bases,
`mongodump` de analítica, la configuración y retención por días, con un
`systemd` timer sugerido para un servidor. Pero es **manual y sin verificación**,
y tiene un hueco real: **no incluye el volumen de documentos** (P-25) —los XML
de las facturas y los comprobantes en PDF viven en disco, no en la base—, así
que un respaldo "completo" perdería los documentos fiscales.

Un respaldo que nunca se restaura no es un respaldo: es una carpeta con fechas.

## Decisión

1. **Operador en contenedor** (`kubo-backup`, perfil `backup` de compose): un
   servicio que corre el ciclo (respaldo → retención → verificación) sin depender
   del host ni del socket de Docker. Habla con Postgres y Mongo **por la red del
   compose** con los clientes oficiales; los documentos los lee del volumen
   montado en solo lectura. El `systemd` timer sigue valiendo para un servidor
   sin el perfil.
2. **El respaldo incluye los documentos**: el volumen `documents` se empaqueta
   junto a las bases. Un respaldo sin los documentos no restaura un negocio.
3. **Verificación obligatoria**: después de cada respaldo, el operador
   **restaura** los dumps en bases de usar y tirar, compara **conteos clave**
   (productos, ventas, clientes, usuarios) contra el origen y deja el resultado
   en el manifiesto. Si la verificación falla, el respaldo se marca `FALLIDO` y
   el ciclo termina con error (un respaldo no verificado no debe pasar por bueno).
4. **Manifiesto con integridad**: fecha, versión del esquema, conteos, resultado
   de la verificación y **SHA-256** de cada archivo. Permite comprobar un
   respaldo viejo sin restaurarlo entero.
5. **Retención declarada**: `KUBO_BACKUP_RETENTION_DAYS` (por defecto 14) y
   `KUBO_BACKUP_KEEP_MIN` (por defecto 3): se conservan al menos los últimos N
   aunque la retención por días los alcance —un negocio que estuvo cerrado una
   semana no debe quedarse sin ningún respaldo—.
6. **El destino es un puerto**: por defecto el volumen local; una copia fuera
   del sitio (otro disco montado o un bucket) se configura con
   `KUBO_BACKUP_OFFSITE_DIR` (copia posterior al ciclo). Un adaptador de objeto
   (S3/Cloudinary) es el siguiente paso natural, igual que en documentos.

## Consecuencias

- **Positivas**: el respaldo pasa a ser un ciclo verificable y completo
  (documentos incluidos); la verificación detecta dumps corruptos o migraciones
  rotas antes de necesitarlos; el manifiesto con hashes permite auditar sin
  restaurar.
- **Negativas**: la verificación consume recursos (restaura las bases en un
  contenedor pequeño): se ejecuta con `pg_restore --jobs=2` y bases temporales
  que se borran al terminar; en un servidor muy modesto puede desactivarse con
  `KUBO_BACKUP_VERIFY=false`, y entonces el manifiesto lo declara
  (`verificacion=omitida`) en lugar de mentir.

## Verificación

- `make backup-operator`: ejecuta un ciclo completo y deja el manifiesto con
  `verificacion=ok` y los conteos; un respaldo con `verificacion=fallida`
  termina con código de salida distinto de cero.
- `make restore-drill`: sigue siendo la prueba de restauración **completa** en
  bases de prueba (el operador verifica conteos en cada ciclo; el simulacro
  restaura y valida la aplicación contra los datos).
- El volumen de documentos aparece en el archivo del respaldo y en el
  manifiesto.
