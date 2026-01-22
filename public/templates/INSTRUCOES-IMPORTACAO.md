# Instruções para Importação de Alimentos

## Template CSV

Use o arquivo `template-importacao-alimentos.csv` como base para criar sua lista de alimentos.

## Formato do Arquivo

O arquivo deve ser um CSV com as seguintes colunas (na ordem exata):

### Colunas Obrigatórias

1. **Nome do alimento** (texto)
   - Nome único e descritivo do alimento
   - Exemplo: "Arroz branco cozido", "Frango grelhado"

2. **Quantidade (g/ml)** (número)
   - Quantidade de referência em gramas ou mililitros
   - Padrão recomendado: 100
   - Exemplo: 100

3. **Kcal** (número)
   - Calorias totais na quantidade de referência
   - Exemplo: 130, 165, 98

4. **CHO** (número)
   - Carboidratos em gramas na quantidade de referência
   - Exemplo: 28.1, 0, 26

5. **PTN** (número)
   - Proteínas em gramas na quantidade de referência
   - Exemplo: 2.5, 31, 13

6. **LIP** (número)
   - Lipídios (gorduras) em gramas na quantidade de referência
   - Exemplo: 0.2, 3.6, 10.6

7. **Origem da PTN** (texto)
   - Origem da proteína do alimento
   - Valores aceitos: `Vegetal`, `Animal`, `Mista`, `N/A`
   - **IMPORTANTE**: Use exatamente estes valores

8. **Tipo** (texto)
   - Categoria do alimento
   - Valores recomendados:
     - `CARB` - Carboidratos (arroz, pães, massas, frutas)
     - `PROT` - Proteínas (carnes, ovos, leguminosas)
     - `LIP` - Lipídios (óleos, manteigas, oleaginosas)
     - `VEG` - Vegetais (verduras e legumes)
     - `LATIC` - Laticínios (leite, queijos, iogurtes)

### Colunas Opcionais

9. **Info Adicional** (texto)
   - Informações extras sobre o alimento
   - Deixe vazio se não houver
   - Exemplo: "Peito sem pele", "Extra virgem"

10. **Autor** (texto)
    - Identificação de quem cadastrou o alimento
    - Deixe vazio para usar seu usuário automaticamente

## Regras Importantes

### Formatação
- Use vírgula (`,`) como separador de colunas
- Use ponto (`.`) como separador decimal para números
- Não use vírgula dentro dos textos (substitua por ponto e vírgula se necessário)
- Primeira linha deve conter os cabeçalhos exatamente como no template

### Validações
- Todos os valores numéricos devem ser positivos
- Origem da PTN deve ser exatamente um dos valores aceitos
- Nome do alimento deve ser único (não pode ter duplicatas)
- Valores de CHO, PTN e LIP devem fazer sentido nutritivo

### Cálculo Calórico
O sistema faz validação automática das calorias baseado nos macronutrientes:
- 1g de Carboidrato = 4 kcal
- 1g de Proteína = 4 kcal
- 1g de Lipídio = 9 kcal

Se houver inconsistência maior que 10%, o sistema irá alertá-lo.

## Exemplo de Linha Válida

```csv
Salmão grelhado,100,208,0,22.5,12.4,Animal,PROT,Sem pele,
```

## Como Importar

1. Baixe o template CSV
2. Preencha com seus alimentos seguindo as instruções
3. Salve o arquivo mantendo o formato CSV
4. Na aplicação, vá em "Alimentos" > "Importar Alimentos"
5. Selecione seu arquivo CSV
6. Aguarde a validação e importação

## Dicas

- Use uma planilha (Excel, Google Sheets) para facilitar a edição
- Exporte sempre como CSV UTF-8
- Teste primeiro com poucos alimentos
- Mantenha as informações nutricionais precisas
- Use fontes confiáveis (TACO, USDA, rótulos de produtos)

## Fontes de Dados Recomendadas

- **TACO** - Tabela Brasileira de Composição de Alimentos
- **USDA** - United States Department of Agriculture
- **Rótulos** - Informações nutricionais dos produtos industrializados
- **Unifesp** - Tabela de Composição de Alimentos

## Suporte

Em caso de erros durante a importação, verifique:
1. Formato do arquivo (deve ser CSV)
2. Separadores e decimais corretos
3. Valores obrigatórios preenchidos
4. Valores dentro dos padrões aceitos
5. Nomes únicos sem duplicatas
