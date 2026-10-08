# 07 — Pruebas

La verificación del sistema tiene cuatro niveles: pruebas unitarias dentro de cada
servicio, una prueba de humo end-to-end, la suite móvil en el emulador y
verificaciones manuales de operación.

## 1. Prueba de humo end-to-end (la principal)

```bash
make smoke
```

Ejecuta **192 comprobaciones** contra el sistema en ejecución, usando el API
Gateway como un cliente real. Resultado esperado: `192 pruebas exitosas, 0 fallidas`.

| Bloque | Qué verifica | Comprobaciones |
| --- | --- | --- |
| 1. Salud | Los cinco servicios de aplicación responden `UP` | 7 |
| 2. Autenticación y cookie | Login; **RS256**; negocio en el token; **JWKS**; el refresh **no viaja en el cuerpo**; cookie **httpOnly + SameSite=Strict**; rotación; el token refrescado autentica; **reuso → `401`**; **el reuso revoca la familia completa**; logout 204 y borra la cookie | 14 |
| 3. Acceso, auditoría y bloqueo | Sin token → `401`; token falsificado → `401`; cabecera inyectada → **ignorada**; negocio malformado → `400`; **5 intentos fallidos bloquean la cuenta**; **cadena de auditoría intacta** y hash versionado; usuarios y roles; **segundo factor TOTP completo** (secreto, URI, activación, desafío, código válido e inválido); deshabilitado no ingresa; eventos de seguridad en la bitácora | 23 |
| 4. Clientes, cifrado y RLS | Crear cliente; detalle completo; listado **enmascarado**; texto **cifrado**; índice ciego; **búsqueda por documento**; **RLS: sin contexto 0 filas, con contexto > 0** | 8 |
| 5. Inventario, venta y outbox | Bodega por defecto y segunda bodega; **transferencia con kardex en ambas**; cupo de bodegas por plan; venta desde la bodega elegida; aviso de stock bajo; venta por `35700.00`; IVA `5700.00`; kardex; **importación CSV**; **paginación con total real**; sobreventa → `409`; **evento en la bandeja** y publicado; **RLS en ERP** | 30 |
| 6. Evento, tablero y verticales | Proyección en analítica y MongoDB; tablero; **vista compuesta con las 7 vistas**; zona horaria del negocio; **cuatro verticales** y catálogo de arranque idempotente; servicio sin kardex y venta con mesa; reportes CSV; **factura DIAN con CUFE y XML**; comprobante PDF con hash; anti-inyección de fórmulas; outbox sin fallidos | 42 |
| 7. Anulación y nota crédito | La venta queda `VOIDED`; el inventario vuelve; una venta anulada no se factura; **nota crédito con CUDE, referencia y XML UBL**; reemisión idempotente | 10 |
| 8. Aislamiento, plataforma y cobro | Un segundo negocio no ve clientes ni catálogo; **RLS en IAM**; suspensión y reactivación; renovación del plan; **panel de plataforma con TOTP obligatorio**; uso por negocio; planes y cupos; intención de pago al precio del catálogo; **webhook firmado e idempotente** | 26 |
| 9. Recuperación de contraseña | Solicitud 204; enlace en el buzón; consumo 204; **la cuenta se desbloquea con la clave nueva**; el enlace **no se reutiliza**; sin enumeración de usuarios | 6 |
| 10. Compras, proveedores y caja | Proveedor creado; compra por `25000.00`; IVA desagregado; **entra a la bodega elegida**; bodega inexistente → `404`; soporte documental; **suma 5 unidades**; **el costo se actualiza sin IVA**; kardex `PURCHASE`; **la anulación revierte en la misma bodega**; **RLS en compras**; apertura, venta en efectivo, cierre y arqueo de caja | 20 |
| 11. Tasa, TLS y trazas | **Límite por usuario** activo; HTTPS 200; HTTP → HTTPS; HSTS; **collector de trazas arriba y recibiendo spans** | 6 |

