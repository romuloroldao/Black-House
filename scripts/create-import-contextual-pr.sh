#!/usr/bin/env bash
# Cria o PR da branch feat/import-contextual-p0 via GitHub CLI (requer GH_TOKEN).
set -euo pipefail

REPO="romuloroldao/Black-House"
BASE="melhoria-aluno"
HEAD="feat/import-contextual-p0"
GH_BIN="${GH_BIN:-/tmp/gh-bin/gh_2.63.2_linux_amd64/bin/gh}"

if [[ ! -x "$GH_BIN" ]]; then
  echo "A instalar gh portátil..."
  mkdir -p /tmp/gh-bin
  curl -sSL -o /tmp/gh-bin/gh.tgz \
    "https://github.com/cli/cli/releases/download/v2.63.2/gh_2.63.2_linux_amd64.tar.gz"
  tar -xzf /tmp/gh-bin/gh.tgz -C /tmp/gh-bin
  GH_BIN="/tmp/gh-bin/gh_2.63.2_linux_amd64/bin/gh"
fi

if [[ -n "${1:-}" ]]; then
  GH_TOKEN="$1"
  shift
fi

if [[ -z "${GH_TOKEN:-}" && -f "${HOME}/.config/blackhouse/gh-token" ]]; then
  GH_TOKEN="$(tr -d '[:space:]' < "${HOME}/.config/blackhouse/gh-token")"
fi

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "Erro: token GitHub em falta (classic PAT com scope repo)."
  echo ""
  echo "Um comando (escolhe um):"
  echo "  GH_TOKEN=ghp_xxx $0"
  echo "  $0 ghp_xxx"
  echo ""
  echo "Ou grava o token uma vez:"
  echo "  mkdir -p ~/.config/blackhouse"
  echo "  printf '%s' 'ghp_xxx' > ~/.config/blackhouse/gh-token"
  echo "  chmod 600 ~/.config/blackhouse/gh-token"
  echo "  $0"
  exit 1
fi

export GH_TOKEN

"$GH_BIN" pr create \
  --repo "$REPO" \
  --base "$BASE" \
  --head "$HEAD" \
  --title "feat(import): importação contextual P0 (perfil, destino, confirm-diet)" \
  --body-file - <<'EOF'
## Summary

- Modo **enrich**: importar dieta no perfil do aluno (`confirm-diet`)
- **Destino explícito** na lista + detecção de duplicados
- CTA **Vincular Usuários** → `?tab=students&import=1`

Spec: `docs/arquivo/2026-05-25-especificacao-importacao-contextual-p0.md`

## Test plan

- [ ] Perfil → Importar ficha → dieta vinculada
- [ ] Lista → aluno existente → sem duplicado
- [ ] Alerta de duplicado antes de criar novo aluno
- [ ] `npm run build`

EOF

echo ""
echo "PR criado com sucesso."
