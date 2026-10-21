# 📦 Guia de Instalação - Sistema de Importação de PDF

**Data**: 12 de Janeiro de 2026

---

## 🔧 Pré-requisitos

- Node.js 18+ instalado
- PostgreSQL configurado e rodando
- Banco de dados `blackhouse_db` criado
- Schema do banco de dados aplicado

---

## 📥 Instalação de Dependências

### 1. Instalar dependências do servidor

```bash
cd /var/www/blackhouse/server
npm install pdf-parse openai
```

**Ou se usar Anthropic**:
```bash
npm install pdf-parse @anthropic-ai/sdk
```

**Nota**: `pdf-parse` já deve estar instalado se você migrou do sistema anterior.

### 2. Verificar dependências existentes

As seguintes dependências já devem estar instaladas:
- `express`
- `pg`
- `multer`
- `jsonwebtoken`
- `dotenv`

---

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Adicione ao arquivo `/var/www/blackhouse/server/.env`:

```env
# IA - Escolha um provedor
AI_PROVIDER=openai  # ou 'anthropic', 'google'
AI_API_KEY=sua_chave_aqui
AI_MODEL=gpt-4o  # Para OpenAI: gpt-4o, gpt-4-vision-preview
                  # Para Anthropic: claude-3-5-sonnet-20241022

# Banco de dados (já deve estar configurado)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=blackhouse_db
DB_USER=app_user
DB_PASSWORD=sua_senha

# JWT (já deve estar configurado)
JWT_SECRET=seu_secret_jwt
```

### 2. Obter Chave de API

#### OpenAI
1. Acesse https://platform.openai.com/api-keys
2. Crie uma nova chave
3. Copie e cole em `AI_API_KEY`

#### Anthropic
1. Acesse https://console.anthropic.com/
2. Crie uma nova chave
3. Copie e cole em `AI_API_KEY`

---

## 🚀 Reiniciar Servidor

Após instalar dependências e configurar variáveis:

```bash
sudo systemctl restart blackhouse-api
```

Verificar se está rodando:
```bash
sudo systemctl status blackhouse-api
```

---

## ✅ Verificação

### 1. Verificar se endpoints estão disponíveis

```bash
curl -X POST http://localhost:3001/api/import/parse-pdf \
  -H "Authorization: Bearer SEU_TOKEN" \
  -F "pdf=@/caminho/para/teste.pdf"
```

### 2. Verificar logs

```bash
sudo journalctl -u blackhouse-api -f
```

### 3. Testar no Frontend

1. Acesse a interface de importação de alunos
2. Faça upload de um PDF de teste
3. Verifique se os dados são extraídos corretamente
4. Revise e confirme a importação

---

## 🐛 Troubleshooting

### Erro: "Cannot find module 'openai'"
**Solução**: Execute `npm install openai` no diretório do servidor

### Erro: "AI_API_KEY não configurada"
**Solução**: Adicione `AI_API_KEY` ao arquivo `.env` e reinicie o servidor

### Erro: "pdf-parse não encontrado"
**Solução**: Execute `npm install pdf-parse`

### Erro: "MulterError: File too large"
**Solução**: Ajuste o limite em `server/index.js`:
```javascript
const upload = multer({
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
    }
});
```

### Erro: "Resposta da IA não contém JSON válido"
**Solução**: 
- Verifique se o modelo suporta JSON mode
- Para OpenAI, use `gpt-4o` ou `gpt-4-turbo`
- Para Anthropic, use `claude-3-5-sonnet-20241022`

---

## 📊 Estrutura de Arquivos Criados

```
server/
├── controllers/
│   └── import.controller.js
├── services/
│   ├── pdf-parser.service.js
│   ├── ai.service.js
│   ├── normalizer.service.js
│   ├── validator.service.js
│   ├── student.service.js
│   ├── diet.service.js
│   ├── food-matching.service.js
│   └── transaction.manager.js
└── repositories/
    ├── alimento.repository.js
    ├── student.repository.js
    └── diet.repository.js
```

---

## 🔄 Migração do Sistema Antigo

O sistema antigo (`/functions/parse-student-pdf` com Base64) foi mantido para compatibilidade, mas está marcado como DEPRECATED.

**Recomendação**: Migre o frontend para usar os novos endpoints:
- `/api/import/parse-pdf` (multipart/form-data)
- `/api/import/confirm` (JSON)

---

## 📝 Notas Importantes

1. **PDFs são processados em memória**: Não são salvos em disco
2. **Transações garantem atomicidade**: Aluno e dieta são criados juntos ou nada é criado
3. **Alimentos são criados automaticamente**: Se não encontrados, são criados com valores estimados
4. **IA é obrigatória**: O sistema requer uma chave de API de IA configurada

---

**Última atualização**: 12 de Janeiro de 2026