Además del humo: **23 contratos OpenAPI** (`make contracts`), **5 pruebas de
navegador con axe** (`make e2e`), la **carga a 50 cajas** (`make load`: 100 % de ventas exitosas; p95
107 ms con 10 cajas y ~540 ms en el host de desarrollo con presión de memoria), los simulacros de bus (`make bus-drill`, 4/4) y restauración
(`make restore-drill`, 14/14), la **suite móvil** (4 flujos en el emulador Android), los **enlaces de la documentación** (98 resueltos, sin rotos) y el **PDF consolidado al día** (huella de las fuentes, sin abrir Chrome), y el gate `make ci` (13 verificaciones) que los reúne.

La prueba es **idempotente**: crea sus propios datos con marcas de tiempo y puede
ejecutarse tantas veces como haga falta.

## 2. Pruebas unitarias por servicio

```bash
# kubo-iam — 83 pruebas (tokens, identidad, TOTP, plataforma, cobro y datos fiscales)
# Incluye Testcontainers: PostgreSQL real, migraciones Flyway y RLS.
# Gate de cobertura JaCoCo ≥ 80 % en application/domain (hoy 85.2 %).
cd kubo-iam && mvn verify

# kubo-gateway — 19 pruebas (rutas, middleware de acceso, límite de tasa con Redis real, plataforma)
# Gate de Node ≥ 80 % en líneas y funciones (hoy 95.6 / 85.2).
cd kubo-gateway && npm test

# kubo-crm — 34 pruebas (13 de cifrado + 21 de integración con PostgreSQL)
# Gate SimpleCov ≥ 80 % de líneas (hoy 100 %).
./kubo-infra/scripts/crm-tests.sh

# kubo-erp — 57 pruebas ExUnit (35 puras + 22 de integración/HTTP)
# Ratchet de ExUnit ≥ 35 % (hoy 37.68 %); la capa web la cubre el humo.
./kubo-infra/scripts/erp-tests.sh

# kubo-analytics — 8 pruebas (6 unitarias + 2 de integración con MongoDB)
./kubo-infra/scripts/analytics-tests.sh

# kubo-web — 45 pruebas vitest (cola offline, politica de errores, formato,
# sistema de diseno —con focus trap y Escape del dialogo—, pantalla de ingreso
# y modo nativo —servidor configurable y HTTP nativo—)
# Gate v8: líneas/funciones/statements ≥ 85 y ramas ≥ 65.
cd kubo-web && npm test
```

**Total: 246 pruebas de servicio** (unitarias y de integración) más 192
comprobaciones end-to-end, 23 contratos, 5 pruebas de navegador con axe y los
simulacros de bus y restauración. La cobertura se vigila en CI con gates: IAM
≥ 80 % (JaCoCo, hoy 85.2 %), analítica ≥ 80 % en su módulo de procesamiento,
gateway ≥ 80 % en líneas y funciones (hoy 95.6 / 85.2), CRM ≥ 80 % de líneas
(hoy 100 %), web ≥ 85 % de líneas/funciones/statements (hoy 97.3 / 95.3 / 95.9) y
ERP con ratchet ≥ 35 % (hoy 37.68 %; la capa web la cubre el humo).

### Cómo ejecutar cada suite

```bash
make smoke                                    # 192 comprobaciones end-to-end
make bus-drill                                # 4 comprobaciones: caida del bus
make restore-drill                            # 14 comprobaciones: restauracion
make contracts                                # 23 contratos OpenAPI
make e2e                                      # 5 pruebas de navegador + axe
make load                                     # 50 cajas, p95 < 300 ms
make ci                                       # gate completo (13 verificaciones)
make pdf                                      # regenera el PDF consolidado y su huella
./kubo-web/e2e-android/run-sesion.sh          # suite móvil: 4 flujos en el emulador (Maestro)

./kubo-infra/scripts/crm-tests.sh             # 34 pruebas del CRM
./kubo-infra/scripts/erp-tests.sh             # 57 pruebas del ERP
./kubo-infra/scripts/analytics-tests.sh       # 8 pruebas de analitica
cd kubo-web && npm test                       # 45 pruebas vitest de la PWA
```

