# 📋 Schema Canônico - Importação de Aluno via PDF

> **Versão**: 1.0.0  
> **Última atualização**: Janeiro 2026  
> **Responsável**: Tech Lead  

---

## 📌 Visão Geral

Este documento define o **schema canônico obrigatório** para a importação de fichas de alunos via PDF no sistema. O fluxo utiliza OCR via IA (Google Gemini 2.5 Flash) para extrair dados estruturados do PDF e persistir no banco de dados.

---

## 🔄 Fluxo de Dados

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────────────┐     ┌──────────────┐
│   Frontend  │────▶│   Edge Function      │────▶│   Lovable AI        │────▶│   Supabase   │
│ (PDF Base64)│     │ parse-student-pdf    │     │ Gemini 2.5 Flash    │     │  PostgreSQL  │
└─────────────┘     └──────────────────────┘     └─────────────────────┘     └──────────────┘
      │                      │                            │                         │
      │ pdfBase64            │ Prompt + PDF               │ JSON Estruturado        │ INSERT
      │ fileName             │                            │                         │
      ▼                      ▼                            ▼                         ▼
   FileReader           fetch() POST               ChatCompletions API     alunos, dietas,
   readAsDataURL                                                           itens_dieta,
                                                                           dieta_farmacos
```

---

## 📥 INPUT: Request da Edge Function

### Endpoint
```
POST /functions/v1/parse-student-pdf
```

### Headers
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <SUPABASE_ANON_KEY>"
}
```

### Body (Request)

| Campo       | Tipo     | Obrigatório | Descrição                                     |
|-------------|----------|-------------|-----------------------------------------------|
| `pdfBase64` | `string` | ✅ Sim      | Conteúdo do PDF codificado em Base64          |
| `fileName`  | `string` | ❌ Não      | Nome original do arquivo (para logs)          |

#### Exemplo de Request
```json
{
  "pdfBase64": "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZS...",
  "fileName": "ficha_joao_silva.pdf"
}
```

---

## 📤 OUTPUT: Schema Canônico JSON

### Estrutura Completa

```typescript
interface ParsedStudentData {
  aluno: AlunoData;
  dieta?: DietaData;
  suplementos?: SuplementoData[];
  farmacos?: FarmacoData[];
  orientacoes?: string;
}
```

---

### 1️⃣ Objeto `aluno` (OBRIGATÓRIO)

Dados pessoais do aluno extraídos do PDF.

```typescript
interface AlunoData {
  nome: string;        // OBRIGATÓRIO - Nome completo do aluno
  peso?: number;       // Peso em kg (ex: 75.5)
  altura?: number;     // Altura em metros (ex: 1.75)
  idade?: number;      // Idade em anos
  objetivo?: string;   // Objetivo do plano (ex: "Hipertrofia", "Emagrecimento")
}
```

#### Schema JSON
```json
{
  "aluno": {
    "nome": "João da Silva",
    "peso": 75.5,
    "altura": 1.75,
    "idade": 28,
    "objetivo": "Hipertrofia muscular"
  }
}
```

#### Regras de Validação
| Campo      | Tipo     | Validação                                      | Fallback               |
|------------|----------|------------------------------------------------|------------------------|
| `nome`     | string   | Não vazio, mínimo 2 caracteres                 | `"Aluno Importado"`    |
| `peso`     | number   | > 0, típico entre 40-200 kg                    | `null`                 |
| `altura`   | number   | > 0, típico entre 1.40-2.20 metros             | `null`                 |
| `idade`    | number   | Inteiro > 0, típico entre 10-100               | `null`                 |
| `objetivo` | string   | Texto livre                                    | `null`                 |

---

### 2️⃣ Objeto `dieta` (OPCIONAL)

Plano alimentar completo com refeições e macros.

```typescript
interface DietaData {
  nome: string;           // Nome do plano alimentar
  objetivo?: string;      // Objetivo específico da dieta
  refeicoes: RefeicaoData[];  // Array de refeições (4-8 típico)
  macros?: MacrosData;    // Totais de macronutrientes
}
```

#### Schema JSON
```json
{
  "dieta": {
    "nome": "Plano Hipertrofia - Fase 1",
    "objetivo": "Ganho de massa magra",
    "refeicoes": [...],
    "macros": {
      "proteina": 180,
      "carboidrato": 300,
      "gordura": 70,
      "calorias": 2550
    }
  }
}
```

---

### 3️⃣ Objeto `refeicao` (Dentro de `dieta.refeicoes[]`)

Cada refeição do plano alimentar.

```typescript
interface RefeicaoData {
  nome: string;              // Nome da refeição
  alimentos: AlimentoData[]; // Array de alimentos
}
```

