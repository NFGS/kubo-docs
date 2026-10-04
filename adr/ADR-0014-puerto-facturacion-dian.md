# ADR-0014 — Facturación electrónica DIAN como puerto enchufable

| Campo | Valor |
| --- | --- |
| Fecha | 2026-09-24 |
| Estado | Aceptada (Fase 4) |
| Relacionada | ADR-0009 (outbox transaccional) · ADR-0013 (vertical packs) |

## Contexto

La facturación electrónica en Colombia exige ser **Proveedor Tecnológico
autorizado** por la DIAN o contratar uno: el trámite es externo y no puede
bloquear el producto. Además, el documento tiene reglas propias (UBL 2.1, CUFE,
QR del catálogo, numeración, notas crédito) que cambian con la normativa.

Si el núcleo comercial llamara directamente a un proveedor concreto, cada
cambio de proveedor —o el paso de habilitación a producción— tocaría la venta,
el reporte y el comprobante.

## Decisión

La facturación es un **puerto** (`KuboErp.Billing`) con adaptadores
intercambiables:

1. **El contrato**: `issue(tenant, sale)` devuelve la representación emitida
   (`number`, `cufe`, `qr_url`, `xml`) o un error. El núcleo no conoce al
   proveedor.
2. **Adaptador por defecto** (`KuboErp.Billing.Sandbox`): genera UBL 2.1 con el
   CUFE calculado como lo define la DIAN (SHA-384 de la cadena de datos, 96
   hexadecimales), el QR del catálogo y el escapado XML. Sirve para desarrollo
   y para el ambiente de habilitación; **no tiene validez fiscal**. El NIT y la
   clave técnica son marcadores documentados: registrarlos ante la DIAN es parte
   del trámite externo.
3. **Documento inmutable**: la factura se persiste con su CUFE y su XML
   (`invoices`, con RLS como el resto de tablas de negocio). Emitir es
   **idempotente**: si la venta ya tiene factura se devuelve la existente, porque
   regenerarla cambiaría el CUFE que ya recibió el cliente.
4. **Regla de negocio**: una venta anulada no se factura (409 `SALE_VOIDED`);
   el camino correcto es una **nota crédito**, que será un documento nuevo.
5. **Datos del emisor**: el nombre del negocio viaja en el token (`tenant`) y el
   gateway lo propaga como `x-tenant-name`; el ERP no consulta IAM.

## Consecuencias

- **Positivas**: el núcleo no depende del proveedor; se puede desarrollar y
  probar sin habilitación; el paso a producción es configuración
  (`KUBO_BILLING_ADAPTER`); la factura emitida queda auditable y aislada por
  negocio.
- **Negativas**: el adaptador sandbox puede dar una falsa sensación de
  cumplimiento —por eso el plan declara la habilitación como cierre externo y el
  módulo lo advierte—. Las notas crédito **ya están** (ver «Implementado») y la
  firma XAdES queda del lado del proveedor tecnologico: el puerto entrega el
  XML y el proveedor lo firma y lo envia; implementarla nosotros sin poder
  validarla ante la DIAN seria un adorno. El detalle de por que aún no está
  implementadas: son el siguiente paso de P-18. El NIT real del emisor exigirá
  un campo en el negocio (hoy marcador).

## Verificación

- **Nota crédito (implementada)**: anular una venta facturada emite el
  documento que corrige la factura —la factura es inmutable: no se edita ni se
  borra— con su propio **CUDE** (SHA-384, 96 hexadecimales), tipo 91 y la
  referencia a la factura (número y CUFE) en UBL 2.1; su XML queda como
  documento `CREDIT_NOTE_XML`. La emisión es idempotente por venta y exige la
  venta anulada y facturada (`SALE_NOT_VOIDED`, `INVOICE_NOT_FOUND`). Evidencia:
  ERP puras **32/32** e integración **16/16**, humo **184/184** (la nota
  referencia la factura, el XML es CreditNote 91, reemitir devuelve la misma y
  sin factura no hay nota).
- `kubo-erp` puras **32/32**: CUFE hexadecimal de 96 caracteres, estable con los
  mismos datos y distinto al cambiar el total; XML UBL 2.1 con totales, NIT y
  datos escapados.
- `kubo-erp` integración **9/9**: emitir dos veces devuelve la misma factura,
  RLS la aísla por negocio y una venta anulada responde `:sale_voided`.
- `make smoke` (**125/125**): CUFE válido, idempotencia, XML UBL 2.1 con el
  nombre del negocio propagado por el gateway y 409 al facturar una venta
  anulada.

## Actualización (2026-10-03)

El puerto quedó **listo para enchufar un proveedor tecnológico** sin tocar el
núcleo:

- El adaptador se elige por configuración (`KUBO_BILLING_ADAPTER`) y el ambiente
  DIAN por `KUBO_BILLING_ENVIRONMENT` (1 producción, 2 habilitación); el ERP
  valida al arrancar que el módulo implemente el contrato.
- Los **datos fiscales del emisor** (NIT con DV calculado, dirección, régimen,
  resolución y prefijo) viven en `tenants`, se editan en Configuración y viajan
  en el token como el resto de la configuración del negocio.
- Los adaptadores reportan errores tipados (`KuboErp.Billing.Error`) y pueden
  implementar `refresh_status/1` si su proveedor valida de forma asíncrona; la
  factura guarda `status`, `provider_reference` y `status_detail`.
- Guía paso a paso: [`13-guia-adaptador-facturacion.md`](../13-guia-adaptador-facturacion.md).
- Evidencia: humo **189/189** (incluye el NIT con DV, el régimen y el prefijo en
  el XML del sandbox).
