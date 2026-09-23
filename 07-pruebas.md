# 07 — Pruebas

La verificación del sistema tiene tres niveles: pruebas unitarias dentro de cada
servicio, una prueba de humo end-to-end y verificaciones manuales de operación.

## 1. Prueba de humo end-to-end (la principal)

```bash
make smoke
```

Ejecuta **37 comprobaciones** contra el sistema en ejecución, usando el API
Gateway como un cliente real. Resultado esperado: `37 pruebas exitosas, 0 fallidas`.

| Bloque | Qué verifica | Comprobaciones |
| --- | --- | --- |
| 1. Salud | Los cinco servicios de aplicación responden `UP` | 5 |
| 2. Autenticación | Login devuelve token; el token es **RS256**; trae el negocio; el **JWKS** publica la llave | 4 |
| 3. Control de acceso | Sin token → `401`; token falsificado → `401`; cabecera `X-User-Id` inyectada → **ignorada** | 3 |
| 4. Clientes y cifrado | Crear cliente; detalle con documento completo; listado **enmascarado**; texto **cifrado** en PostgreSQL; índice ciego correcto; **búsqueda por documento** | 6 |
| 5. Inventario y venta | Crear producto; entrada deja 10 unidades; venta por `35700.00`; IVA desagregado `5700.00`; stock baja a 7; **kardex** con 2 movimientos; sobreventa → `409` | 8 |
| 6. Evento y tablero | La venta llega al modelo de lectura; MongoDB guarda el evento; el tablero la reporta; **la vista compuesta trae las 7 vistas en una petición**; sin vistas caídas; **la zona horaria del negocio viaja en la respuesta** | 6 |
| 7. Anulación | La venta queda `VOIDED`; el inventario vuelve a 10 | 2 |
| 8. Aislamiento | Un segundo negocio no ve clientes ni catálogo del primero | 3 |

La prueba es **idempotente**: crea sus propios datos con marcas de tiempo y puede
ejecutarse tantas veces como haga falta.

## 2. Pruebas unitarias por servicio

```bash
# kubo-iam — firma de tokens y JWKS (3 pruebas)
cd kubo-iam && mvn test

# kubo-gateway — tabla de rutas y rutas públicas (3 pruebas)
cd kubo-gateway && npm test

# kubo-crm — cifrado de campos (6 pruebas, sin base de datos)
cd kubo-crm && ruby test/field_cipher_test.rb

# kubo-erp — aritmética de dinero (4 pruebas, sin base de datos)
cd kubo-erp && mix test test/kubo_erp/sales_totals_test.exs

# kubo-analytics — conversión de eventos (6 pruebas, sin MongoDB)
cd kubo-analytics && pip install -r requirements-dev.txt && pytest -q
```

**Total: 22 pruebas unitarias** más 37 comprobaciones end-to-end.

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

## 6. Pruebas pendientes (fase 2)

| Prueba | Por qué falta |
| --- | --- |
| Integración con base de datos real por servicio | Requiere Testcontainers por lenguaje |
| Contratos (Pact/OpenAPI) automatizados | Hoy el contrato se verifica en la prueba de humo |
| Carga (k6): 50 cajas simultáneas | Falta escenario de estrés |
| E2E de navegador (Playwright) | Hoy la interfaz se verifica manualmente |
| Escaneo SAST/SCA y de secretos en CI | Las verificaciones son manuales |
| Simulacro de restauración de respaldo | Documentado, no ejecutado |
| Accesibilidad automatizada (axe) | Solo revisión manual de contraste y foco |
