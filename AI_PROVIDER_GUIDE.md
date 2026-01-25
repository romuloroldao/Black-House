# Guia de Configuração de AI Provider

## Visão Geral

O sistema de importação de PDF usa uma arquitetura **provider-agnostic** que permite trocar facilmente entre diferentes provedores de IA (OpenAI, Gemini, etc.) sem modificar o código principal.

## Arquitetura

```
server/services/
├── ai/
│   ├── index.js                    # Camada de abstração principal
│   └── providers/
│       ├── openai.provider.js      # Implementação OpenAI
│       └── gemini.provider.js      # Implementação Gemini
├── ai.service.js                   # Serviço que usa a abstração
└── ...
```

### Regras de Isolamento

- ✅ **Nenhum** `require('openai')` fora de `providers/openai.provider.js`
- ✅ **Nenhum** `require('@google/generative-ai')` fora de `providers/gemini.provider.js`
- ✅ Todos os imports de SDKs de IA são isolados nos providers

## Configuração

### Variáveis de Ambiente

```bash
# Provider de IA (obrigatório se quiser usar IA)
AI_PROVIDER=groq  # ou 'openai', 'gemini'

# API Key do provider (obrigatório se AI_PROVIDER estiver configurado)
AI_API_KEY=gsk_...  # Para Groq
# ou
AI_API_KEY=sk-proj-...  # Para OpenAI
# ou
AI_API_KEY=AIzaSy...  # Para Gemini

# Modelo a ser usado (opcional - usa default se não especificado)
AI_MODEL=llama-3.1-70b-versatile  # Para Groq (padrão)
# ou
AI_MODEL=gpt-4o-mini  # Para OpenAI
# ou
AI_MODEL=gemini-pro   # Para Gemini
```

### Comportamento

1. **Se `AI_PROVIDER` não estiver configurado**:
   - IA fica **desabilitada**
   - Servidor sobe normalmente
   - Importação de PDF retorna erro 400 explicativo

2. **Se `AI_PROVIDER` estiver configurado mas `AI_API_KEY` não**:
   - Servidor **não sobe** (erro na inicialização)
   - Mensagem de erro clara

3. **Se `AI_PROVIDER` estiver configurado mas SDK não instalado**:
   - Servidor **não sobe** (erro na inicialização)
   - Mensagem de erro com comando para instalar

## Providers Suportados

### Groq (Recomendado - Principal)

**SDK**: `groq-sdk`  
**Instalação**: `npm install groq-sdk`

**Configuração**:
```bash
AI_PROVIDER=groq
AI_API_KEY=gsk_...
AI_MODEL=llama-3.1-70b-versatile  # ou llama-3.1-8b-instant, mixtral-8x7b-32768
```

**Modelos recomendados**:
- `llama-3.1-70b-versatile` (padrão) - Melhor qualidade
- `llama-3.1-8b-instant` - Mais rápido
- `mixtral-8x7b-32768` - Alternativa

**Vantagens**:
- ✅ Muito rápido
- ✅ Boa qualidade
- ✅ Custo baixo
- ✅ JSON structured output

### OpenAI

**SDK**: `openai`  
**Instalação**: `npm install openai`

**Configuração**:
```bash
AI_PROVIDER=openai
AI_API_KEY=sk-proj-...
AI_MODEL=gpt-4o-mini  # ou gpt-4o, gpt-4-vision-preview
```

**Modelos recomendados**:
- `gpt-4o-mini` - Mais barato, rápido
- `gpt-4o` - Mais preciso, mais caro
- `gpt-4-vision-preview` - Se precisar processar imagens do PDF

### Google Gemini (Secundário)

**SDK**: `@google/generative-ai`  
**Instalação**: `npm install @google/generative-ai`

**Configuração**:
```bash
AI_PROVIDER=gemini
AI_API_KEY=AIzaSy...
AI_MODEL=gemini-pro
```

**Modelos recomendados**:
- `gemini-pro` (padrão)
- `gemini-pro-vision` (se precisar processar imagens)

## Fluxo de Importação

