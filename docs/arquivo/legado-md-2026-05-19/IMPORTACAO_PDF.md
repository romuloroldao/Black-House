# Pipeline de Importação de PDF - Documentação Técnica

## Visão Geral

O sistema de importação de fichas de alunos via PDF é um pipeline robusto que:
- ✅ Processa PDFs localmente (sem Supabase)
- ✅ Usa IA provider-agnostic (OpenAI, Gemini, etc.)
- ✅ Valida schema canônico rigorosamente (Zod)
- ✅ Nunca persiste dados inválidos
- ✅ Nunca derruba o servidor por erro de IA

## Arquitetura

```
Frontend (React)
    ↓ POST /api/import/parse-pdf (multipart/form-data)
Backend (Node.js/Express)
    ↓
1. PDF Parser (pdf-parse)
    ↓ texto extraído
2. AI Service (abstração de providers)
    ↓ JSON bruto
3. Schema Validation (Zod)
    ↓ dados validados
4. Normalizer
    ↓ dados normalizados
5. Business Validator
    ↓ dados validados
6. Retorno para Frontend (revisão)
    ↓
Frontend confirma
    ↓ POST /api/import/confirm
7. Transaction Manager
    ↓
8. Student Service + Diet Service
    ↓
9. Persistência transacional
```

## Endpoints

### POST /api/import/parse-pdf

**Autenticação**: JWT obrigatório

**Body**: `multipart/form-data`
- `pdf`: arquivo PDF (máximo 50MB)

**Resposta de Sucesso**:
```json
{
  "success": true,
  "data": {
    "aluno": { ... },
    "dieta": { ... },
    "suplementos": [ ... ],
    "farmacos": [ ... ],
    "orientacoes": "..."
  },
  "warnings": [] // opcional - avisos de validação de negócio
}
```

**Resposta de Erro**:
```json
{
  "success": false,
  "error": "Mensagem legível do erro",
  "errors": [] // opcional - erros de validação de schema
}
```

### POST /api/import/confirm

**Autenticação**: JWT obrigatório

**Body**: `application/json`
```json
{
  "data": {
    "aluno": { ... },
    "dieta": { ... },
    ...
  }
}
```

**Resposta de Sucesso**:
```json
{
  "success": true,
  "aluno": { ... },
  "dieta": { ... },
  "stats": {
    "alimentos_criados": 5,
    "refeicoes_criadas": 3
  }
}
```

## Schema Canônico

O schema é definido em `server/schemas/import-schema.js` usando Zod:

```typescript
{
  aluno: {
    nome: string (OBRIGATÓRIO, min 1, max 255)
    peso: number|null (opcional, 0-500)
    altura: number|null (opcional, 0-300)
    idade: number|null (opcional, inteiro, 0-150)
    objetivo: string|null (opcional, max 1000)
  },
  dieta: {
    nome: string (default: "Plano Alimentar Importado", max 255)
    objetivo: string|null (opcional, max 1000)
    refeicoes: [
      {
        nome: string (OBRIGATÓRIO, max 255)
        alimentos: [
          {
            nome: string (OBRIGATÓRIO, max 255)
            quantidade: string (OBRIGATÓRIO, max 100)
          }
        ] (min 1 alimento por refeição)
      }
    ] (min 0 refeições)
    macros: {
      proteina: number|null (opcional, >= 0)
      carboidrato: number|null (opcional, >= 0)
      gordura: number|null (opcional, >= 0)
      calorias: number|null (opcional, >= 0)
    } (opcional)
  } (opcional),
  suplementos: [
    {
      nome: string (OBRIGATÓRIO, max 255)
      dosagem: string (OBRIGATÓRIO, max 255)
      observacao: string|null (opcional, max 1000)
    }
  ] (default: [])
  farmacos: [
    {
      nome: string (OBRIGATÓRIO, max 255)
      dosagem: string (OBRIGATÓRIO, max 255)
      observacao: string|null (opcional, max 1000)
    }
  ] (default: [])
  orientacoes: string|null (opcional, max 5000)
}
```

## Validação em Camadas

