#!/usr/bin/env bash
# PR melhoria-aluno → lancamento (requer GH_TOKEN ou ~/.config/blackhouse/gh-token)
set -euo pipefail

REPO="romuloroldao/Black-House"
BASE="lancamento"
HEAD="melhoria-aluno"
GH_BIN="${GH_BIN:-/tmp/gh-bin/gh_2.40.1_linux_amd64/bin/gh}"

if [[ ! -x "$GH_BIN" ]]; then
  echo "A instalar gh portátil (2.40.1)..."
  mkdir -p /tmp/gh-bin
  curl -sSL -o /tmp/gh-bin/gh.tgz \
    "https://github.com/cli/cli/releases/download/v2.40.1/gh_2.40.1_linux_amd64.tar.gz"
  tar -xzf /tmp/gh-bin/gh.tgz -C /tmp/gh-bin
  GH_BIN="/tmp/gh-bin/gh_2.40.1_linux_amd64/bin/gh"
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
  echo ""
  echo "Alternativa manual:"
  echo "  https://github.com/romuloroldao/Black-House/compare/lancamento...melhoria-aluno?expand=1"
  exit 1
fi

export GH_TOKEN

"$GH_BIN" pr create \
  --repo "$REPO" \
  --base "$BASE" \
  --head "$HEAD" \
  --title "feat: realtime portal, treinos API, check-in mobile e migrações" \
  --body-file - <<'EOF'
## Summary

- **Realtime (Fase 1–2):** Socket.io no portal aluno (check-in respondido, dieta) e no painel coach (novo check-in semanal); auth WebSocket alinhada com HTTP.
- **API:** rotas semânticas `GET/POST/PATCH/DELETE /api/treinos`; validação de check-in; upload de fotos com normalização HEIC; conteúdos educativos e refeição livre.
- **Portal aluno:** check-in com peso/fotos, safe area mobile, polish a11y (skip link, labels), rotação de dietas.
- **Ops:** `db:migrate` com transacção por ficheiro + `schema_patches`; nginx produção; docs roadmap/QA E2E.

## Test plan

- [ ] Login aluno → enviar check-in (2 fotos + peso) → toast sucesso
- [ ] Login coach → inbox check-in actualiza sem F5 quando aluno envia
- [ ] `GET /api/treinos` com token coach → 200
- [ ] `npm run db:migrate` → 9 patches ignorados, exit 0
- [ ] Reteste mobile Ederlon / Christian Calhares (BH-QA-002)

EOF

echo ""
"$GH_BIN" pr view --repo "$REPO" --head "$HEAD" --json url --jq .url
