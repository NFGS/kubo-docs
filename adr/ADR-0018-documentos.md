# ADR-0018 — Documentos: en el ERP, con puerto de almacenamiento

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada (Fase 4) |
| Relacionada | ADR-0002 (database-per-service) · ADR-0014 (facturación) · ADR-0017 (notificaciones) |

## Contexto

El plan de cierre (P-25) deja abierto **dónde** viven los documentos —el XML de
la factura, el comprobante, los soportes de una compra—: ¿un quinto
microservicio de Documentos, como figuraba en la trazabilidad, o dentro del ERP?

Los hechos que enmarcan la decisión:

- **El ERP ya es el dueño de los documentos**: emite la factura (XML + CUFE),
  imprime el comprobante y exporta los reportes. Un servicio aparte solo
  recibiría bytes sin conocer su negocio ni su vigencia.
- **Kubo es autoalojable para un negocio de barrio**: cada servicio extra es un
  contenedor más que el dueño (o su técnico) debe operar, actualizar y respaldar.
- **El volumen es pequeño**: un negocio emite decenas de documentos al día, no
  millones de objetos.
- **La nube es opcional, no un supuesto**: un despliegue puede querer guardar los
  documentos en un bucket (S3, Cloudinary) y otro en el disco del servidor.

## Decisión

1. **Los documentos viven en el ERP** (`documents`), no en un quinto servicio.
   El ERP es el dueño del dato de negocio que los origina y puede aplicar la
   misma RLS, la misma auditoría y el mismo respaldo que el resto.
2. **El almacenamiento es un puerto** (`KuboErp.Documents.Storage`): el
   adaptador por defecto escribe en el sistema de archivos
   (`KUBO_DOCUMENTS_PATH`, un volumen del despliegue); un adaptador de objeto
   (S3/Cloudinary) implementa el mismo contrato. La fila de `documents` guarda
   los metadatos y la **clave** del objeto, no los bytes: la base no engorda y el
   respaldo de la base y el de los archivos pueden tener políticas distintas.
3. **Integridad**: cada documento guarda el **SHA-256** de su contenido. Un
   documento fiscal no se edita: si el contenido cambia, es otro documento.
4. **La descarga pasa por el ERP** (`GET /documents/:id`), que resuelve la clave
   en el almacenamiento y responde con su tipo de contenido. Así el aislamiento
   por negocio se aplica igual que en el resto del API y el almacenamiento no
   necesita ser público.
5. **Primer documento: el XML de la factura**, guardado al emitirla. Un
   documento se crea como **consecuencia de un hecho de negocio**, no por una
   subida manual: eso deja la trazabilidad cerrada (factura ↔ documento).

## Consecuencias

- **Positivas**: cero servicios nuevos que operar; el aislamiento, la auditoría y
  el respaldo son los del ERP; cambiar a almacenamiento de objetos es escribir un
  adaptador; la integridad queda verificable por el hash.
- **Negativas**: el disco del ERP pasa a ser estado que hay que respaldar (se
  documenta en el runbook; el `backup.sh` deberá incluir el volumen); si algún día
  los documentos crecen a millones de objetos o varios servicios necesitan
  consumirlos, este ADR se revisa —la migración es barata porque los metadatos y
  la clave ya están separados—. El PDF del comprobante sigue generándose en el
  navegador (impresión), no en el servidor: no se introduce un motor de PDF.

## Verificación

- `kubo-erp` integración **12/12**: emitir una factura deja un documento
  `INVOICE_XML` con el hash de su contenido, y el contenido leído coincide con
  el XML emitido.
- `make smoke` (**149/149**): la factura de la venta de prueba produce un
  documento descargable con su **SHA-256** verificado, y la compra acepta un
  soporte adjunto (rechazando un formato no soportado).
- `make contracts` (**20/20**): `DocumentList` validado contra la API viva.
- **Soportes de compra**: `POST /purchases/:id/documents` acepta el archivo
  (multipart, hasta 5 MB, formatos de documento e imagen) y lo liga a la compra;
  un formato no soportado responde `INVALID_EXTENSION`.
- **Pendiente declarado**: PDF del comprobante en servidor (el navegador ya
  imprime) y el adaptador de almacenamiento de objetos.