### 1. Schema Validation (Zod)

**Quando**: Imediatamente após extração pela IA

**O que valida**:
- ✅ Tipos corretos
- ✅ Campos obrigatórios presentes
- ✅ Limites de tamanho
- ✅ Formato de arrays
- ✅ Campos extras são proibidos (`.strict()`)

**Se falhar**: Retorna 400 com lista de erros

### 2. Business Validation

**Quando**: Após normalização

**O que valida**:
- ✅ Regras de negócio específicas
- ✅ Consistência entre campos
- ✅ Valores dentro de faixas aceitáveis

**Se falhar**: Retorna dados com `warnings` (não bloqueia)

## Tratamento de Erros

### Erro de IA

**Cenário**: IA retorna erro (rate limit, API key inválida, etc.)

**Comportamento**:
- ✅ Retorna 400 (não 500)
- ✅ Mensagem clara
- ✅ Log detalhado com `requestId`
- ✅ **Nunca derruba o servidor**

### Erro de Schema

**Cenário**: IA retorna dados fora do schema

**Comportamento**:
- ✅ Retorna 400
- ✅ Lista de erros de validação
- ✅ **Dados nunca são persistidos**

### Erro de Persistência

**Cenário**: Erro ao criar aluno/dieta

**Comportamento**:
- ✅ Rollback automático (transação)
- ✅ Retorna 500
- ✅ Log detalhado

## Fluxo de Dados

### Fase 1: Parsing (parse-pdf)

```
PDF → Texto → IA → JSON bruto → Schema Validation → Normalização → Business Validation → Frontend
```

### Fase 2: Persistência (confirm)

```
Dados validados → Schema Validation (novamente) → Business Validation → Transação → Aluno + Dieta → Sucesso
```

## Segurança

- ✅ Autenticação JWT obrigatória
- ✅ Validação de tipo de arquivo (apenas PDF)
- ✅ Validação de tamanho (máximo 50MB)
- ✅ Validação de PDF válido
- ✅ Schema strict (campos extras são rejeitados)
- ✅ Transações garantem atomicidade

## Performance

- ✅ Processamento em memória (PDF não é salvo)
- ✅ Timeout configurado para chamadas de IA
- ✅ Logs estruturados para debug
- ✅ Validação rápida (Zod é performático)

## Logs

### Sucesso

```
[info] Processando PDF: ficha.pdf (2.5MB)
[info] Texto extraído: 5000 caracteres
[info] Dados extraídos pela IA (OpenAI) { model: 'gpt-4o-mini', dataKeys: ['aluno', 'dieta'] }
[info] Schema validation passou
[info] Dados normalizados e validados
```

### Erro

```
[error] Erro ao processar PDF com IA { error: '...', fileName: 'ficha.pdf', requestId: '...' }
[error] Dados da IA não passaram na validação do schema { errors: [...], rawData: '...' }
```

## Testes

### Teste Manual

1. Fazer upload de PDF válido
2. Verificar dados extraídos
3. Confirmar importação
4. Verificar aluno e dieta criados

### Teste de Erro

1. Fazer upload de PDF inválido → Deve retornar 400
2. Fazer upload sem IA configurada → Deve retornar 400 explicativo
3. IA retorna dados inválidos → Deve retornar 400 com erros de schema

## Troubleshooting

### "IA não está disponível"

**Causa**: `AI_PROVIDER` não configurado ou `AI_API_KEY` ausente

**Solução**: Configurar variáveis de ambiente (ver `AI_PROVIDER_GUIDE.md`)

### "Dados extraídos pela IA não estão no formato esperado"

**Causa**: IA retornou dados fora do schema canônico

**Solução**: 
- Verificar logs para ver dados brutos
- Ajustar prompt do sistema se necessário
- Verificar se PDF contém dados válidos

### "Erro ao processar PDF com IA: ..."

**Causa**: Erro na API do provider (rate limit, API key inválida, etc.)

**Solução**:
- Verificar `AI_API_KEY` válida
- Verificar rate limits do provider
- Verificar logs detalhados

---

**Última atualização**: 13 de Janeiro de 2026
