# Configuração GitHub MCP no Cursor

Data: 2026-05-29  
Repo: `romuloroldao/Black-House`

## Objetivo

Ligar o [GitHub MCP Server](https://github.com/github/github-mcp-server) ao Cursor para o agente criar PRs, listar issues, consultar checks CI, etc., sem depender do `gh` CLI local (GLIBC/Docker).

## Pré-requisitos

- Cursor **v0.48+** (suporte HTTP streamable)
- PAT GitHub (classic) com scope **`repo`**
- Criar em: https://github.com/settings/tokens

## Setup automático (recomendado)

Na raiz do projecto:

```bash
bash scripts/setup-github-mcp.sh ghp_SEU_TOKEN
```

O script:

1. Grava o token em `~/.config/blackhouse/gh-token` (gitignored)
2. Escreve `~/.cursor/mcp.json` (global)
3. Escreve `.cursor/mcp.json` no projecto (gitignored)
4. Valida o token via `GET https://api.github.com/user`

Reinicia o Cursor após correr o script.

## Configuração manual

Template sem segredos: `scripts/mcp.github.example.json`

Endpoint remoto oficial (sem Docker):

```json
{
  "mcpServers": {
    "github": {
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer SEU_PAT"
      }
    }
  }
}
```

Ficheiros:

| Âmbito | Caminho |
|--------|---------|
| Global | `~/.cursor/mcp.json` |
| Projecto | `.cursor/mcp.json` (não commitar — está no `.gitignore`) |

## Verificação

1. Cursor → **Settings → Tools & Integrations → MCP Tools**
2. Servidor `github` com **ponto verde**
3. No chat: *"Lista os meus repositórios GitHub"*

## Integração com scripts existentes

O mesmo token serve para:

- `scripts/create-melhoria-aluno-pr.sh`
- `scripts/create-import-contextual-pr.sh`

```bash
export GH_TOKEN="$(tr -d '[:space:]' < ~/.config/blackhouse/gh-token)"
bash scripts/create-melhoria-aluno-pr.sh
```

## Troubleshooting

| Problema | Acção |
|----------|--------|
| MCP não aparece | Reiniciar Cursor por completo |
| Auth failure | Regenerar PAT com scope `repo` |
| Ferramentas vazias | Confirmar Cursor ≥ 0.48 |
| Token no git | Nunca commitar `.cursor/mcp.json` nem `gh-token` |

## Notas

- Pacote npm `@modelcontextprotocol/server-github` está **deprecated** (abril 2025)
- Alternativa local exige Docker: `ghcr.io/github/github-mcp-server` (não usada neste servidor)
