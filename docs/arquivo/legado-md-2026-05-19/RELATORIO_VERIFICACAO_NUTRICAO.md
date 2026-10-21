# Relatório de Verificação - Sistema de Nutrição

**Data:** 2025-11-18  
**Status Geral:** ❌ **FALHA CRÍTICA**

## Sumário Executivo

O sistema atual de criação/edição de planos alimentares **NÃO** corresponde aos requisitos da planilha Excel. Foram identificadas falhas críticas em cálculos, validações e funcionalidades essenciais.

---

## 1. Discrepâncias Numéricas

### 1.1 Meta Calórica e Água (AUSENTE)

| Item | Status | Implementado | Esperado |
|------|--------|--------------|----------|
| Cálculo Meta_kcal = Peso × Kcal/kg | ❌ | Não existe | 80kg × 25 = 2000 kcal |
| Água_min = Peso × 25 | ❌ | Não existe | 80kg × 25 = 2000 ml |
| Água_max = Peso × 50 | ❌ | Não existe | 80kg × 50 = 4000 ml |
| Campos Peso, Altura, Idade | ❌ | Parcial (peso existe) | Completo com sexo e atividade |

**Impacto:** CRÍTICO - Base de todos os cálculos ausente

---

### 1.2 Cálculos por Item (INCORRETO)

#### Problema Identificado:
```typescript
// CÓDIGO ATUAL (INCORRETO):
const fator = item.quantidade / 100;
totalCalorias += item.alimentos.kcal * fator;
```

**Erro:** Assume que `quantidade_referencia_g` é sempre 100g, mas no banco de dados este campo existe e pode ter valores diferentes.

#### Correção Necessária:
```typescript
// CÓDIGO CORRETO:
const fator = item.quantidade / item.alimentos.quantidade_referencia_g;
totalCalorias += item.alimentos.kcal_por_referencia * fator;
```

#### Teste com Arroz Branco (100g):
- **Planilha:** 128 kcal, 28.2g CHO, 2.5g PTN, 0.2g LIP
- **CSV linha 50:** 128 kcal, 28.2g CHO, 2.5g PTN, 0.2g LIP
- **Banco atual:** Precisa verificar mapeamento de campos

**Discrepância:** Nomes de campos não batem
- Planilha usa: `Kcal`, `CHO`, `PTN`, `LIP`
- Código usa: `kcal`, `proteinas`, `carboidratos`, `lipidios`
- Banco tem: `kcal_por_referencia`, `cho_por_referencia`, `ptn_por_referencia`, `lip_por_referencia`

---

### 1.3 Banco de Alimentos - Integridade

Alimentos críticos para auditoria (valores por 100g):

| Alimento | kcal | CHO | PTN | LIP | Status |
|----------|------|-----|-----|-----|--------|
| Arroz branco cozido | 128 | 28.2 | 2.5 | 0.2 | ⚠️ Verificar |
| Batata inglesa cozida | 52 | 11.9 | 1.2 | 0.0 | ⚠️ Verificar |
| Peito de Frango | 159 | 0.0 | 32.0 | 2.5 | ⚠️ Verificar |
| Whey 80% | 400 | 15.0 | 75.0 | 7.0 | ⚠️ Verificar |
| Azeite extra virgem | 884 | 0.0 | 0.0 | 100.0 | ⚠️ Verificar |

---

## 2. Funcionalidades Ausentes

### 2.1 Sistema de Substituições (CRÍTICO)
**Status:** ❌ Completamente ausente

**Esperado:**
- Botão "Sugerir substitutos" em cada item
- Critério por kcal: `qtd_B = qtd_A × (kcal_A / kcal_B)`
- Critério por CHO: `qtd_B = qtd_A × (CHO_A / CHO_B)`
- Filtro por mesmo grupo de alimento
- Exemplo: Arroz 100g → Batata inglesa ≈ 248g (por kcal) ou ≈ 235g (por CHO)

**Impacto:** ALTO - Funcionalidade core ausente

---

### 2.2 Separação de Proteína por Origem
**Status:** ⚠️ Parcialmente implementado

- ✅ Campo `origem_ptn` existe no banco
- ❌ Não há soma separada de Prot(A) e Prot(V)
- ❌ Não exibe nos totais

---

### 2.3 Cálculo de % Energético
**Status:** ❌ Ausente

**Esperado:**
- % CHO = (CHO_g × 4) / Meta_kcal × 100
- % PTN = (PTN_g × 4) / Meta_kcal × 100
- % LIP = (LIP_g × 9) / Meta_kcal × 100

---

## 3. Validações Ausentes

### 3.1 Validação de Entrada
| Validação | Status | Severidade |
|-----------|--------|------------|
| Texto em campo numérico | ❌ | ALTA |
| Quantidade negativa | ❌ | MÉDIA |
| Alimento não cadastrado | ❌ | ALTA |
| Alimento duplicado no banco | ❌ | MÉDIA |

