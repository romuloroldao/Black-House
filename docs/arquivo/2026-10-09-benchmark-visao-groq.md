# Benchmark de visão no plano gratuito: Groq vs Gemini, e pose no celular (MediaPipe)

Data: 2026-10-09. Plano de origem: "Estratégia de IA no plano gratuito: benchmark Groq + pose no celular".

## Conclusão

1. **O Groq gratuito não substitui o Gemini na pose nem na foto de refeição.** Falha no critério de volume (≥ 100 requisições/dia) e na qualidade: viés forte para `lado_esquerdo` e detecta só 1 de 6 fotos inválidas.
2. **A pose passa a ser calculada no celular do aluno com MediaPipe.** Em frente/costas, concorda 99,0% com os rótulos confiantes do Gemini (limiar 0,8, cobrindo 99% das fotos), sem custo de API e em ~40 ms por foto depois do primeiro carregamento.
3. **A convenção de lado agora é anatómica** ("lado esquerdo" = lado esquerdo do corpo virado para a câmara). O MediaPipe concorda com essa convenção e com a maioria dos alunos. O Gemini, com o prompt antigo, era o elo inconsistente.
4. O Groq **não** entrou na cadeia de reserva de visão. Continua como provedor de texto (`qwen/qwen3.8-27b`), com o Gemini como reserva.

## Limites medidos do Groq gratuito (`qwen/qwen3.8-27b`)

| Limite | Valor |
|---|---|
| Requisições/dia | 1000 |
| Tokens de entrada/min (ITPM) | 7000 |
| Tokens/min (TPM) | 8000 |
| Tokens de saída/min (OTPM) | 1000 |
| **Tokens/dia (TPD)** | **200 000** (balde que recarrega ~139 tokens/min) |
| Tokens por imagem | ~2 190 de entrada, independente da resolução |

O gargalo real é o TPD: ~80 imagens/dia **no total**, divididas com as features de texto, que usam o mesmo modelo. Enquanto o benchmark rodava, o texto ficou sem saldo e caiu para o Gemini. O benchmark parou duas vezes por TPD (56 fotos com resposta, em vez das ~150 planeadas).

Também foi necessário: `max_tokens` de visão 600 (com 1024 o pedido é recusado pelo OTPM de 1000) e espera de até 30 s por `retry-after` em 429 por minuto.

## Benchmark de pose: Groq vs rótulo atual

Amostra estratificada (sorteio determinístico por `md5(id)`), 56 fotos com resposta. **Atenção:** o rótulo atual (`pose_efetiva`) é quase todo do próprio Gemini, então isto mede concordância, não verdade.

| Estrato | Concorda com rótulo | Concorda com aluno |
|---|---|---|
| coach_corrigida | 4/6 | 2/6 |
| divergencia_lado (aluno ≠ Gemini) | 13/30 | 17/30 |
| divergencia_outra | 6/7 | 0/7 |
| invalido | 1/5 | 0/5 |
| frente | 5/5 | 4/5 |
| costas | 3/3 | 1/3 |

Matriz (linhas = rótulo, colunas = Groq):

| rótulo | frente | costas | lado_esq | lado_dir | desconh. | inválido |
|---|---|---|---|---|---|---|
| costas | 1 | 7 | 0 | 0 | 0 | 0 |
| frente | 9 | 0 | 0 | 0 | 0 | 0 |
| inválido | 1 | 4 | 0 | 0 | 0 | 1 |
| lado_direito | 0 | 0 | 15 | 4 | 0 | 0 |
| lado_esquerdo | 0 | 0 | 11 | 3 | 0 | 0 |

- Latência: p50 1,1 s, p95 2,7 s (o Gemini leva 2 a 30 s conforme o modelo).
- Frente/costas: bom, mas a amostra pequena (17 fotos) não permite afirmar ≥ 95%.
- Laterais: o Groq diz `lado_esquerdo` em 26 de 33. É viés, não convenção.
- Inválidas: 1 de 6.