1. **Upload PDF** → `POST /api/import/parse-pdf`
2. **Extração de texto** → `pdf-parser.service.js`
3. **Envio para IA** → `ai.service.js` → `ai/index.js` → `providers/*.provider.js`
4. **Validação de schema** → `schemas/import-schema.js` (Zod)
5. **Normalização** → `normalizer.service.js`
6. **Validação de negócio** → `validator.service.js`
7. **Retorno para revisão** → Frontend

## Tratamento de Erros

### Erro de Configuração

**Cenário**: `AI_PROVIDER` configurado mas SDK não instalado

**Comportamento**:
- Servidor não sobe
- Erro explícito: `"SDK do provider X não está instalado. Execute: npm install ..."`

### Erro de API

**Cenário**: IA retorna erro (rate limit, API key inválida, etc.)

**Comportamento**:
- Retorna 400 (não 500)
- Mensagem clara do erro
- Log detalhado com `requestId`
- **Nunca derruba o servidor**

### Erro de Schema

**Cenário**: IA retorna dados fora do schema canônico

**Comportamento**:
- Retorna 400
- Lista de erros de validação
- **Dados nunca são persistidos**

## Adicionar Novo Provider

1. Criar arquivo `server/services/ai/providers/novo-provider.provider.js`:

```javascript
const logger = require('../../utils/logger');

class NovoProvider {
    constructor(apiKey, model) {
        this.apiKey = apiKey;
        this.model = model;
        this.client = null;
    }

    initialize() {
        try {
            const SDK = require('sdk-do-novo-provider');
            this.client = new SDK({ apiKey: this.apiKey });
            logger.info('Novo provider inicializado', { model: this.model });
            return true;
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                throw new Error(
                    'SDK do novo provider não está instalado. Execute: npm install sdk-do-novo-provider'
                );
            }
            throw error;
        }
    }

    async extractStructuredData(pdfText, systemPrompt, userPrompt) {
        // Implementar lógica de extração
        // ...
    }
}

module.exports = NovoProvider;
```

2. Adicionar case em `server/services/ai/index.js`:

```javascript
case 'novo-provider':
    const NovoProvider = require('./providers/novo-provider.provider');
    this.provider = new NovoProvider(this.config.apiKey, this.config.model);
    this.provider.initialize();
    this.providerName = 'novo-provider';
    this.isEnabled = true;
    return true;
```

3. Atualizar documentação

## Testes

### Testar sem IA

```bash
# Remover AI_PROVIDER do .env
# Servidor deve subir normalmente
# Importação deve retornar erro 400 explicativo
```

### Testar com OpenAI

```bash
AI_PROVIDER=openai
AI_API_KEY=sk-proj-...
AI_MODEL=gpt-4o-mini

# Servidor deve subir e logar: "✅ AI Provider configurado"
```

### Testar com SDK não instalado

```bash
# Remover openai do package.json
npm uninstall openai

# Servidor não deve subir
# Erro: "SDK do provider openai não está instalado"
```

## Logs

### Inicialização

```
✅ AI Provider configurado { provider: 'openai', model: 'gpt-4o-mini' }
```

ou

```
⚠️ AI Provider não configurado - importação de PDF desabilitada
```

### Durante Importação

```
[info] Dados extraídos pela IA (OpenAI) { model: 'gpt-4o-mini', dataKeys: ['aluno', 'dieta'] }
```

### Erros

```
[error] Erro ao extrair dados com OpenAI { error: '...', model: 'gpt-4o-mini', stack: '...' }
```

## Checklist de Produção

- [ ] `AI_PROVIDER` configurado no `.env`
- [ ] `AI_API_KEY` configurada e válida
- [ ] `AI_MODEL` configurado (ou usando default)
- [ ] SDK do provider instalado (`npm install openai` ou `npm install @google/generative-ai`)
- [ ] Servidor sobe sem erros
- [ ] Logs mostram "✅ AI Provider configurado"
- [ ] Teste de importação funciona
- [ ] Erros de IA retornam 400 (não 500)
- [ ] Schema validation funciona corretamente

---

**Última atualização**: 13 de Janeiro de 2026