#### Schema JSON
```json
{
  "nome": "Refeição 1",
  "alimentos": [
    { "nome": "whey protein", "quantidade": "30g" },
    { "nome": "aveia", "quantidade": "50g" },
    { "nome": "banana", "quantidade": "1 unidade" }
  ]
}
```

#### Nomenclatura Padrão de Refeições

A IA extrai nomes variados, que são **normalizados** no frontend para:

| Entrada Original               | Saída Normalizada |
|--------------------------------|-------------------|
| `Café da Manhã`, `cafe da manha` | `Refeição 1`     |
| `Lanche da Manhã`               | `Refeição 2`     |
| `Almoço`, `almoco`              | `Refeição 3`     |
| `Lanche da Tarde`, `lanche`     | `Refeição 4`     |
| `Jantar`                        | `Refeição 5`     |
| `Ceia`                          | `Refeição 6`     |
| `Pré-Treino`, `pre treino`      | `Refeição 7`     |
| `Pós-Treino`                    | `Refeição 8`     |
| `Refeição N` (já numerado)      | `Refeição N`     |

---

### 4️⃣ Objeto `alimento` (Dentro de `refeicao.alimentos[]`)

Cada item alimentar dentro de uma refeição.

```typescript
interface AlimentoData {
  nome: string;       // Nome SIMPLES do alimento
  quantidade: string; // Quantidade COM UNIDADE
}
```

#### Schema JSON
```json
{
  "nome": "peito de frango",
  "quantidade": "150g"
}
```

#### Regras de Nomenclatura de Alimentos

##### ✅ CORRETO (Nomes Simples e Específicos)
```json
[
  { "nome": "frango", "quantidade": "150g" },
  { "nome": "arroz branco", "quantidade": "200g" },
  { "nome": "ovo", "quantidade": "2 unidades" },
  { "nome": "banana", "quantidade": "1 unidade" },
  { "nome": "batata doce", "quantidade": "150g" },
  { "nome": "whey protein", "quantidade": "30g" },
  { "nome": "azeite de oliva", "quantidade": "10ml" }
]
```

##### ❌ ERRADO (Grupos Genéricos)
```json
[
  { "nome": "Carnes e Proteínas", "quantidade": "150g" },
  { "nome": "Personalizado Prot", "quantidade": "100g" },
  { "nome": "Vegetais A", "quantidade": "livre" },
  { "nome": "Carboidratos Complexos", "quantidade": "200g" }
]
```

#### Formato de Quantidade

| Formato Válido    | Descrição                     |
|-------------------|-------------------------------|
| `100g`            | Gramas                        |
| `200ml`           | Mililitros                    |
| `2 unidades`      | Unidades inteiras             |
| `1 xícara`        | Medida caseira                |
| `3 colheres`      | Colheres (sopa/chá)           |
| `1 fatia`         | Fatia/porção                  |
| `à vontade`       | Livre consumo (vegetais)      |

---

### 5️⃣ Objeto `macros` (Dentro de `dieta.macros`)

Totais de macronutrientes do plano.

```typescript
interface MacrosData {
  proteina?: number;     // Gramas de proteína
  carboidrato?: number;  // Gramas de carboidrato
  gordura?: number;      // Gramas de lipídeos
  calorias?: number;     // Total kcal
}
```

#### Schema JSON
```json
{
  "macros": {
    "proteina": 180,
    "carboidrato": 300,
    "gordura": 70,
    "calorias": 2550
  }
}
```

---

### 6️⃣ Array `suplementos[]` (OPCIONAL)

Lista de suplementos prescritos.

```typescript
interface SuplementoData {
  nome: string;         // Nome do suplemento
  dosagem: string;      // Dosagem com unidade
  observacao?: string;  // Observações de uso
}
```

#### Schema JSON
```json
{
  "suplementos": [
    {
      "nome": "creatina",
      "dosagem": "5g",
      "observacao": "diariamente, qualquer horário"
    },
    {
      "nome": "whey protein",
      "dosagem": "30g",
      "observacao": "pós-treino"
    },
    {
      "nome": "ômega 3",
      "dosagem": "2 cápsulas",
      "observacao": "com refeições principais"
    },
    {
      "nome": "vitamina D",
      "dosagem": "2000 UI",
      "observacao": "pela manhã"
    }
  ]
}
```

#### Exemplos de Suplementos Comuns
- Creatina, Whey Protein, Caseína, Albumina
- BCAA, Glutamina, Beta-Alanina
- Vitaminas (A, B, C, D, E, K)
- Minerais (Zinco, Magnésio, Ferro)
- Ômega 3, Óleo de Peixe
- Colágeno, Fitoterápicos
- Cafeína, Pré-treino

