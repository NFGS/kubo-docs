#!/bin/bash
# ---------------------------------------------------------------------------
# Genera el PDF consolidado de la documentacion de Kubo.
#
# Convierte cada documento Markdown a HTML con estilos propios y luego usa
# Chrome/Chromium en modo headless para imprimir el resultado a PDF.
#
# Uso:  ./kubo-docs/scripts/build-pdf.sh [salida.pdf]
# ---------------------------------------------------------------------------
set -euo pipefail

DOCS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE_DIR="$(cd "${DOCS_DIR}/.." && pwd)"
OUTPUT="${1:-${WORKSPACE_DIR}/Kubo-Documentacion.pdf}"
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "${BUILD_DIR}"' EXIT

# Navegador disponible (Chrome o Chromium)
BROWSER=""
for candidate in google-chrome chromium chromium-browser; do
  if command -v "${candidate}" >/dev/null 2>&1; then
    BROWSER="${candidate}"
    break
  fi
done
if [[ -z "${BROWSER}" ]]; then
  echo "ERROR: se requiere Google Chrome o Chromium para generar el PDF" >&2
  exit 1
fi

DOCUMENTOS=(
  "README.md"
  "01-arquitectura.md"
  "02-modelo-datos.md"
  "03-api.md"
  "04-seguridad.md"
  "05-despliegue.md"
  "06-manual-usuario.md"
  "07-pruebas.md"
  "08-trazabilidad.md"
  "09-demo-guion.md"
  "adr/ADR-0001-microservicios-monolito-modular.md"
  "adr/ADR-0002-polyrepo-contratos.md"
  "adr/ADR-0003-multitenancy-hibrido.md"
  "adr/ADR-0004-poliglotismo.md"
  "adr/ADR-0005-eventos-rabbitmq.md"
  "adr/ADR-0006-cifrado-campos.md"
  "adr/ADR-0007-jwt-rs256-jwks.md"
  "adr/ADR-0008-alcance-mvp.md"
)

# ---------------------------------------------------------------------------
# 1. Portada y estilos
# ---------------------------------------------------------------------------
cat > "${BUILD_DIR}/documento.html" <<'HTML'
<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<title>Kubo — Documentación</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #0f172a; line-height: 1.6; font-size: 11pt; }
  .portada { text-align: center; padding-top: 60mm; page-break-after: always; }
  .portada .logo { display: inline-grid; place-items: center; width: 84px; height: 84px;
                   border-radius: 22px; background: #4f46e5; color: #fff;
                   font-size: 44px; font-weight: 700; }
  .portada h1 { font-size: 32pt; margin: 18px 0 4px; letter-spacing: -0.5px; }
  .portada .sub { color: #64748b; font-size: 13pt; margin: 0; }
  .portada .meta { margin-top: 30mm; color: #94a3b8; font-size: 10pt; }
  h1 { font-size: 20pt; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;
       margin-top: 0; page-break-before: always; }
  h1:first-of-type { page-break-before: avoid; }
  h2 { font-size: 14pt; color: #1e293b; margin-top: 20px; }
  h3 { font-size: 12pt; color: #334155; }
  code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px;
         font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 9.5pt; }
  pre { background: #0f172a; color: #e2e8f0; padding: 12px 14px; border-radius: 8px;
        overflow-x: auto; font-size: 9pt; page-break-inside: avoid; }
  pre code { background: transparent; color: inherit; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 9.5pt;
          page-break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 9px; text-align: left;
           vertical-align: top; }
  th { background: #f1f5f9; font-weight: 600; }
  blockquote { border-left: 4px solid #4f46e5; margin: 12px 0; padding: 6px 14px;
               background: #eef2ff; color: #3730a3; }
  a { color: #4f46e5; text-decoration: none; }
  ul, ol { padding-left: 22px; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 22px 0; }
</style>
</head>
<body>
<div class="portada">
  <div class="logo">K</div>
  <h1>Kubo</h1>
  <p class="sub">ERP + CRM autoalojable para PYMES</p>
  <p class="sub">Documentación técnica y funcional</p>
  <div class="meta">
    Versión 0.1.0-mvp · Armenia, Quindío · Licencia MIT<br>
    Generado el GENERADO_EL
  </div>
</div>
HTML

# ---------------------------------------------------------------------------
# 2. Cuerpo: se insertan los documentos en orden
# ---------------------------------------------------------------------------
for documento in "${DOCUMENTOS[@]}"; do
  ruta="${DOCS_DIR}/${documento}"
  if [[ ! -f "${ruta}" ]]; then
    echo "aviso: no se encontró ${documento}" >&2
    continue
  fi
  echo "<article>" >> "${BUILD_DIR}/documento.html"
  if command -v pandoc >/dev/null 2>&1; then
    pandoc -f gfm -t html "${ruta}" >> "${BUILD_DIR}/documento.html"
  else
    # Conversión mínima sin pandoc: se conserva el texto y los bloques de código.
    python3 - "${ruta}" >> "${BUILD_DIR}/documento.html" <<'PYTHON'
import html, re, sys

texto = open(sys.argv[1], encoding="utf-8").read()
salida, en_codigo = [], False
for linea in texto.splitlines():
    if linea.startswith("```"):
        salida.append("</pre>" if en_codigo else "<pre>")
        en_codigo = not en_codigo
        continue
    if en_codigo:
        salida.append(html.escape(linea))
        continue
    if linea.startswith("#"):
        nivel = len(linea) - len(linea.lstrip("#"))
        salida.append(f"<h{nivel}>{html.escape(linea[nivel:].strip())}</h{nivel}>")
    elif linea.startswith("|"):
        salida.append(html.escape(linea))
    elif linea.strip() == "":
        salida.append("")
    else:
        salida.append(f"<p>{html.escape(linea)}</p>")
if en_codigo:
    salida.append("</pre>")
print("\n".join(salida))
PYTHON
  fi
  echo "</article>" >> "${BUILD_DIR}/documento.html"
done

echo "</body></html>" >> "${BUILD_DIR}/documento.html"

# ---------------------------------------------------------------------------
# 3. Impresión a PDF con el navegador en modo headless
# ---------------------------------------------------------------------------
sed -i "s/GENERADO_EL/$(date '+%Y-%m-%d')/" "${BUILD_DIR}/documento.html"

echo "[kubo] imprimiendo PDF con ${BROWSER}…"
"${BROWSER}" \
  --headless \
  --disable-gpu \
  --no-sandbox \
  --no-pdf-header-footer \
  --print-to-pdf="${OUTPUT}" \
  --virtual-time-budget=8000 \
  "file://${BUILD_DIR}/documento.html" >/dev/null 2>&1

if [[ -f "${OUTPUT}" ]]; then
  echo "[kubo] PDF generado: ${OUTPUT} ($(du -h "${OUTPUT}" | cut -f1))"
else
  echo "ERROR: no se pudo generar el PDF" >&2
  exit 1
fi
