# 🏗️ Arquitetura de Importação de Fichas via PDF

**Data**: 12 de Janeiro de 2026  
**Status**: ✅ **IMPLEMENTADO**

---

## 📋 Visão Geral

Sistema completo de importação de fichas de alunos via PDF, executando 100% em VPS própria, sem dependências de Supabase ou Lovable.

### Características Principais

- ✅ **Upload via multipart/form-data** (sem Base64 no frontend)
- ✅ **Processamento de PDF em memória** (sem persistência em disco)
- ✅ **Extração via IA multimodal** (OpenAI, Anthropic, ou outro provedor)
- ✅ **Revisão manual no frontend** antes de persistir
- ✅ **Persistência transacional** (aluno + dieta em uma única transação)
- ✅ **Matching inteligente de alimentos** com criação automática
- ✅ **Arquitetura em camadas** (Controller → Services → Repositories)

---

## 🏛️ Arquitetura em Camadas

### 1. Controller Layer
**Arquivo**: `server/controllers/import.controller.js`

**Responsabilidades**:
- Recebe requisições HTTP
- Valida entrada (tipo de arquivo, tamanho)
- Orquestra o fluxo completo
- Retorna respostas HTTP

**Endpoints**:
- `POST /api/import/parse-pdf` - Processa PDF e extrai dados (fase 1)
- `POST /api/import/confirm` - Confirma importação e persiste (fase 2)

### 2. Service Layer

#### PDF Parser Service
**Arquivo**: `server/services/pdf-parser.service.js`

**Responsabilidades**:
- Extrai texto de PDFs usando `pdf-parse`
- Valida formato e tamanho do PDF
- Extrai metadados

#### AI Service
**Arquivo**: `server/services/ai.service.js`

**Responsabilidades**:
- Chama provedor de IA multimodal (OpenAI, Anthropic, etc.)
- Envia texto do PDF para extração estruturada
- Retorna JSON estruturado com dados do aluno e dieta

**Configuração**:
```env
AI_PROVIDER=openai  # ou 'anthropic', 'google'
AI_API_KEY=sua_chave_aqui
AI_MODEL=gpt-4o  # ou outro modelo compatível
```

#### Normalizer Service
**Arquivo**: `server/services/normalizer.service.js`

**Responsabilidades**:
- Padroniza JSON retornado pela IA
- Normaliza strings, números, arrays
- Garante formato consistente

#### Validator Service
**Arquivo**: `server/services/validator.service.js`

**Responsabilidades**:
- Valida dados do aluno (nome obrigatório, limites de valores)
- Valida dados da dieta (refeições, alimentos, macros)
- Retorna erros de validação

#### Student Service
**Arquivo**: `server/services/student.service.js`

**Responsabilidades**:
- Lógica de negócio para criação de alunos
- Validações específicas de aluno
- Geração de email temporário

#### Diet Service
**Arquivo**: `server/services/diet.service.js`

**Responsabilidades**:
- Criação completa de dieta (dieta + refeições + itens)
- Processamento de refeições e alimentos
- Mapeamento de nomes de refeições
- Parse de quantidades

#### Food Matching Service
**Arquivo**: `server/services/food-matching.service.js`

**Responsabilidades**:
- Algoritmo de matching de alimentos com prioridades:
  1. Mapeamento específico
  2. Match exato normalizado
  3. Match por similaridade
  4. Criação automática
- Inferência de tipo e valores nutricionais
- Criação automática de alimentos inexistentes

#### Transaction Manager
**Arquivo**: `server/services/transaction.manager.js`

**Responsabilidades**:
- Gerencia transações do banco de dados
- Garante atomicidade (rollback em caso de erro)
- Cria repositórios com client de transação

### 3. Repository Layer

#### Alimento Repository
**Arquivo**: `server/repositories/alimento.repository.js`

**Métodos**:
- `findAlimentoByNomeExato(nome)`
- `findAllAlimentos()`
- `findAlimentoSimilar(nome)`
- `createAlimento(alimentoData)`