Las pruebas del ERP que no tocan base de datos son puras (aritmética decimal,
outbox, packs, facturación, documentos) y **no pueden ejecutarse dentro del
contenedor de producción**: al compilar el entorno de pruebas el contenedor se
queda sin memoria (límite de 512 MB), y además la imagen de ejecución no incluye
`test/`. Se ejecutan con más memoria y el directorio de pruebas montado
(`erp-tests.sh`, integrado en `make ci`).

### Qué cubren las pruebas unitarias

| Servicio | Casos |
| --- | --- |
| IAM | El token se firma con RS256 y tiene 3 segmentos; el JWKS **no** expone la llave privada; los refresh tokens son aleatorios y su hash es SHA-256 hex |
| Gateway | La tabla cubre los cuatro microservicios; los prefijos anidados resuelven al servicio correcto; una ruta protegida no se confunde con una pública |
| CRM | Ida y vuelta del cifrado; dos cifrados del mismo valor difieren (IV aleatorio); **GCM detecta manipulación**; el índice ciego es determinista y normalizado; enmascarado correcto; valores vacíos no se cifran |
| ERP | IVA desagregado de un precio con impuesto incluido; suma de varias líneas; producto exento; el total siempre es subtotal + impuesto |
| Analítica | Conversión de importes y cantidades desde el evento; tolerancia a entradas inválidas; normalización del detalle; fechas a UTC |

## 3. Suite móvil (emulador Android)

```bash
./kubo-web/e2e-android/run-sesion.sh    # requiere un emulador o un teléfono conectado por adb
```

Cuatro flujos de **Maestro** (`kubo-web/.maestro/`) sobre el APK real contra el
servidor de demostración: sesión (primer arranque, conexión y **restauración por
cookie**), **venta de POS**, **venta sin conexión** (la red se corta y se verifica
con `ping` desde el propio emulador; la venta queda en la cola local) y
**sincronización automática al reconectar** (la cola reintenta cada 30 s).

Corren en el flujo `Android` de GitHub Actions (emulador API 34 + Maestro; el APK
queda como artefacto de cada push). Resultado vigente: **4/4 en verde**
(2026-10-07). La instalación del APK en un equipo físico es la verificación
manual opcional (ver [`14-plan-app-movil.md`](14-plan-app-movil.md)).

## 4. Verificación manual de la interfaz

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

## 5. Verificación de seguridad

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

## 6. Rendimiento observado

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

## 7. Cobertura y pendientes vivos

Los pendientes de las fases 1 y 2 (P-06, P-08, P-09, P-10 y P-26) quedaron
**cerrados**: el CI por repositorio, las pruebas de integración contra el motor
real en los cinco servicios, los contratos ejecutables, la carga a 50 cajas y la
accesibilidad automatizada corren en `make ci`.

Lo que sigue abierto, sin bloquear el cierre:

| Tema | Estado |
| --- | --- |
| Gates de cobertura | IAM (85.2 %, JaCoCo), analítica (≥ 80 %), gateway (95.6 %), CRM (100 %), web (97.3 % de líneas) y ERP (ratchet 37.68 %; la capa web la cubre el humo 192/192) |
| Pruebas unitarias de la PWA | Vitest: cola offline, política de errores, formato, sistema de diseño —incluido el focus trap y Escape del diálogo—, pantalla de ingreso y modo nativo —servidor configurable y HTTP nativo— (45 pruebas); los flujos completos se cubren con E2E y axe |
| Proveedor tecnológico DIAN | **Proyecto listo para enchufarlo**: puerto configurable (`KUBO_BILLING_ADAPTER`), datos fiscales en el token, errores tipados y guía [`13`](13-guia-adaptador-facturacion.md); falta el adaptador del PT elegido (externo) |
| Contratos del lado del consumidor (Pact) | **Implementado**: 4 interacciones del consumidor (PWA) generan el pact y `make pact` lo verifica contra el sistema vivo; integrado en `make ci` |
| Carga con datos voluminosos | **Implementado**: `make load-big` siembra 50.000 productos y mide la busqueda (p95 233 ms a 10 cajas; 6 ms por peticion en frio) |
