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

INSTRUÇÕES CRÍTICAS - LEIA COM ATENÇÃO:

1. O PDF contém um plano alimentar com VÁRIAS REFEIÇÕES. Planos típicos têm entre 4 a 8 refeições.
2. VOCÊ DEVE EXTRAIR TODAS AS REFEIÇÕES do documento, sem exceção. Não limite a extração.
3. Cada refeição tem uma TABELA com colunas: Qtd (g/ml), Alimentos de preferência, Alimentos substitutos
4. Extraia APENAS os alimentos da coluna "Alimentos de preferência" com suas quantidades
5. Os alimentos podem ser:
   - Alimentos específicos como "Whey Protein", "Pão de forma tradicional"
   - Grupos genéricos como "Carnes e Proteínas", "Feijão e Leguminosas", "Vegetais A"
   
6. Para SUPLEMENTOS: procure tabelas com "Suplementação" ou "Fitoterápicos"
7. Para FÁRMACOS: procure tabelas com "Fármacos" ou "Protocolos"
8. ORIENTAÇÕES: texto com dicas gerais de alimentação

ESTRUTURA DO JSON DE SAÍDA:

{
  "aluno": {
    "nome": "string (nome do aluno, ex: Nome: João Silva)",
    "peso": number (peso em kg, apenas o número),
    "altura": number (altura em cm, opcional),
    "idade": number (apenas número, opcional),
    "objetivo": "string (objetivo, opcional)"
  },
  "dieta": {
    "nome": "string (geralmente PLANO ALIMENTAR ou nome do plano)",
    "objetivo": "string (estratégia ou objetivo)",
    "refeicoes": [
      {
        "nome": "Refeição 1",
        "alimentos": [
          { "nome": "Whey Protein", "quantidade": "30g" },
          { "nome": "Pão de forma tradicional", "quantidade": "80g" }
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
      "proteina": number (PTN total em gramas),
      "carboidrato": number (CHO total em gramas),
      "gordura": number (LIP total em gramas),
      "calorias": number (Kcal total)
    }
  },
  "suplementos": [
    { "nome": "Creatina", "dosagem": "10g", "observacao": "Pré treino" }
  ],
  "farmacos": [
    { "nome": "Testosterona", "dosagem": "150mg", "observacao": "1x a cada 7 dias" }
  ],
  "orientacoes": "string com todas as orientações/dicas"
}

REGRAS CRÍTICAS:
- Retorne APENAS o JSON válido, sem markdown, sem \`\`\` ou explicações
- EXTRAIA ABSOLUTAMENTE TODAS AS REFEIÇÕES - geralmente são de 4 a 8 refeições
- Use exatamente os nomes dos alimentos como aparecem no PDF
- A quantidade DEVE incluir a unidade (g, ml, unidades)
- Mantenha "Refeição 1", "Refeição 2" etc como nomes das refeições
- Separe SUPLEMENTOS (Creatina, Whey, Vitaminas, Fitoterápicos) de FÁRMACOS (medicamentos, hormônios como Testosterona, Glifage)
- Se um campo não existir, omita-o ou use null
- NÃO PULE NENHUMA REFEIÇÃO - extraia todas as que existem no documento`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analise este PDF de plano alimentar e extraia TODOS os dados estruturados. IMPORTANTE: Extraia TODAS as refeições do documento (geralmente são 4 a 8 refeições). Não limite a extração às primeiras refeições. Extraia cada alimento com sua quantidade da coluna "Alimentos de preferência":'
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
        max_tokens: 16384,
        temperature: 0.1
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