#### Student Repository
**Arquivo**: `server/repositories/student.repository.js`

**Métodos**:
- `createAluno(alunoData)`
- `findAlunoById(alunoId, coachId)`

#### Diet Repository
**Arquivo**: `server/repositories/diet.repository.js`

**Métodos**:
- `createDieta(dietaData)`
- `createItensDieta(itens)`
- `createFarmacos(farmacos)`
- `createSuplementos(suplementos)`

---

## 🔄 Fluxo de Dados

### Fase 1: Parsing do PDF

```
Frontend (multipart/form-data)
    ↓
Controller.parsePDF()
    ↓
PDF Parser Service (extrai texto)
    ↓
AI Service (extrai dados estruturados)
    ↓
Normalizer Service (padroniza JSON)
    ↓
Validator Service (valida dados)
    ↓
Frontend (exibe para revisão)
```

### Fase 2: Persistência

```
Frontend (envia dados revisados)
    ↓
Controller.confirmImport()
    ↓
Transaction Manager (inicia transação)
    ↓
Student Service (cria aluno)
    ↓
Diet Service (cria dieta)
    ↓
Food Matching Service (encontra/cria alimentos)
    ↓
Repositories (persistem no banco)
    ↓
Transaction Manager (commit ou rollback)
    ↓
Frontend (exibe resultado)
```

---

## 📦 Dependências

### Backend

```json
{
  "express": "^4.18.2",
  "pg": "^8.11.3",
  "multer": "^1.4.5-lts.1",
  "pdf-parse": "^1.1.1",
  "openai": "^4.0.0"  // ou @anthropic-ai/sdk
}
```

### Variáveis de Ambiente

```env
# Banco de dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=blackhouse_db
DB_USER=app_user
DB_PASSWORD=sua_senha

# IA
AI_PROVIDER=openai
AI_API_KEY=sua_chave_openai
AI_MODEL=gpt-4o

# JWT
JWT_SECRET=seu_secret_jwt
```

---

## 🚀 Endpoints da API

### POST /api/import/parse-pdf

**Descrição**: Processa PDF e extrai dados estruturados

**Autenticação**: Bearer Token

**Content-Type**: `multipart/form-data`

**Body**:
```
pdf: <arquivo PDF>
```

**Resposta de Sucesso**:
```json
{
  "success": true,
  "data": {
    "aluno": {
      "nome": "João Silva",
      "peso": 75,
      "altura": 175,
      "idade": 30,
      "objetivo": "Ganho de massa"
    },
    "dieta": {
      "nome": "Plano Alimentar Importado",
      "objetivo": "Ganho de massa",
      "refeicoes": [
        {
          "nome": "Café da Manhã",
          "alimentos": [
            {
              "nome": "ovo inteiro",
              "quantidade": "2 unidades"
            }
          ]
        }
      ],
      "macros": {
        "proteina": 150,
        "carboidrato": 200,
        "gordura": 60,
        "calorias": 2000
      }
    },
    "suplementos": [
      {
        "nome": "Whey Protein",
        "dosagem": "30g",
        "observacao": "Pós-treino"
      }
    ],
    "farmacos": [],
    "orientacoes": "Beber bastante água"
  }
}
```

**Resposta de Erro**:
```json
{
  "success": false,
  "error": "Mensagem de erro"
}
```

### POST /api/import/confirm

**Descrição**: Confirma importação e persiste aluno + dieta

**Autenticação**: Bearer Token

**Content-Type**: `application/json`

**Body**:
```json
{
  "data": {
    "aluno": { ... },
    "dieta": { ... },
    "suplementos": [ ... ],
    "farmacos": [ ... ],
    "orientacoes": "..."
  }
}
```