## Foto de refeição (qualitativo)

Só há 5 fotos no banco. O Groq respondeu 1 antes de esgotar o TPD. Nela, o Groq viu "bolo de aveia e frutas secas" e o Gemini (`gemini-flash-lite-latest`), "bolo de carne". A imagem mostra um assado salgado com pimentão vermelho, então o Gemini é mais plausível. As outras 4 só tiveram resposta do Gemini (bananas e um lanche, todas coerentes). O resultado é inconclusivo, mas não há sinal a favor do Groq.

## MediaPipe: validação offline

Pontos do corpo extraídos em Python (`server/scripts/pose-landmarks-extract.py`, MediaPipe 1.1.0, CPU) de **todas as 1 511 fotos**. Classificador TS puro em `src/lib/pose-classify.ts`, o mesmo arquivo usado no navegador, avaliado por `server/scripts/pose-landmarks-eval.js`.

Sinais usados:

- **Lateral ou frontal:** largura dos ombros / altura do tronco (lateral ≤ 0,35, frontal ≥ 0,5, intermédio = desconhecido).
- **Frente ou costas:** o ombro esquerdo anatómico fica à direita da imagem quando a pessoa está de frente, e o nariz fica à frente dos ombros (profundidade). A visibilidade do rosto não serve, porque o modelo a estima perto de 1 nos dois casos.
- **Esquerda ou direita:** o nariz aponta para a esquerda da imagem = lado esquerdo do corpo virado para a câmara; o ombro mais próximo da câmara confirma.

Resultados contra os rótulos atuais:

| Métrica | lite (5,8 MB) | full (9,4 MB) |
|---|---|---|
| Frente/costas com Gemini confiante (≥ 0,85), limiar 0,8 | 790/798 (99,0%) | 796/799 (99,6%) |
| Cobertura nesse conjunto | 99% | 99% |
| Tempo por foto (servidor, CPU) | p50 123 ms | — |

Escolhido o **lite**: 6 erros a mais em 800 fotos não justificam 60% a mais de download no celular.

**Rótulos legados (escolhidos pelo aluno):** o MediaPipe concorda só 77,5% em frente/costas. A profundidade do nariz concorda sempre com o sinal dos ombros, ou seja, o MediaPipe é internamente consistente. A hipótese mais provável é aluno a escolher o slot errado. Não foi verificado visualmente.

**Laterais** (onde o MediaPipe diz lateral):

- Aluno e Gemini concordam no lado (43 fotos): o MediaPipe concorda em 42.
- Aluno e Gemini discordam (36 fotos): o MediaPipe fica com o aluno em 26 e com o Gemini em 10.
- Leitura: os alunos já usam, na maioria, a convenção anatómica, e o Gemini com o prompt antigo ("perfil esquerdo") era inconsistente.

**Prompt novo do Gemini** (convenção anatómica explícita): concordou com o MediaPipe em 6 de 6 respostas válidas, incluindo 3 em que o lado muda em relação ao rótulo antigo.

**Paridade navegador vs Python:** o chunk de produção, na imagem pública de teste do MediaPipe e na cópia espelhada, deu resultado idêntico ao Python (frente, razão 0,58/0,60). Primeira deteção: 1,9 s com ~9,7 MB transferidos (3,8 MB de WASM com gzip + 5,8 MB de modelo). Seguintes: ~40 ms.

### Sinal contrário a verificar

As 2 laterais corrigidas pelo coach (01/09, data do primeiro teste do recurso) estão marcadas `lado_esquerdo`, mas, pela geometria, mostram o lado **direito** do corpo virado para a câmara (o nariz aponta para a direita da imagem). O coach pode ter usado a convenção "para que lado o aluno girou". Recomendo conferir essas duas fotos (`7d34fe41…`, `a87d2e84…`). Se o coach preferir a outra convenção, basta inverter o sinal em `pose-classify.ts` e o prompt.

