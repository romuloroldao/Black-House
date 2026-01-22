# Importação de Alimentos TACO

Este script importa alimentos da Tabela TACO (Tabela Brasileira de Composição de Alimentos) para a base de dados via API REST.

## Pré-requisitos

1. Ter o arquivo Excel parseado
2. Ter credenciais de um usuário coach (email e senha)
3. Backend API rodando (localhost:3001 ou configurado via VITE_API_URL)

## Como Executar

### Passo 1: Configurar Credenciais

Use credenciais de um usuário coach existente no sistema.

### Passo 2: Executar o Script

No terminal, execute:

```bash
API_EMAIL=seu_email@exemplo.com API_PASSWORD=sua_senha npx tsx src/scripts/import-taco-foods.ts
```

OU configure via variáveis de ambiente no `.env`:

```bash
export API_EMAIL=seu_email@exemplo.com
export API_PASSWORD=sua_senha
npx tsx src/scripts/import-taco-foods.ts
```

**⚠️ IMPORTANTE**: Use credenciais de um coach (não de aluno) para ter permissões de inserção.

## O que o Script Faz

1. **Lê o arquivo Excel parseado** com os alimentos da TACO
2. **Processa cada alimento**, extraindo:
   - Nome
   - Calorias
   - Proteínas
   - Carboidratos
   - Gorduras
   - Fibras (quando disponível)

3. **Determina automaticamente**:
   - **Origem da Proteína**: Animal, Vegetal, Mista ou N/A
   - **Tipo do Alimento**: PROT, CARB, LIP, VEG ou LATIC

4. **Insere no banco de dados**, evitando duplicatas

## Categorização Automática

### Origem da Proteína

- **Animal**: Carnes, peixes, ovos, laticínios
- **Vegetal**: Grãos, leguminosas, oleaginosas, frutas, vegetais
- **Mista**: Alimentos compostos (ex: mingau com leite)
- **N/A**: Alimentos processados ou indefinidos

### Tipo do Alimento

- **PROT**: Carnes, peixes, ovos, leguminosas (proteína > 15g)
- **CARB**: Cereais, pães, massas, frutas, tubérculos (carboidrato > 20g)
- **LIP**: Óleos, gorduras, oleaginosas (gordura > 30g)
- **VEG**: Verduras e legumes (carb < 10g e proteína < 5g)
- **LATIC**: Leite e derivados

## Resultado Esperado

O script irá:
- ✅ Importar ~500 alimentos da TACO
- 📁 Criar automaticamente os tipos necessários
- 🔄 Atualizar alimentos existentes (se já importados)
- ⚠️ Ignorar duplicatas
- ❌ Reportar erros (se houver)

## Informações Adicionadas

Cada alimento importado terá:
- **Info Adicional**: "Fonte: TACO" (e fibra quando disponível)
- **Quantidade de Referência**: 100g (padrão TACO)
- **Autor**: Será atribuído ao coach que usar o alimento

## Troubleshooting

### Erro: "Arquivo parseado não encontrado"
- Execute novamente o parse do documento Excel
- Ou copie o arquivo Excel para o projeto

### Erro: "SUPABASE_KEY não configurada"
- Verifique se você passou a chave corretamente
- Use aspas se a chave contiver caracteres especiais

### Erro de permissão
- Verifique se está usando a `service_role` key (não a `anon` key)
- A anon key não tem permissões para inserir em massa

## Dicas

- ⏱️ A importação leva ~2-5 minutos
- 📊 Progresso é exibido a cada 50 alimentos
- 🔄 Pode executar múltiplas vezes (duplicatas são ignoradas)
- ✨ Todos os alimentos ficam disponíveis imediatamente após a importação