**Resposta de Sucesso**:
```json
{
  "success": true,
  "aluno": {
    "id": "uuid",
    "nome": "João Silva",
    ...
  },
  "dieta": {
    "id": "uuid",
    "nome": "Plano Alimentar Importado",
    ...
  },
  "stats": {
    "refeicoes_criadas": 5,
    "itens_criados": 25,
    "alimentos_criados": ["novo alimento 1", "novo alimento 2"],
    "farmacos_criados": 2,
    "suplementos_criados": 1
  }
}
```

---

## 🔍 Algoritmo de Matching de Alimentos

### Prioridades

1. **Mapeamento Específico**: Mapeamentos pré-definidos (ex: "ovo" → "ovo inteiro")
2. **Match Exato**: Nome normalizado idêntico
3. **Match por Similaridade**: Nome contém ou é contido (diferença ≤ 15 caracteres)
4. **Criação Automática**: Cria alimento com valores nutricionais estimados

### Valores Nutricionais Estimados

O sistema infere valores nutricionais baseado no tipo de alimento:
- **Proteínas**: 165 kcal, 31g ptn, 0g cho, 3.6g lip (por 100g)
- **Carboidratos**: 130 kcal, 2.7g ptn, 28g cho, 0.3g lip (por 100g)
- **Lipídeos**: 884 kcal, 0g ptn, 0g cho, 100g lip (por 100g)
- **Frutas**: 52 kcal, 0.3g ptn, 14g cho, 0.2g lip (por 100g)
- **Vegetais**: 25 kcal, 2g ptn, 4g cho, 0.4g lip (por 100g)
- **Laticínios**: 42 kcal, 3.4g ptn, 5g cho, 1g lip (por 100g)

---

## ✅ Garantias de Transação

- **Atomicidade**: Aluno e dieta são criados na mesma transação
- **Rollback Automático**: Se qualquer operação falhar, tudo é revertido
- **Consistência**: Dados sempre consistentes no banco
- **Isolamento**: Transações não interferem umas nas outras

---

## 🎯 Regras de Negócio

### Aluno
- Nome é obrigatório
- Peso, altura e idade são opcionais
- Email temporário gerado automaticamente

### Dieta
- Deve estar vinculada a um aluno
- Refeições devem ter pelo menos um alimento
- Alimentos são encontrados ou criados automaticamente

### Alimentos
- Quantidade de referência sempre 100g
- Valores nutricionais estimados se criado automaticamente
- Info adicional indica criação automática

---

## 📝 Notas de Implementação

### Compatibilidade com Código Legado

O endpoint antigo `/functions/parse-student-pdf` foi mantido para compatibilidade, mas está marcado como DEPRECATED. O novo sistema usa:
- `/api/import/parse-pdf` (multipart/form-data)
- `/api/import/confirm` (JSON)

### Frontend

O componente `StudentImporter.tsx` foi atualizado para:
- Usar `multipart/form-data` ao invés de Base64
- Chamar novo endpoint de confirmação
- Remover lógica de matching e criação de alimentos (agora no backend)

---

## 🔧 Troubleshooting

### Erro: "AI_API_KEY não configurada"
**Solução**: Adicione `AI_API_KEY` ao `.env` do servidor

### Erro: "Arquivo muito grande"
**Solução**: Limite é 50MB. Reduza o tamanho do PDF ou ajuste `multer.limits.fileSize`

### Erro: "Não foi possível extrair texto do PDF"
**Solução**: PDF pode estar escaneado. Considere adicionar OCR (Tesseract.js) no futuro

### Erro: "Resposta da IA não contém JSON válido"
**Solução**: Verifique se o modelo de IA suporta `response_format: { type: 'json_object' }`

---

## 🚀 Melhorias Futuras

1. **OCR para PDFs Escaneados**: Adicionar Tesseract.js
2. **IA Local**: Suporte para Ollama ou LM Studio
3. **Templates de PDF**: Suporte a múltiplos formatos
4. **Cache de Alimentos**: Cachear alimentos mais usados
5. **Validação Avançada**: Validação de macros e valores nutricionais

---

**Última atualização**: 12 de Janeiro de 2026