### 3.2 Validação de Plano
| Validação | Status | Severidade |
|-----------|--------|------------|
| Diferença >5% entre meta e total | ❌ | ALTA |
| Fibra total >30g/dia | ❌ | MÉDIA |
| Proteína total vs meta | ❌ | ALTA |
| Sem alimentos selecionados | ⚠️ | MÉDIA |

---

## 4. Passos para Reproduzir Problemas

### Teste 1: Cálculo de Item
1. Criar nova dieta
2. Adicionar "Arroz branco cozido" - 100g
3. **Esperado:** 128 kcal, 28.2g CHO, 2.5g PTN, 0.2g LIP
4. **Resultado:** Precisa verificar no DB atual

### Teste 2: Soma de Refeição
1. Adicionar Arroz 100g + Batata 100g na mesma refeição
2. **Esperado:** 180 kcal (128 + 52)
3. **Resultado:** Cálculo pode estar incorreto devido ao fator

### Teste 3: Substituições (Feature Ausente)
1. Selecionar Arroz 100g
2. Clicar "Sugerir substitutos"
3. **Esperado:** Lista com Batata (248g por kcal), Mandioca, Macarrão
4. **Resultado:** ❌ Funcionalidade não existe

---

## 5. Recomendações Prioritárias

### 5.1 URGENTE (Implementar Imediatamente)
1. **Adicionar campos antropométricos ao perfil do aluno:**
   - Peso (kg)
   - Altura (cm)
   - Idade (anos)
   - Sexo (M/F)
   - Nível de atividade (sedentário/leve/moderado/intenso)
   - Kcal/kg alvo

2. **Corrigir cálculos de macronutrientes:**
   - Usar `quantidade_referencia_g` corretamente
   - Mapear campos corretamente do banco

3. **Implementar cálculo de meta calórica e água:**
   - Meta_kcal = Peso × Kcal/kg
   - Água = Peso × 25-50 ml

4. **Adicionar sistema de substituições:**
   - Por kcal e por CHO
   - Filtro por grupo
   - Cálculo automático de quantidade equivalente

### 5.2 IMPORTANTE (Próxima Sprint)
5. **Adicionar % energético:**
   - Exibir % de CHO, PTN, LIP
   - Alerta se fora dos parâmetros

6. **Separar proteína por origem:**
   - Somar Prot(A) e Prot(V) separadamente
   - Exibir nos totais

7. **Validações de entrada:**
   - Campos numéricos obrigatórios
   - Mensagens de erro amigáveis

### 5.3 DESEJÁVEL
8. **Validação de fibra e alertas:**
   - Fibra >30g/dia
   - Diferença >5% meta vs total

9. **Exportação/relatório:**
   - PDF com plano completo
   - Lista de substituições

10. **Organização por dia da semana:**
    - Usar campo `dia_semana` existente
    - Interface para planejar semana completa

---

## 6. Checklist de Conformidade

### Cálculos Básicos
- [ ] Meta calórica (Peso × Kcal/kg)
- [ ] Água mínima/máxima (Peso × 25-50)
- [ ] Cálculo por item correto (usando quantidade_referencia_g)
- [ ] Soma por refeição
- [ ] Soma diária
- [ ] % energético (CHO, PTN, LIP)

### Proteína
- [ ] Separação Animal/Vegetal
- [ ] Validação de meta proteica (g/kg)

### Substituições
- [ ] Sugestão por kcal
- [ ] Sugestão por CHO
- [ ] Filtro por grupo
- [ ] Cálculo de quantidade equivalente
- [ ] Atualização automática dos totais

### Validações
- [ ] Campos numéricos obrigatórios
- [ ] Texto em campo numérico → erro
- [ ] Alimento duplicado → alerta
- [ ] Diferença >5% meta → alerta
- [ ] Fibra >30g → alerta

### Interface
- [ ] Campos antropométricos no perfil
- [ ] Exibição de metas calculadas
- [ ] Separação por dia da semana
- [ ] Visualização de % energético
- [ ] Origem de proteína visível

### Banco de Dados
- [ ] Todos os alimentos da planilha importados
- [ ] Valores conferidos (tolerância 1%)
- [ ] Campos mapeados corretamente

---

## 7. Conclusão

O sistema atual precisa de **refatoração significativa** para atender aos requisitos da planilha. As correções envolvem:
- Adicionar campos de dados antropométricos
- Corrigir todos os cálculos nutricionais
- Implementar sistema de substituições (feature crítica)
- Adicionar múltiplas validações
- Melhorar interface com visualização de % e metas

**Estimativa de esforço:** 3-5 dias de desenvolvimento full-time

**Risco:** ALTO - Sistema em produção pode estar calculando valores incorretos
