# 13 — Guía para enchufar un proveedor tecnológico (DIAN)

Esta guía deja el proyecto **listo para conectar el proveedor tecnológico (PT)**
que el negocio elija, sin tocar el núcleo. Todo lo que hay que hacer es escribir
**un adaptador** y configurar variables de entorno.

## 1. Cómo está armado (recordatorio)

```
Venta (ERP) ──▶ KuboErp.Billing (puerto) ──▶ Adaptador configurado
                                                ├── Sandbox (por defecto, sin validez fiscal)
                                                └── KuboErp.Billing.<Proveedor> (el que se escriba)
```

- **Puerto**: `kubo-erp/lib/kubo_erp/billing.ex` (contrato).
- **Error tipado**: `kubo-erp/lib/kubo_erp/billing/error.ex`.
- **Adaptador de desarrollo**: `kubo-erp/lib/kubo_erp/billing/sandbox.ex`.
- **Persistencia**: `invoices` (inmutable, con `status`, `provider_reference` y
  `status_detail`), XML como documento y nota crédito con CUDE.

## 2. Configuración (ya cableada)

| Variable | Valores | Uso |
| --- | --- | --- |
| `KUBO_BILLING_ADAPTER` | módulo, por defecto `KuboErp.Billing.Sandbox` | Qué adaptador se usa |
| `KUBO_BILLING_ENVIRONMENT` | `1` producción, `2` habilitación (por defecto `2`) | Ambiente DIAN |

El ERP valida al arrancar que el módulo implemente el puerto: si no, falla con
un error claro en vez de emitir documentos inválidos. El estado activo se ve en
`GET /api/v1/health` → `billing: { adapter, environment }`.

## 3. Datos fiscales del emisor (ya existen)

El negocio los registra una vez en **Configuración → Datos fiscales** (o por
`PATCH /api/v1/tenants/me`): NIT (el DV lo calcula el servidor), dirección,
régimen (`RESPONSABLE_IVA`, `NO_RESPONSABLE_IVA`, `SIMPLE`), resolución y
prefijo. Viajan en el **token** y el gateway los propaga como cabeceras
verificadas (`x-tenant-tax-id`, `x-tenant-tax-id-dv`, `x-tenant-fiscal-address`,
`x-tenant-tax-regime`, `x-tenant-invoice-resolution`, `x-tenant-invoice-prefix`).
El adaptador los recibe en el mapa `tenant`; **no** debe consultar IAM.

## 4. Paso a paso para escribir el adaptador

1. **Crea el módulo** `kubo-erp/lib/kubo_erp/billing/<proveedor>.ex`:

```elixir
defmodule KuboErp.Billing.MiProveedor do
  @behaviour KuboErp.Billing

  alias KuboErp.Billing.Error

  @impl true
  def issue(tenant, sale) do
    with {:ok, credenciales} <- credenciales(),
         {:ok, respuesta} <- enviar("/invoices", payload(tenant, sale), credenciales) do
      {:ok,
       %{
         number: respuesta["number"],
         cufe: respuesta["cufe"],
         qr_url: respuesta["qr_url"],
         xml: respuesta["xml"],
         status: respuesta["status"] || "ISSUED",
         provider_reference: respuesta["id"]
       }}
    else
      {:error, %Error{} = error} -> {:error, error}
      {:error, razon} -> {:error, Error.new(:network, "El proveedor no respondio", inspect(razon))}
    end
  end

  @impl true
  def issue_credit_note(tenant, sale, invoice, reason) do
    # Igual que issue/2 pero contra el endpoint de notas credito; devuelve cude.
    # ...
  end

  # Opcional: solo si el proveedor valida de forma asincrona.
  # @impl true
  # def refresh_status(invoice), do: ...

  defp credenciales do
    case {System.get_env("KUBO_PT_API_KEY"), System.get_env("KUBO_PT_BASE_URL")} do
      {nil, _} -> {:error, Error.new(:not_configured, "Falta KUBO_PT_API_KEY")}
      {_, nil} -> {:error, Error.new(:not_configured, "Falta KUBO_PT_BASE_URL")}
      {api_key, base} -> {:ok, %{api_key: api_key, base: base}}
    end
  end

  defp enviar(ruta, cuerpo, credenciales) do
    case Req.post("#{credenciales.base}#{ruta}",
           json: cuerpo,
           headers: [{"authorization", "Bearer #{credenciales.api_key}"}],
           receive_timeout: 15_000
         ) do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: 422, body: body}} -> {:error, Error.new(:rejected, "El proveedor rechazo el documento", body["message"])}
      {:ok, %{status: 401}} -> {:error, Error.new(:not_configured, "Credenciales del proveedor invalidas")}
      {:ok, %{status: status}} -> {:error, Error.new(:network, "Respuesta inesperada del proveedor (#{status})")}
      {:error, razon} -> {:error, Error.new(:network, "No fue posible contactar al proveedor", inspect(razon))}
    end
  end

  defp payload(tenant, sale) do
    %{
      # Los datos fiscales del emisor ya vienen verificados en `tenant`.
      issuer: %{nit: tenant.tax_id, dv: tenant.tax_id_dv, name: tenant.name, address: tenant.fiscal_address, regime: tenant.tax_regime, prefix: tenant.invoice_prefix},
      reference: sale.id,
      customer: %{name: sale.customer_name},
      payment_method: sale.payment_method,
      subtotal: sale.subtotal,
      tax: sale.tax,
      total: sale.total,
      items: Enum.map(sale.items, &%{name: &1.product_name, quantity: &1.quantity, unit_price: &1.unit_price, tax_amount: &1.tax_amount})
    }
  end
end
```

