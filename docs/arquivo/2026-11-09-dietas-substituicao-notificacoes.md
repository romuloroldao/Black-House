# Dietas — substituição, navegação entre dias e avisos de alteração (2026-11-09)

Evolução da implementação existente (sem reconstruir). Três frentes.

## 1. Substituição alimentar

### Diagnóstico

- `GET /api/alimentos/:id/substituicoes` devolvia **500 para qualquer alimento** desde 2026-09-17: o SQL da referência
  acrescentava colunas depois do `LEFT JOIN` (`relation "a.info_adicional" does not exist`). Produção: 111 erros nos
  logs entre 06 e 08/11. O cliente caía no fallback local ou mostrava "Não foi possível carregar".
- Gravar a substituição do aluno (`PUT /api/alunos/me/refeicao-substituicoes`) lia `itens_dieta.plano`, coluna que não
  existe (nem em produção) → 500. O plano já vem no pedido.
- A busca exigia 2 caracteres e limitava a 20 resultados; não havia forma de ver o grupo inteiro.

### Entrega

- SQL corrigido (`server/services/alimento-substituicoes.service.js`, `server/repositories/refeicao-substituicao.repository.js`).
- `all=1` em `GET /api/alimentos/:id/substituicoes`: grupo inteiro (até 500; os grupos têm ≤ 60 alimentos), sem mínimo de caracteres.
- Diálogo de substituição: abas **Busca rápida** (mantida) e **Ver lista completa** — filtro por nome sem mínimo
  (sem acentos, palavras em qualquer ordem), chips por categoria, secções com cabeçalho fixo, linha densa
  "alimento · quantidade equivalente · kcal", seleção direta, estados de carregamento/vazio/erro, renderização progressiva.
- Regra de negócio inalterada: substituição isocalórica dentro do mesmo grupo (`tipo_id`), validada no servidor.

### Categorias pessoais do profissional

- Tabelas `coach_food_categories` e `coach_food_category_items` (migração `server/migrations/20261109_coach_food_categories.sql`).
  Só guardam referências a `alimentos`; `alimentos`/`tipos_alimentos` (globais) não mudam.
- Um alimento fica no máximo numa categoria por profissional (PK `coach_id, alimento_id`) → mover nunca duplica.
  Apagar categoria apaga só as ligações: os alimentos voltam a "Sem categoria".
- API `/api/food-categories`: `GET` (coach/admin/assistente; aluno lê as do seu coach), `POST`, `PATCH /:id`,
  `DELETE /:id`, `PUT /:id/items`, `DELETE /items`. Escrita só para coach/admin/assistente com permissão de escrita.
  Sem a migração aplicada, o `GET` responde lista vazia e a lista completa funciona sem categorias.
- UI: botão **Organizar categorias** (só quem pode editar) abre painel com criar/renomear/excluir (com confirmação),
  arrastar entre categorias e menu **Mover para** (toque/teclado), e "Sem categoria".

## 2. Navegação entre dias da dieta

- Rotação de cardápios calculada no dia civil de Brasília (igual ao servidor), virada de dia à meia-noite,
  navegação ‹ › e faixa de 7 dias com a letra do plano, "Voltar para hoje", dias anteriores ao início sem rotação falsa.
- Dias que não são hoje ficam em pré-visualização (sem marcar refeições nem substituir).
- Pré-visualização do coach com o mesmo navegador; corrigidas as macros `NaN` na pré-visualização.

## 3. Avisos de alteração de dieta e treino

### Diagnóstico (produção)

- Treino nunca gerava aviso; e-mail de dieta nunca era enviado; o aviso de dieta saía a cada escrita parcial
  (antes de a edição terminar), podendo gerar vários avisos por edição.

### Entrega

- Outbox `plan_change_notifications` (migração `server/migrations/20261109_plan_change_notifications.sql`):
  agrupa alterações (debounce), envia depois da gravação, um aviso por janela, in-app + socket + e-mail conforme
  preferências, tentativas com backoff, estado visível para o coach e botão **Reenviar** em falha.
- Destinatário resolvido por `user_id`/`linked_user_id`/e-mail (produção usa `user_id`).

## Base de dados — aplicar em produção (aditivo, idempotente)

```bash
sudo -u postgres psql -d blackhouse_db -f server/migrations/20261109_plan_change_notifications.sql
sudo -u postgres psql -d blackhouse_db -f server/migrations/20261109_coach_food_categories.sql
```

Ambas usam `CREATE ... IF NOT EXISTS` e dão `GRANT` a `app_user`. Nenhuma altera ou apaga dados existentes.

## Testes

- `node --test server/tests/*.test.js` (inclui `food-substitution-categories.test.js`, `plan-change-notification.test.js`).
- `node --test src/lib/diet-rotation.test.mjs src/lib/food-categories.test.mjs`.
- E2E de avisos com SMTP real local: 27/27 verificações.
