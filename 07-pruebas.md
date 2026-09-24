# 07 — Pruebas

La verificación del sistema tiene tres niveles: pruebas unitarias dentro de cada
servicio, una prueba de humo end-to-end y verificaciones manuales de operación.

## 1. Prueba de humo end-to-end (la principal)

```bash
make smoke
```

Ejecuta **78 comprobaciones** contra el sistema en ejecución, usando el API
Gateway como un cliente real. Resultado esperado: `78 pruebas exitosas, 0 fallidas`.

| Bloque | Qué verifica | Comprobaciones |
| --- | --- | --- |
| 1. Salud | Los cinco servicios de aplicación responden `UP` | 5 |
| 2. Autenticación y cookie | Login; **RS256**; negocio en el token; **JWKS**; el refresh **no viaja en el cuerpo**; la cookie es **httpOnly + SameSite=Strict**; rotación; el token refrescado autentica; **reuso → `401`**; **el reuso revoca la familia completa**; logout 204 y borra la cookie | 14 |
| 3. Acceso, auditoría y bloqueo | Sin token → `401`; token falsificado → `401`; cabecera inyectada → **ignorada**; **5 intentos fallidos bloquean la cuenta**; **cadena intacta**; entradas verificadas; **versión vigente del hash**; `LOGIN_FAILED`, `ACCOUNT_LOCKED` y `REFRESH_REUSE_DETECTED` en la bitácora | 11 |
| 4. Clientes, cifrado y RLS | Crear cliente; detalle completo; listado **enmascarado**; texto **cifrado**; índice ciego; **búsqueda por documento**; **RLS: sin contexto 0 filas, con contexto > 0** | 8 |
| 5. Inventario, venta y outbox | Producto; entrada de 10; venta por `35700.00`; IVA `5700.00`; stock 7; kardex 2; sobreventa → `409`; **el evento queda en la bandeja**; **se publica**; **RLS en ERP** (0 y > 0); **paginación con total real y tope de página** | 14 |
| 6. Evento y tablero | Proyección en analítica; evento en MongoDB; tablero; **vista compuesta con las 7 vistas**; sin vistas caídas; zona horaria; **outbox sin fallidos** | 7 |
| 7. Anulación | La venta queda `VOIDED`; el inventario vuelve a 10 | 2 |
| 8. Aislamiento | Un segundo negocio no ve clientes ni catálogo; **RLS en IAM** (0 filas sin contexto) | 4 |
| 9. Recuperación de contraseña | Solicitud 204; enlace en el buzón; consumo 204; **la cuenta se desbloquea con la clave nueva**; el enlace **no se reutiliza**; sin enumeración de usuarios | 6 |
| 10. Tasa, TLS y trazas | **Límite por usuario** activo; HTTPS 200; HTTP → HTTPS (308); HSTS; **collector de trazas arriba y recibiendo spans** | 6 |

Además del humo, la Fase 2 agregó: **8 contratos OpenAPI** (`make contracts`),
**4 pruebas de navegador con axe** (`make e2e`), la **carga a 50 cajas**
(`make load`, p95 < 300 ms), los simulacros de bus y restauración, y el gate
`make ci` que los reúne.

La prueba es **idempotente**: crea sus propios datos con marcas de tiempo y puede
ejecutarse tantas veces como haga falta.

## 2. Pruebas unitarias por servicio

```bash
# kubo-iam — tokens, reglas de identidad y integración real (31 pruebas)
# Incluye Testcontainers: PostgreSQL real, migraciones Flyway y RLS.
cd kubo-iam && mvn verify

# kubo-gateway — tabla de rutas y rutas públicas (3 pruebas)
cd kubo-gateway && npm test

# kubo-crm — cifrado de campos (8 pruebas, sin base de datos)
cd kubo-crm && ruby test/field_cipher_test.rb

# kubo-erp — aritmética de dinero y outbox (7 pruebas, sin base de datos)
docker run --rm -m 3g -e MIX_ENV=test \
  -v "$PWD/kubo-erp/test:/app/test:ro" --entrypoint bash kubo-kubo-erp \
  -c "cd /app && mix compile >/dev/null 2>&1 && ERL_LIBS=/app/_build/test/lib \
      elixir -e 'ExUnit.start(); Code.require_file(\"test/kubo_erp/sales_totals_test.exs\"); \
      Code.require_file(\"test/kubo_erp/outbox_test.exs\")'"

# kubo-analytics — conversión de eventos (6 pruebas, sin MongoDB)
cd kubo-analytics && pip install -r requirements-dev.txt && pytest -q
```

**Total: 55 pruebas** (unitarias y de integración) más 78 comprobaciones
end-to-end, 8 contratos y 4 pruebas de navegador. La cobertura de dominio se
vigila en CI: IAM ≥ 80 % (JaCoCo) y analítica ≥ 80 % en su módulo de
procesamiento (pytest-cov).

### Cómo ejecutar cada suite

```bash
make smoke                                    # 78 comprobaciones end-to-end
make bus-drill                                # 4 comprobaciones: caida del bus
make restore-drill                            # 14 comprobaciones: restauracion

cd kubo-iam        && mvn test                # 7 pruebas
cd kubo-gateway    && npm test                # 3 pruebas
cd kubo-crm        && ruby test/field_cipher_test.rb   # 8 pruebas
cd kubo-analytics  && pytest -q               # 6 pruebas
```