## O que foi implementado

- **Instrumentação:** tabela `ai_usage_events` (feature, modalidade, provedor, modelo, status, tipo de erro, latência), gravada sem bloquear em todas as chamadas de IA da API.
- **Visão via Groq:** `extractStructuredDataFromImage` no provedor Groq, cadeia de visão com sintaxe `provider:modelo` e prazo total por chamada.
- **Ganhos rápidos:** a foto de refeição usa a cadeia de modelos (429 vira mensagem clara de limite diário), há mais modelos Gemini na cadeia (~6 × 20/dia) e limite por utilizador nas rotas de IA do check-in.
- **Pose no celular:**
  - `src/lib/pose-detect.ts`: carregado sob demanda quando o aluno adiciona uma foto, sem bloquear o envio (espera no máximo 3 s por foto no envio). Respeita o modo de economia de dados; `VITE_POSE_CLIENT_ENABLED=false` desliga.
  - O servidor aceita `pose_client` só para frente/costas/laterais com confiança ≥ `POSE_CLIENT_MIN_CONFIDENCE` (0,8) e grava `pose_source='client_mediapipe'`. Inválido, desconhecido ou abaixo do limiar vai para a fila do Gemini, como antes.
  - Assets em `/mediapipe/<versão>/`, servidos pelo próprio domínio com cache imutável e gzip pré-comprimido (`scripts/copy-mediapipe-assets.mjs` no `prebuild`; a pasta não vai para o git).
- **Reclassificação das laterais (convenção anatómica):**
  - 90 das 169 laterais sem correção do coach receberam o rótulo do MediaPipe (full, servidor, confiança ≥ 0,8; `pose_source='server_mediapipe'`). Mudaram de lado 24. O rótulo anterior fica em `pose_quality.previous`.
  - As outras 79 estão na fila (`pose_reclassify_at`). O job reprocessa-as com o prompt novo **depois** das fotos novas, sem tirá-las das comparações durante a espera (status continua `classified`).

## Limitações e riscos

- **Concordância não é verdade.** Só 6 fotos têm rótulo humano. A página de revisão das divergências do Groq (24 fotos, com a coluna do MediaPipe) está em `/root/benchmark-visao/revisao-divergencias.html`. Contém fotos de alunos: fica fora do Nginx, com permissão 600.
- **Selfie no espelho** inverte esquerda e direita na imagem. Nem o MediaPipe nem o Gemini corrigem isso.
- **Fotos sem pessoa detetada:** o lite não encontrou ninguém em ~2% das fotos. Essas seguem para a fila do Gemini.
- **Inválidas:** o MediaPipe só marca inválido por zero ou várias pessoas, ou tronco cortado. O servidor não aceita "inválido" vindo do cliente, então essas decisões continuam com o Gemini.
- **Dado do cliente pode ser forjado:** afeta só as fotos do próprio aluno, o coach pode corrigir, e o servidor exige pose comparável e o limiar.
- **Ainda não testado em celulares reais** (Safari iOS antigo, Android de entrada). Se falhar, a foto segue para a fila do servidor, como antes.

## Próximos passos sugeridos

1. Acompanhar a fração de fotos com `pose_source='client_mediapipe'` e o uso do Gemini em `ai_usage_events` nas próximas semanas.
2. Rever as 2 laterais do coach e a página de divergências.
3. Se a cobertura no celular ficar baixa, considerar o modelo full ou baixar o limiar para 0,7 (98,9% em frente/costas no lite).

## Artefactos (fora do repo, sensíveis)

`/root/benchmark-visao/`: `qwen.jsonl`, `landmarks-{lite,full}.jsonl`, `mediapipe-eval-{lite,full}.jsonl`, `revisao-divergencias.html`, `meal-compare.jsonl`, `backfill-laterais.json`, `fila-gemini-laterais.json` e o backup do Nginx.
