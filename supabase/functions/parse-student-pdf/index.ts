import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, fileName } = await req.json();

    if (!pdfBase64) {
      throw new Error('PDF base64 é obrigatório');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log('Processando PDF:', fileName);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente especializado em extrair dados de fichas de alunos de personal trainers/nutricionistas.

## INSTRUÇÕES CRÍTICAS - LEIA COM ATENÇÃO:

### EXTRAÇÃO DE REFEIÇÕES (MUITO IMPORTANTE):
1. O PDF contém um plano alimentar com VÁRIAS REFEIÇÕES (geralmente 4 a 8 refeições).
2. VOCÊ DEVE EXTRAIR ABSOLUTAMENTE TODAS AS REFEIÇÕES do documento. NÃO pare na refeição 2 ou 3.
3. Percorra TODO o documento página por página para encontrar todas as refeições.
4. Cada refeição geralmente está em uma seção separada com título "Refeição 1", "Refeição 2", etc.
5. Alguns PDFs usam nomes como "Café da Manhã", "Almoço", "Jantar" - extraia todos.

### EXTRAÇÃO DE ALIMENTOS (MUITO IMPORTANTE):
1. Cada refeição tem uma TABELA com colunas: Qtd (g/ml), Alimentos de preferência, Alimentos substitutos
2. Extraia APENAS os alimentos da coluna "Alimentos de preferência" 
3. Use NOMES SIMPLES E ESPECÍFICOS para os alimentos:
   - ✅ CORRETO: "frango", "arroz branco", "ovo", "banana", "batata doce"
   - ❌ ERRADO: "Carnes e Proteínas", "Personalizado Prot", "Vegetais A"
4. Se o PDF mostrar grupos genéricos, tente identificar o alimento específico mencionado ou use o nome mais comum:
   - "Carnes e Proteínas" → "frango" ou "carne bovina"
   - "Feijão e Leguminosas" → "feijão"
   - "Vegetais A" → "salada verde"
   - "Vegetais B" → "legumes cozidos"
5. A quantidade DEVE incluir a unidade (g, ml, unidades). Ex: "150g", "200ml", "2 unidades"

### SUPLEMENTOS E FÁRMACOS:
- SUPLEMENTOS: Creatina, Whey, Vitaminas, Ômega 3, Fitoterápicos, Colágeno
- FÁRMACOS: Medicamentos controlados, hormônios (Testosterona, GH), Glifage, etc.

### ESTRUTURA DO JSON DE SAÍDA:

{
  "aluno": {
    "nome": "string",
    "peso": number,
    "altura": number,
    "idade": number,
    "objetivo": "string"
  },
  "dieta": {
    "nome": "string",
    "objetivo": "string",
    "refeicoes": [
      {
        "nome": "Refeição 1",
        "alimentos": [
          { "nome": "whey protein", "quantidade": "30g" },
          { "nome": "pão de forma", "quantidade": "80g" },
          { "nome": "banana", "quantidade": "1 unidade" }
        ]
      },
      {
        "nome": "Refeição 2",
        "alimentos": [...]
      },
      {
        "nome": "Refeição 3",
        "alimentos": [...]
      },
      {
        "nome": "Refeição 4",
        "alimentos": [...]
      },
      {
        "nome": "Refeição 5",
        "alimentos": [...]
      },
      {
        "nome": "Refeição 6",
        "alimentos": [...]
      }
    ],
    "macros": {
      "proteina": number,
      "carboidrato": number,
      "gordura": number,
      "calorias": number
    }
  },
  "suplementos": [
    { "nome": "creatina", "dosagem": "10g", "observacao": "pré treino" }
  ],
  "farmacos": [
    { "nome": "testosterona", "dosagem": "150mg", "observacao": "1x semana" }
  ],
  "orientacoes": "string"
}

### REGRAS CRÍTICAS:
1. Retorne APENAS JSON válido, sem markdown, sem \`\`\`
2. EXTRAIA TODAS AS REFEIÇÕES (mínimo esperado: 4-8 refeições)
3. Use nomes de alimentos SIMPLES e ESPECÍFICOS, não grupos genéricos
4. Quantidade sempre com unidade (g, ml, unidades)
5. Se não encontrar um campo, omita ou use null`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `TAREFA: Extraia TODOS os dados deste plano alimentar em PDF.

CHECKLIST OBRIGATÓRIO:
□ Extrair dados do aluno (nome, peso, objetivo)
□ Extrair TODAS as refeições (geralmente 4-8, NÃO pare na 2ª ou 3ª)
□ Para cada refeição, extrair TODOS os alimentos com quantidade
□ Usar nomes SIMPLES para alimentos (ex: "frango" não "Carnes e Proteínas")
□ Extrair suplementos
□ Extrair fármacos
□ Extrair orientações

ATENÇÃO: Percorra TODAS as páginas do documento para encontrar todas as refeições.
Muitos PDFs têm refeições espalhadas em várias páginas.

Retorne apenas o JSON, sem explicações.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 32000,
        temperature: 0.05
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da API:', errorText);
      throw new Error(`Erro ao processar PDF: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Resposta vazia da IA');
    }

    console.log('Resposta da IA (primeiros 3000 chars):', content.substring(0, 3000));

    // Parse JSON da resposta
    let parsedData;
    try {
      // Remove possíveis marcadores de código e espaços
      let cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .replace(/^\s+|\s+$/g, '');
      
      // Tenta encontrar o JSON se houver texto antes/depois
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanContent = jsonMatch[0];
      }
      
      parsedData = JSON.parse(cleanContent);
      
      // Validação básica
      if (!parsedData.aluno) {
        parsedData.aluno = { nome: 'Aluno Importado' };
      }
      if (!parsedData.aluno.nome) {
        parsedData.aluno.nome = 'Aluno Importado';
      }
      
      const numRefeicoes = parsedData.dieta?.refeicoes?.length || 0;
      console.log('Dados extraídos - Aluno:', parsedData.aluno?.nome);
      console.log('Dados extraídos - Número de Refeições:', numRefeicoes);
      
      // Log each meal name
      if (parsedData.dieta?.refeicoes) {
        parsedData.dieta.refeicoes.forEach((ref: any, idx: number) => {
          console.log(`  - ${ref.nome}: ${ref.alimentos?.length || 0} alimentos`);
        });
      }
      
      console.log('Dados extraídos - Suplementos:', parsedData.suplementos?.length || 0);
      console.log('Dados extraídos - Fármacos:', parsedData.farmacos?.length || 0);
      
      // Warning if few meals
      if (numRefeicoes < 3) {
        console.warn('AVISO: Poucas refeições extraídas. O PDF pode conter mais refeições.');
      }
      
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON:', parseError);
      console.error('Conteúdo que falhou:', content.substring(0, 1000));
      throw new Error('Não foi possível extrair dados estruturados do PDF');
    }

    return new Response(JSON.stringify({ success: true, data: parsedData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
