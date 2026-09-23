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
make smoke          # 33 comprobaciones end-to-end, todas en verde
make ps             # los 9 contenedores en estado healthy
docker stats --no-stream   # consumo por servicio (~930 MB en total)
```

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
