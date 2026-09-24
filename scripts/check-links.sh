#!/bin/bash
# ---------------------------------------------------------------------------
# Verifica que los enlaces relativos de la documentacion resuelvan (P-06).
#
# Uso:  ./kubo-docs/scripts/check-links.sh
# ---------------------------------------------------------------------------
set -uo pipefail

DOCS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "${DOCS_DIR}/.." && pwd)"
PASS=0
FAIL=0

echo
echo "Kubo · enlaces de la documentacion"
echo "================================================================"

while IFS= read -r archivo; do
  while IFS= read -r destino; do
    [[ -z "${destino}" ]] && continue
    # Solo enlaces relativos; se descartan anclas, URLs y correo.
    case "${destino}" in
      http*|mailto:*|"#"*) continue ;;
    esac
    limpio="${destino%%#*}"
    [[ -z "${limpio}" ]] && continue

    if [[ -e "$(dirname "${archivo}")/${limpio}" ]]; then
      PASS=$((PASS + 1))
    else
      FAIL=$((FAIL + 1))
      echo "  \033[31mROTO\033[0m  ${archivo#${ROOT}/} -> ${destino}"
    fi
  done < <(grep -oE '\]\([^)]+\)' "${archivo}" | sed -E 's/^\]\(//; s/\)$//')
done < <(find "${DOCS_DIR}" -name '*.md' -not -path '*/.git/*')

echo "================================================================"
printf 'Resultado: \033[32m%d enlaces resueltos\033[0m, \033[31m%d roto(s)\033[0m\n\n' "${PASS}" "${FAIL}"

if [[ "${FAIL}" -gt 0 ]]; then
  exit 1
fi
