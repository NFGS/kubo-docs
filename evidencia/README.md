# Evidencia de funcionamiento

Capturas y comprobaciones del sistema en ejecución.

## Contenido

| Archivo | Qué muestra |
| --- | --- |
| `01-ingreso.png` | Pantalla de ingreso de la PWA, renderizada desde el contenedor `kubo-web` |

## Comprobaciones reproducibles

Estas verificaciones no dependen de capturas: se ejecutan y devuelven un
resultado verificable.

```bash
make smoke          # 87 comprobaciones end-to-end, todas en verde
make bus-drill      # 4 comprobaciones: caida del bus sin perdida de eventos
make restore-drill  # 14 comprobaciones: restauracion cronometrada
make contracts      # 8 contratos OpenAPI validados contra la API viva
make e2e            # 4 pruebas de navegador + accesibilidad (Playwright + axe)
make load           # 50 cajas: p95 de la venta < 300 ms
make ci             # gate completo: secretos, suites, contratos, humo y E2E
make ps             # los 12 contenedores en estado healthy
make reset-demo     # deja la demostracion limpia (borra y recarga la semilla)
docker stats --no-stream   # consumo por servicio (~1 GB en total)
```

> Antes de grabar el video conviene ejecutar `make reset-demo`: elimina los
> clientes y productos que dejan las ejecuciones del humo y recarga la semilla,
> de modo que la demostración muestre solo datos presentables.

## Capturas pendientes (para el video)

Chrome en modo *headless* no completa la restauración de sesión del SPA
(limitación del navegador sin interfaz, no del sistema), así que las capturas del
interior se toman desde el navegador real durante la grabación:

| # | Pantalla | Cómo llegar | Qué debe verse |
| --- | --- | --- | --- |
| 02 | Tablero | Ingresar con `admin@kubo.local` / `Admin123!` | Ventas de hoy, serie de 14 días, top productos, medios de pago |
| 03 | Clientes | Menú **Clientes** | Documento enmascarado (`*******432`) |
| 04 | Detalle de cliente | Clic en un cliente | Documento completo |
| 05 | Cifrado en la base | `docker exec kubo-postgres psql -U kubo_root -d kubo_crm -c "select name, left(document_number_encrypted,28) from customers limit 3"` | Texto cifrado ilegible |
| 06 | Productos | Menú **Productos** | Precio, IVA, stock y alerta de stock bajo |
| 07 | POS | Menú **Vender** con productos en el carrito | Total y IVA desagregado |
| 08 | Modo sin conexión | Activar modo avión y cobrar | Etiqueta «Sin internet» y venta en cola |
| 09 | Sincronización | Recuperar la conexión | La venta pendiente desaparece |
| 10 | Repositorios | `ls -d kubo-*/` | Los 9 repositorios |

La secuencia completa, con tiempos y texto sugerido, está en
[`../09-demo-guion.md`](../09-demo-guion.md).