2. **Registra el adaptador** en `kubo-infra/.env` (y en el despliegue):
   ```bash
   KUBO_BILLING_ADAPTER=KuboErp.Billing.MiProveedor
   KUBO_BILLING_ENVIRONMENT=2   # habilitación; 1 cuando la DIAN lo apruebe
   KUBO_PT_API_KEY=...          # credenciales del PT, nunca en el repositorio
   KUBO_PT_BASE_URL=https://sandbox.miproveedor.co
   ```
   Añade también las variables al compose si son nuevas (patrón:
   `KUBO_PT_*: ${KUBO_PT_*:-}`).

3. **Idempotencia**: envía `sale.id` como referencia al PT. Si la red falla y el
   ERP reintenta, el PT no debe emitir dos veces (el ERP además ya no regenera:
   si la venta tiene factura, devuelve la existente).

4. **Pruebas** con `Req.Test` (no necesitas el PT real):
   ```elixir
   test "emite la factura con el proveedor" do
     Req.Test.stub(KuboErp.Billing.MiProveedor, fn conn ->
       Req.Test.json(conn, %{number: "FE-1", cufe: String.duplicate("a", 96), qr_url: "https://...", xml: "<Invoice/>", status: "ISSUED", id: "pt-1"})
     end)
     # configurar Req con el stub y llamar Billing.issue/2
   end
   ```
   El adaptador debe pasar además el contrato común del sandbox (CUFE de 96
   hexadecimales, XML UBL 2.1, nota crédito con CUDE) que ya vive en
   `test/kubo_erp/billing/sandbox_test.exs`.

5. **Verifica en el ambiente de habilitación**: con `KUBO_BILLING_ENVIRONMENT=2`
   emite facturas reales de prueba y revisa que la DIAN las acepte. Cuando todo
   esté en verde, cambia a `1`.

## 5. Errores (contrato de la capa web)

| Código del adaptador | HTTP | Significado |
| --- | --- | --- |
| `:not_configured` | 503 | Faltan credenciales o no hay adaptador real |
| `:not_supported` | 501 | El PT no ofrece esa operación (p. ej. estado en línea) |
| `:network` | 503 | El PT no respondió; reintentable |
| `:rejected` | 422 | El PT o la DIAN rechazaron el documento (trae detalle) |
| `:validation` | 422 | Los datos no cumplen el contrato del PT |

## 6. Lo que **no** debe hacer el adaptador

- **No** firmar XAdES ni enviar a la DIAN: eso lo hace el PT (ADR-0014).
- **No** leer bases de otros servicios ni IAM: los datos fiscales llegan en el
  token.
- **No** guardar secretos en el repositorio: van en `.env`/compose.
- **No** regenerar una factura existente: es inmutable (cambiarla cambiaría el
  CUFE que ya recibió el cliente).

## 7. Checklist externo del negocio (paralelo al desarrollo)

1. RUT y responsabilidades al día.
2. Habilitación como facturador electrónico ante la DIAN (entrega la clave
   técnica y la resolución de facturación).
3. Contrato con el PT y sus credenciales de sandbox/producción.
4. Certificado digital (normalmente lo gestiona el PT).
5. Cargar los datos fiscales en Kubo (NIT, dirección, régimen, resolución,
   prefijo) y probar una factura de habilitación.

## 8. Estado actual (sandbox)

Con el adaptador por defecto, el humo comprueba la cadena completa: datos
fiscales con DV calculado, cabeceras verificadas del gateway, NIT con DV en el
XML, prefijo del negocio y estado `ISSUED`. Evidencia: `make smoke` **189/189**.