Las 7 pruebas de `kubo-erp` son puras (aritmética decimal y outbox) y **no pueden
ejecutarse dentro del contenedor de producción**: al compilar el entorno de
pruebas el contenedor se queda sin memoria (límite de 512 MB), y además la imagen
de ejecución no incluye `test/`. Se ejecutan con más memoria y el directorio de
pruebas montado (comando completo arriba), o en CI con 3 GB.

### Qué cubren las pruebas unitarias

| Servicio | Casos |
| --- | --- |
| IAM | El token se firma con RS256 y tiene 3 segmentos; el JWKS **no** expone la llave privada; los refresh tokens son aleatorios y su hash es SHA-256 hex |
| Gateway | La tabla cubre los cuatro microservicios; los prefijos anidados resuelven al servicio correcto; una ruta protegida no se confunde con una pública |
| CRM | Ida y vuelta del cifrado; dos cifrados del mismo valor difieren (IV aleatorio); **GCM detecta manipulación**; el índice ciego es determinista y normalizado; enmascarado correcto; valores vacíos no se cifran |
| ERP | IVA desagregado de un precio con impuesto incluido; suma de varias líneas; producto exento; el total siempre es subtotal + impuesto |
| Analítica | Conversión de importes y cantidades desde el evento; tolerancia a entradas inválidas; normalización del detalle; fechas a UTC |

## 3. Verificación manual de la interfaz

| # | Paso | Resultado esperado |
| --- | --- | --- |
| 1 | Abrir `http://localhost:3000` | Pantalla de ingreso con la marca Kubo |
| 2 | Ingresar con `admin@kubo.local` / `Admin123!` | Tablero con indicadores |
| 3 | Instalar la aplicación desde el navegador | Se abre a pantalla completa, sin barra del navegador |
| 4 | Registrar una venta en el POS | Aparece el número de venta y el tablero se actualiza |
| 5 | Activar el modo avión y vender | Etiqueta «Sin internet» y la venta queda en cola |
| 6 | Recuperar la conexión | La venta se sincroniza y el contador desaparece |
| 7 | Abrir un cliente | Documento completo; en el listado, enmascarado |
| 8 | Registrar una entrada de inventario | El stock sube y el movimiento queda en el kardex |
| 9 | Intentar vender más unidades que el stock | Mensaje «Stock insuficiente» con la cantidad disponible |
| 10 | En el ingreso, «¿Olvidaste tu contraseña?» → pedir el enlace | El correo queda en el buzón de demostración (`mail_outbox`) y el enlace de `/recuperar?token=…` permite elegir una contraseña nueva |

## 4. Verificación de seguridad

```bash
# Sin token
curl -o /dev/null -w '%{http_code}\n' http://localhost:9080/api/v1/customers        # 401

# Suplantación por cabecera
curl -o /dev/null -w '%{http_code}\n' http://localhost:9080/api/v1/customers \
  -H 'X-User-Id: 00000000-0000-0000-0000-000000000000'                              # 401

# El texto cifrado no contiene el documento
docker exec kubo-postgres psql -U kubo_root -d kubo_crm -c \
  "select document_number_encrypted from customers limit 1"

# La llave privada no se publica
curl -s http://localhost:9080/api/v1/auth/.well-known/jwks.json | grep -c '"d"'    # 0

# Límite de tasa en autenticación
for i in $(seq 1 50); do
  curl -s -o /dev/null -w '%{http_code} ' -X POST http://localhost:9080/api/v1/auth/login \
    -H 'Content-Type: application/json' -d '{"email":"x@x.co","password":"malo"}'
done; echo                                                                          # incluye 429
```

## 5. Rendimiento observado

Medido en un equipo de 16 núcleos, a través del gateway (la latencia que percibe
el usuario):

| Operación | Tiempo |
| --- | --- |
| Login (BCrypt + firma RSA) | ~75 ms |
| Registrar venta (transacción + kardex) | ~45 ms |
| Consultar catálogo (300 productos) | ~6 ms |
| **Tablero completo (vista compuesta BFF)** | **~25 ms** (antes 108 ms en 7 viajes) |
| Búsqueda por texto con 50.000 registros (ERP) | ~5.7 ms (antes 46 ms) |
| Búsqueda por texto con 50.000 registros (CRM) | ~4.4 ms (antes 28 ms) |
| Propagación del evento a MongoDB | < 1 s |
| Arranque completo del sistema | ~50 s |
| Consumo en reposo | ~930 MB |

El detalle de las mediciones, los planes de ejecución y su análisis están en
[`10-auditoria.md`](10-auditoria.md).

## 6. Pruebas pendientes (fases 1 y 2)

| Prueba | ID · Fase | Por qué falta |
| --- | --- | --- |
| Integración con base de datos real por servicio | P-08 · Fase 2 | IAM ya la tiene (Testcontainers + RLS); falta replicarla en analítica y los demás servicios |
| Contratos (Pact/OpenAPI) automatizados | P-09 · Fase 2 | Hoy el contrato se verifica en la prueba de humo |
| Carga (k6): 50 cajas simultáneas | P-10 · Fase 2 | Falta escenario de estrés |
| E2E de navegador (Playwright) | P-10 · Fase 2 | Hoy la interfaz se verifica manualmente |
| Escaneo SAST/SCA y de secretos en CI | P-06 · Fase 2 | Las verificaciones son manuales |
| Accesibilidad automatizada (axe) | P-26 · Fase 2 | Solo revisión manual de contraste y foco |