---

### 7️⃣ Array `farmacos[]` (OPCIONAL)

Lista de fármacos/medicamentos prescritos.

```typescript
interface FarmacoData {
  nome: string;         // Nome do fármaco
  dosagem: string;      // Dosagem com unidade
  observacao?: string;  // Frequência/observações
}
```

#### Schema JSON
```json
{
  "farmacos": [
    {
      "nome": "testosterona cipionato",
      "dosagem": "200mg",
      "observacao": "1x por semana, intramuscular"
    },
    {
      "nome": "GH",
      "dosagem": "4 UI",
      "observacao": "diariamente, em jejum"
    },
    {
      "nome": "anastrozol",
      "dosagem": "0.5mg",
      "observacao": "a cada 3 dias"
    }
  ]
}
```

#### Exemplos de Fármacos Comuns
- Hormônios: Testosterona, GH, Insulina
- Anti-estrogênicos: Anastrozol, Tamoxifeno
- Anabolizantes: Oxandrolona, Stanozolol, Boldenona
- Medicamentos: Glifage/Metformina, T3/T4
- Outros: Silimarina, HCG

> ⚠️ **IMPORTANTE**: Fármacos são diferentes de suplementos. Suplementos são produtos de venda livre, fármacos requerem prescrição.

---

### 8️⃣ Campo `orientacoes` (OPCIONAL)

Texto livre com orientações gerais do plano.

```typescript
interface ParsedStudentData {
  orientacoes?: string;  // Texto livre
}
```

#### Schema JSON
```json
{
  "orientacoes": "Beber no mínimo 3 litros de água por dia. Evitar alimentos processados. Manter jejum de 12h durante a noite. Fazer as refeições a cada 3 horas."
}
```

---

## 📊 Schema Completo - Exemplo Final

```json
{
  "aluno": {
    "nome": "João da Silva",
    "peso": 75.5,
    "altura": 1.75,
    "idade": 28,
    "objetivo": "Hipertrofia muscular"
  },
  "dieta": {
    "nome": "Plano Hipertrofia - Fase 1",
    "objetivo": "Ganho de massa magra com mínimo de gordura",
    "refeicoes": [
      {
        "nome": "Refeição 1",
        "alimentos": [
          { "nome": "whey protein", "quantidade": "30g" },
          { "nome": "aveia", "quantidade": "50g" },
          { "nome": "banana", "quantidade": "1 unidade" },
          { "nome": "pasta de amendoim", "quantidade": "20g" }
        ]
      },
      {
        "nome": "Refeição 2",
        "alimentos": [
          { "nome": "peito de frango", "quantidade": "150g" },
          { "nome": "arroz branco", "quantidade": "200g" },
          { "nome": "feijão", "quantidade": "100g" },
          { "nome": "salada verde", "quantidade": "à vontade" },
          { "nome": "azeite de oliva", "quantidade": "10ml" }
        ]
      },
      {
        "nome": "Refeição 3",
        "alimentos": [
          { "nome": "batata doce", "quantidade": "200g" },
          { "nome": "ovo", "quantidade": "4 unidades" },
          { "nome": "queijo branco", "quantidade": "50g" }
        ]
      },
      {
        "nome": "Refeição 4",
        "alimentos": [
          { "nome": "whey protein", "quantidade": "40g" },
          { "nome": "maltodextrina", "quantidade": "50g" }
        ]
      },
      {
        "nome": "Refeição 5",
        "alimentos": [
          { "nome": "tilápia", "quantidade": "200g" },
          { "nome": "arroz branco", "quantidade": "150g" },
          { "nome": "brócolis", "quantidade": "100g" },
          { "nome": "azeite de oliva", "quantidade": "10ml" }
        ]
      },
      {
        "nome": "Refeição 6",
        "alimentos": [
          { "nome": "caseína", "quantidade": "30g" },
          { "nome": "pasta de amendoim", "quantidade": "30g" }
        ]
      }
    ],
    "macros": {
      "proteina": 200,
      "carboidrato": 350,
      "gordura": 80,
      "calorias": 2920
    }
  },
  "suplementos": [
    { "nome": "creatina", "dosagem": "5g", "observacao": "diariamente" },
    { "nome": "vitamina D", "dosagem": "2000 UI", "observacao": "pela manhã" },
    { "nome": "ômega 3", "dosagem": "3g", "observacao": "com refeições" }
  ],
  "farmacos": [
    { "nome": "testosterona", "dosagem": "150mg", "observacao": "1x semana" }
  ],
  "orientacoes": "Manter hidratação de 4L/dia. Dormir 8h. Evitar álcool e ultraprocessados."
}
```

