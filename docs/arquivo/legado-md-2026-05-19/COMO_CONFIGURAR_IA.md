# 🔧 Como Configurar as Chaves de IA

**Status Atual**: ⚠️ **IA NÃO CONFIGURADA**

As variáveis de ambiente `AI_PROVIDER` e `AI_API_KEY` não estão configuradas no arquivo `.env`.

---

## 📋 Opções de Provider

Você pode escolher entre 3 providers:

1. **Groq** (Recomendado - rápido e gratuito)
2. **OpenAI** (GPT-4o-mini)
3. **Gemini** (Google)

---

## 🚀 Configuração Rápida

### Opção 1: Groq (Recomendado)

1. Obtenha sua API key em: https://console.groq.com/
2. Adicione ao arquivo `/root/server/.env`:

```bash
AI_PROVIDER=groq
AI_API_KEY=sua-chave-aqui
AI_MODEL=llama-3.3-70b-versatile
```

### Opção 2: OpenAI

1. Obtenha sua API key em: https://platform.openai.com/api-keys
2. Adicione ao arquivo `/root/server/.env`:

```bash
AI_PROVIDER=openai
AI_API_KEY=sk-sua-chave-aqui
AI_MODEL=gpt-4o-mini
```

### Opção 3: Gemini

1. Obtenha sua API key em: https://makersuite.google.com/app/apikey
2. Adicione ao arquivo `/root/server/.env`:

```bash
AI_PROVIDER=gemini
AI_API_KEY=sua-chave-aqui
AI_MODEL=gemini-pro
```

---

## 📝 Passo a Passo

1. **Edite o arquivo .env**:
   ```bash
   sudo nano /root/server/.env
   ```

2. **Adicione as variáveis** (escolha um provider):
   ```bash
   AI_PROVIDER=groq
   AI_API_KEY=sua-chave-aqui
   AI_MODEL=llama-3.3-70b-versatile
   ```

3. **Salve o arquivo** (Ctrl+X, depois Y, depois Enter)

4. **Reinicie o servidor**:
   ```bash
   pm2 restart blackhouse-api
   ```

5. **Verifique os logs**:
   ```bash
   pm2 logs blackhouse-api --lines 20 | grep -i "ai\|provider"
   ```
   
   Deve aparecer: `✅ AI Provider configurado`

---

## ⚠️ Importante

### Fallback Automático

**Mesmo sem IA configurada, o sistema funciona!**

O sistema foi configurado com fallback automático:
- Se IA não estiver disponível → usa parser local
- Se IA falhar → tenta parser local automaticamente
- O usuário pode sempre importar PDFs

### Modelos Disponíveis

**Groq**:
- `llama-3.3-70b-versatile` (padrão, recomendado)

**OpenAI**:
- `gpt-4o-mini` (padrão)
- `gpt-4o`
- `gpt-4-turbo`

**Gemini**:
- `gemini-pro` (padrão)
- `gemini-pro-vision`

---

## 🧪 Como Testar

Após configurar:

1. **Verificar se está funcionando**:
   ```bash
   cd /root/server
   node -e "require('dotenv').config(); const ai = require('./services/ai'); console.log('IA Disponível:', ai.isAvailable());"
   ```

2. **Testar no frontend**:
   - Fazer upload de um PDF
   - Se IA estiver configurada: verá "PDF processado com sucesso!"
   - Se não estiver: verá aviso discreto mas funcionará normalmente

---

## 🔍 Verificar Status Atual

Para verificar o status sem expor as keys:

```bash
cd /root/server
node -e "require('dotenv').config(); console.log('Provider:', process.env.AI_PROVIDER || 'não configurado'); console.log('Key:', process.env.AI_API_KEY ? 'configurada' : 'não configurada');"
```

---

## 📊 Status Atual do Sistema

**IA**: ❌ Não configurada  
**Fallback**: ✅ Ativo  
**Importação**: ✅ Funcionando (usa parser local)

---

**Última atualização**: 15 de Janeiro de 2026
