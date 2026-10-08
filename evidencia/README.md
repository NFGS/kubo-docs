# Evidencia de funcionamiento

Capturas y comprobaciones del sistema en ejecución.

## Contenido

| Archivo | Qué muestra |
| --- | --- |
| `01-ingreso.png` | Pantalla de ingreso de la PWA |
| `02-tablero.png` | Tablero: ventas de hoy, serie de 14 días, top productos y medios de pago |
| `03-clientes.png` | Listado de clientes con documento y teléfono **enmascarados** |
| `04-detalle-cliente.png` | Detalle de un cliente: documento y teléfono completos (cifrados en la base) |
| `05-cifrado-en-base.txt` | Consulta real a PostgreSQL: los campos personales se guardan como `v1:default:…`, ilegibles |
| `06-productos.png` | Catálogo con precio, IVA, stock y alerta de stock bajo |
| `07-pos.png` | POS con un producto en el carrito: IVA desagregado y total a cobrar |
| `08-pos-offline.png` | Venta sin conexión: «Sin internet» y la venta en la cola de sincronización |
| `09-sincronizacion.png` | Al recuperar la conexión la venta se sincroniza y la cola queda en cero |
| `10-repositorios.txt` | Los 9 repositorios del workspace (8 hijos + el repositorio raíz) |
| `11-documentos.png` | Documentos del negocio: facturas XML, nota crédito, comprobantes PDF y soportes, con descarga autenticada |
| `demo-kubo.webm` | Recorrido guiado (≈6:25, con pausas para narrar) con subtítulos: ingreso, tablero, clientes y cifrado, catálogo, compras, caja, bodegas, POS, modo sin conexión, sincronización, documentos, notificaciones, usuarios y configuración |

Las capturas de interfaz se toman con Playwright contra la PWA en
`http://localhost:3000` (viewport 1360×880) sobre la semilla de demostración; la
secuencia sigue el guion de [`../09-demo-guion.md`](../09-demo-guion.md).
`demo-kubo.webm` es el recorrido automático con subtítulos (base visual); el
video narrado de 6–7 minutos sigue ese mismo guion.

## Regenerar la evidencia

```bash
make reset-demo                                     # demo limpia y presentable
cd kubo-web && node ../kubo-docs/scripts/capturas-evidencia.mjs --video
```

El script recorre el guion, regenera las capturas y las comprobaciones `.txt`, y
ensambla `demo-kubo.webm` con cuadros de marca de tiempo real y subtítulos
quemados (ffmpeg). Por defecto graba con pausas de 25 s por sección (≈6:25,
cómodo para narrar los 6–7 minutos del guion); `--pausa=<segundos>` ajusta el
ritmo. Requiere el sistema arriba, Chrome, `docker` y `ffmpeg`; sin `--video`
regenera solo las capturas y los `.txt`.

## Comprobaciones reproducibles

Estas verificaciones no dependen de capturas: se ejecutan y devuelven un
resultado verificable.

```bash
make smoke          # 192 comprobaciones end-to-end, todas en verde
make bus-drill      # 4 comprobaciones: caida del bus sin perdida de eventos
make restore-drill  # 14 comprobaciones: restauracion cronometrada
make contracts      # 23 contratos OpenAPI validados contra la API viva
make e2e            # 5 pruebas de navegador + accesibilidad (Playwright + axe)
make load           # 50 cajas: p95 de la venta < 300 ms
make ci             # gate completo: secretos, suites, contratos, Pact, humo, E2E, enlaces y PDF al día
make ps             # los 12 contenedores en estado healthy
make reset-demo     # deja la demostracion limpia (borra y recarga la semilla)
docker stats --no-stream   # consumo por servicio (~1 GB en total)
```

> Antes de grabar el video conviene ejecutar `make reset-demo`: elimina los
> clientes y productos que dejan las ejecuciones del humo y recarga la semilla,
> de modo que la demostración muestre solo datos presentables.
