#!/usr/bin/env bash
# Configura GitHub MCP no Cursor + token partilhado (gh CLI / scripts de PR).
# Uso:
#   bash scripts/setup-github-mcp.sh ghp_xxx
#   bash scripts/setup-github-mcp.sh          # lê ~/.config/blackhouse/gh-token
#   GH_TOKEN=ghp_xxx bash scripts/setup-github-mcp.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN_FILE="${HOME}/.config/blackhouse/gh-token"
GLOBAL_MCP="${HOME}/.cursor/mcp.json"
PROJECT_MCP="${ROOT}/.cursor/mcp.json"
GITHUB_MCP_URL="https://api.githubcopilot.com/mcp/"

read_token() {
  if [[ -n "${1:-}" ]]; then
    printf '%s' "$1"
    return
  fi
  if [[ -n "${GH_TOKEN:-}" ]]; then
    printf '%s' "$GH_TOKEN"
    return
  fi
  if [[ -f "$TOKEN_FILE" ]]; then
    tr -d '[:space:]' < "$TOKEN_FILE"
    return
  fi
  return 1
}

usage() {
  cat <<'EOF'
Configuração GitHub MCP (Cursor) + token local Black House

1. Cria PAT em https://github.com/settings/tokens (classic, scope repo)
2. Corre um destes comandos:

   bash scripts/setup-github-mcp.sh ghp_SEU_TOKEN
   GH_TOKEN=ghp_xxx bash scripts/setup-github-mcp.sh

   Ou grava o token uma vez e corre sem argumentos:
   mkdir -p ~/.config/blackhouse
   printf '%s' 'ghp_xxx' > ~/.config/blackhouse/gh-token
   chmod 600 ~/.config/blackhouse/gh-token
   bash scripts/setup-github-mcp.sh

3. Reinicia o Cursor completamente
4. Settings → Tools & Integrations → MCP Tools → github (ponto verde)

Template: scripts/mcp.github.example.json
Doc: docs/arquivo/2026-05-29-configuracao-github-mcp-cursor.md
EOF
}

write_mcp_config() {
  local target="$1"
  local token="$2"
  mkdir -p "$(dirname "$target")"
  node <<'NODE' "$target" "$token" "$GITHUB_MCP_URL"
const fs = require('fs');
const path = require('path');

const [target, token, url] = process.argv.slice(2);
let config = { mcpServers: {} };

if (fs.existsSync(target)) {
  try {
    config = JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch (err) {
    console.error(`Aviso: ${target} inválido, será recriado (${err.message})`);
    config = { mcpServers: {} };
  }
}

config.mcpServers = config.mcpServers || {};
config.mcpServers.github = {
  url,
  headers: {
    Authorization: `Bearer ${token}`,
  },
};

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
NODE
  chmod 600 "$target"
}

main() {
  local token
  if ! token="$(read_token "${1:-}")"; then
    usage
    exit 1
  fi

  if [[ ! "$token" =~ ^(ghp_|github_pat_) ]]; then
    echo "Erro: token inválido (esperado ghp_... ou github_pat_...)"
    exit 1
  fi

  mkdir -p "$(dirname "$TOKEN_FILE")"
  printf '%s' "$token" > "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"

  echo "A validar token GitHub..."
  if ! curl -fsS -H "Authorization: Bearer ${token}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/user" >/dev/null; then
    echo "Erro: token rejeitado pela API GitHub (scope repo?)"
    exit 1
  fi
  echo "Token OK."

  write_mcp_config "$GLOBAL_MCP" "$token"
  echo "MCP global: $GLOBAL_MCP"

  write_mcp_config "$PROJECT_MCP" "$token"
  echo "MCP projecto: $PROJECT_MCP"

  cat <<EOF

Próximos passos:
  1. Reinicia o Cursor (obrigatório após alterar mcp.json)
  2. Verifica ponto verde em Settings → Tools & Integrations → MCP Tools
  3. Testa no chat: "Lista os meus repositórios GitHub"

Token também disponível para:
  export GH_TOKEN="\$(tr -d '[:space:]' < $TOKEN_FILE)"
  bash scripts/create-melhoria-aluno-pr.sh

EOF
}

main "${1:-}"
