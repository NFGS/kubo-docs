#!/bin/bash
# ---------------------------------------------------------------------------
# Verifica que el PDF consolidado corresponda a las fuentes actuales (P-06).
#
# El PDF se genera a mano con `make pdf`; esta comprobacion corre en `make ci`
# y compara la huella de las fuentes contra la que quedo junto al PDF. Si la
# documentacion cambio sin regenerarlo, el gate falla con la instruccion.
#
# Uso:  ./kubo-docs/scripts/check-pdf.sh
# ---------------------------------------------------------------------------
set -euo pipefail

DOCS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE_DIR="$(cd "${DOCS_DIR}/.." && pwd)"
PDF="${WORKSPACE_DIR}/Kubo-Documentacion.pdf"
HUELLA="${PDF}.sha256"

if [[ ! -f "${PDF}" ]]; then
  echo "FALLA: no existe ${PDF}; ejecuta make pdf" >&2
  exit 1
fi

if [[ ! -f "${HUELLA}" ]]; then
  echo "FALLA: no existe ${HUELLA}; ejecuta make pdf" >&2
  exit 1
fi

esperada="$(awk 'NR==1 {print $1}' "${HUELLA}")"
actual="$("${DOCS_DIR}/scripts/build-pdf.sh" --hash)"

if [[ "${esperada}" != "${actual}" ]]; then
  echo "FALLA: la documentacion cambio desde el ultimo PDF consolidado." >&2
  echo "       Ejecuta make pdf y commitea el PDF y su huella." >&2
  exit 1
fi

echo "PDF consolidado al dia (huella ${actual})"