---

## 🗄️ Mapeamento para Banco de Dados

### Tabelas Afetadas

```
ParsedStudentData
       │
       ├──► aluno ──────────────► INSERT alunos
       │
       ├──► dieta ──────────────► INSERT dietas
       │        │
       │        └──► refeicoes ──► INSERT itens_dieta (por alimento)
       │                 │
       │                 └──► alimentos ──► SELECT/INSERT alimentos
       │
       └──► farmacos ───────────► INSERT dieta_farmacos
```

### Transformações

#### 1. `aluno` → Tabela `alunos`

| Schema JSON        | Coluna DB       | Transformação                              |
|--------------------|-----------------|--------------------------------------------|
| `aluno.nome`       | `nome`          | `.trim()`                                  |
| `aluno.peso`       | `peso`          | `number` ou `null`                         |
| `aluno.objetivo`   | `objetivo`      | `.trim()` ou `null`                        |
| (automático)       | `coach_id`      | `auth.uid()`                               |
| (automático)       | `email`         | `nome.toLowerCase().replace(/\s+/g, '.') + '@importado.temp'` |

#### 2. `dieta` → Tabela `dietas`

| Schema JSON        | Coluna DB       | Transformação                              |
|--------------------|-----------------|--------------------------------------------|
| `dieta.nome`       | `nome`          | `.trim()` ou `"Plano Alimentar Importado"` |
| `dieta.objetivo`   | `objetivo`      | `.trim()` ou `null`                        |
| (automático)       | `aluno_id`      | ID do aluno recém-criado                   |

#### 3. `refeicao.alimentos[]` → Tabela `itens_dieta`

| Schema JSON                  | Coluna DB       | Transformação                              |
|------------------------------|-----------------|--------------------------------------------|
| `refeicao.nome`              | `refeicao`      | `mapRefeicaoName()` → "Refeição N"         |
| `alimento.nome`              | `alimento_id`   | `findMatchingAlimento()` ou criar novo     |
| `alimento.quantidade`        | `quantidade`    | `parseFloat(match(/[\d.,]+/))` → `number`  |
| (automático)                 | `dieta_id`      | ID da dieta recém-criada                   |

#### 4. `farmacos[]` → Tabela `dieta_farmacos`

| Schema JSON           | Coluna DB       | Transformação                              |
|-----------------------|-----------------|--------------------------------------------|
| `farmaco.nome`        | `nome`          | `.trim()`                                  |
| `farmaco.dosagem`     | `dosagem`       | `.trim()`                                  |
| `farmaco.observacao`  | `observacao`    | `.trim()` ou `null`                        |
| (automático)          | `dieta_id`      | ID da dieta recém-criada                   |

---

## 🔍 Algoritmo de Match de Alimentos

### Ordem de Prioridade

```
1. MAPEAMENTO ESPECÍFICO ─────► Dicionário hardcoded (ex: "ovo" → "Ovo inteiro")
        │
        ▼ (não encontrou)
2. MATCH EXATO ───────────────► alimentosMap.get(nomeNormalizado)
        │
        ▼ (não encontrou)
3. MATCH POR PROXIMIDADE ─────► Busca alimento com menor diferença de caracteres
        │
        ▼ (não encontrou)
4. CRIAÇÃO AUTOMÁTICA ────────► INSERT alimentos com valores estimados
```

### Mapeamentos Específicos (Hardcoded)

```typescript
const mapeamentosEspecificos: Record<string, string> = {
  // Ovos
  'ovo': 'ovo inteiro',
  'ovos': 'ovo inteiro',
  'ovo cozido': 'ovo inteiro',
  
  // Pães
  'pao de forma': 'pao de forma',
  'pao frances': 'pao frances',
  
  // Carnes
  'frango': 'peito de frango',
  'carne': 'carne bovina patinho sem gordura grelhado',
  'carne vermelha': 'carne bovina patinho sem gordura grelhado',
  
  // Grãos
  'arroz': 'arroz branco',
  'feijao': 'feijao carioca cozido',
  
  // Frutas
  'banana': 'banana prata',
  
  // ... outros mapeamentos
};
```

### Função de Normalização

```typescript
const normalizeText = (text: string): string => {
  return text.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')                     // Remove especiais
    .replace(/\s+/g, ' ');                            // Normaliza espaços
};
```

---

## 🆕 Criação Automática de Alimentos

Quando um alimento não é encontrado no banco, é criado automaticamente com valores estimados.

### Inferência de Tipo

| Padrão Regex                                     | Tipo ID                                |
|--------------------------------------------------|----------------------------------------|
| `/frango\|carne\|peixe\|ovo\|atum\|whey.../`     | Proteínas (`33acba74-...`)             |
| `/arroz\|batata\|pao\|macarrao\|aveia.../`       | Carboidratos (`dea776a3-...`)          |
| `/azeite\|oleo\|manteiga\|castanha.../`          | Lipídeos (`e5863a2d-...`)              |
| `/banana\|maca\|laranja\|morango.../`            | Frutas (`c0a07056-...`)                |
| `/alface\|tomate\|brocolis\|cenoura.../`         | Vegetais (`92b02101-...`)              |
| `/leite\|queijo\|iogurte.../`                    | Laticínios (`b46fa5f1-...`)            |
| (default)                                        | Carboidratos                           |

### Valores Nutricionais Estimados (por 100g)

| Tipo         | kcal | PTN  | CHO  | LIP  |
|--------------|------|------|------|------|
| Proteínas    | 165  | 31.0 | 0.0  | 3.6  |
| Carboidratos | 130  | 2.7  | 28.0 | 0.3  |
| Lipídeos     | 884  | 0.0  | 0.0  | 100  |
| Frutas       | 52   | 0.3  | 14.0 | 0.2  |
| Vegetais     | 25   | 2.0  | 4.0  | 0.4  |
| Laticínios   | 42   | 3.4  | 5.0  | 1.0  |
| Default      | 100  | 10.0 | 10.0 | 5.0  |

### Estrutura do INSERT

```sql
INSERT INTO alimentos (
  nome,
  tipo_id,
  origem_ptn,
  quantidade_referencia_g,
  kcal_por_referencia,
  ptn_por_referencia,
  cho_por_referencia,
  lip_por_referencia,
  info_adicional,
  autor
) VALUES (
  'Nome do Alimento',
  '33acba74-bbc2-446a-8476-401693c56baf',  -- tipo inferido
  'Animal',                                  -- origem inferida
  100,                                       -- sempre 100g
  165,                                       -- kcal estimado
  31,                                        -- ptn estimado
  0,                                         -- cho estimado
  3.6,                                       -- lip estimado
  'Cadastrado automaticamente via importação de PDF. Valores nutricionais estimados - revisar.',
  'user_id'
);
```

---

## ⚠️ Tratamento de Erros

### Respostas da Edge Function

#### Sucesso (200)
```json
{
  "success": true,
  "data": { /* ParsedStudentData */ }
}
```

#### Erro de Validação (400)
```json
{
  "success": false,
  "error": "PDF base64 é obrigatório"
}
```

#### Erro de Parse (400)
```json
{
  "success": false,
  "error": "Não foi possível extrair dados estruturados do PDF"
}
```

#### Erro de API (500)
```json
{
  "success": false,
  "error": "Erro ao processar PDF: 500"
}
```

---

## 📋 Checklist de Validação

### IA deve extrair:
- [ ] Nome do aluno (obrigatório)
- [ ] Peso, altura, idade, objetivo (se disponíveis)
- [ ] TODAS as refeições (4-8 típico)
- [ ] TODOS os alimentos de cada refeição
- [ ] Quantidades com unidades (g, ml, unidades)
- [ ] Suplementos com dosagem
- [ ] Fármacos com dosagem
- [ ] Orientações gerais

### IA NÃO deve fazer:
- [ ] Retornar grupos genéricos ("Carnes e Proteínas")
- [ ] Parar na 2ª ou 3ª refeição
- [ ] Omitir quantidades
- [ ] Retornar markdown (apenas JSON puro)
- [ ] Inventar dados não presentes no PDF

---

## 🔧 Configuração da IA

### Modelo
```
google/gemini-2.5-flash
```

### Parâmetros
```json
{
  "max_tokens": 32000,
  "temperature": 0.05
}
```

### Formato de Envio do PDF
```typescript
{
  type: 'image_url',
  image_url: {
    url: `data:application/pdf;base64,${pdfBase64}`
  }
}
```

---

## 📚 Referências

- Edge Function: `supabase/functions/parse-student-pdf/index.ts`
- Frontend: `src/components/StudentImporter.tsx`
- Tipos Supabase: `src/integrations/supabase/types.ts`
- Tabelas: `alunos`, `dietas`, `itens_dieta`, `alimentos`, `dieta_farmacos`

---

> 📌 **Nota**: Este schema é o **contrato** entre a IA e o sistema. Qualquer alteração deve ser refletida tanto no prompt da Edge Function quanto no frontend que processa os dados.
