# Especificação técnica — Importação contextual P0

**Data:** 2026-05-25  
**Status:** Implementado (P0 — 2026-05-25)  
**Relacionado:** proposta UX importação/vínculo aluno–dieta  

---

## 1. Objetivo

Reduzir fricção operacional e erros de vínculo ao permitir:

1. Importar ficha/dieta **dentro do perfil** de aluno existente (`mode: enrich`).
2. Escolher **destino explícito** no import global (lista de alunos).
3. Usar `POST /api/import/confirm-diet` já existente no backend.
4. Alertar **duplicados** antes de criar novo aluno.
5. Corrigir CTA morto em Vincular Usuários.

---

## 2. Modelo de dados e modos

| Modo | `mode` | API confirm | Cria `alunos`? | Cria `dietas`? |
|------|--------|-------------|----------------|----------------|
| Novo aluno + ficha | `create` | `POST /api/import/confirm` | Sim | Se houver refeições |
| Aluno existente | `enrich` | `POST /api/import/confirm-diet` | Não | Sim |

### Payload `confirm-diet` (schema `DietOnlyImportSchema`)

```json
{
  "data": {
    "aluno_id": "uuid",
    "dieta": {
      "nome": "string",
      "objetivo": "string | null",
      "refeicoes": [{ "nome": "...", "alimentos": [{ "nome": "...", "quantidade": "..." }] }],
      "macros": {},
      "rotacao_ativa": false
    },
    "suplementos": [],
    "farmacos": []
  }
}
```

**Nota:** `data_retorno` não está no schema diet-only P0; rotação sim. Retorno pode ser adicionado em P1 no schema.

---

## 3. Componente `StudentImporter`

### Props

```typescript
type ImportMode = 'create' | 'enrich';

interface ImportTargetAluno {
  id: string;
  nome: string;
  email?: string | null;
}

interface StudentImporterProps {
  mode?: ImportMode;
  targetAluno?: ImportTargetAluno;
  existingAlunos?: ExistingAlunoForImport[];
  showDestinationPicker?: boolean; // default: mode !== 'enrich'
  onImportComplete?: (result?: ImportCompleteResult) => void;
  onClose?: () => void;
}
```

### Comportamento

| Contexto | `mode` | `targetAluno` | UI |
|----------|--------|---------------|-----|
| Perfil `/alunos/:id` | `enrich` | aluno do perfil | Banner destino fixo; abas Dieta/Protocolo; CTA «Confirmar e vincular a {nome}» |
| Lista Gestão de Alunos | — | — | Passo «Para quem?»; duplicados na revisão |
| Lista + escolhe existente | `enrich` (dinâmico) | combobox | Igual perfil |

### Estados UI

- **Banner destino** (`ImportDestinationBanner`): sempre visível em `review` e `upload` (enrich).
- **Duplicados** (`ImportDuplicateAlert`): em `create`, se `findImportDuplicateMatches` retornar matches.
- **Sucesso**: mensagem + `ImportCompleteResult` com `alunoId`, `dietaId`, `mode`.

---

## 4. Entry points

| Local | Ficheiro | Acção |
|-------|----------|-------|
| Perfil aluno — header | `StudentDetails.tsx` | Botão «Importar ficha» |
| Perfil aluno — tab Nutrição | `StudentDetails.tsx` | «Importar ficha PDF» (empty + com dieta) |
| Lista alunos | `StudentManager.tsx` | «Importar» + `existingAlunos` + `?import=1` |
| Vincular usuários | `UserLinkingManager.tsx` | CTA → `/?tab=students&import=1` |

---

## 5. Detecção de duplicados

**Ficheiro:** `src/lib/import-duplicate-detection.ts`

| Regra | Peso | Campo |
|-------|------|-------|
| Email igual (normalizado) | 100 | `aluno.email` |
| CPF/CNPJ só dígitos | 100 | `cpf_cnpj` |
| Nome similar (primeiro token + inclusão) | 70 | `nome` |

Retorna lista ordenada por score. UI bloqueia soft: coach pode «Continuar mesmo assim» ou «Usar aluno existente» (muda para enrich).

---

## 6. Contrato API (frontend)

`src/contracts/api-contract.ts`:

```typescript
import: {
  parsePdf: () => `${API_BASE}/api/import/parse-pdf`,
  confirm: () => `${API_BASE}/api/import/confirm`,
  confirmDiet: () => `${API_BASE}/api/import/confirm-diet`,
},
```

`src/lib/api-client.ts`: allowlist + `importConfirmDietSafe(data)`.

---

## 7. PRs (ordem de merge)

> **Nota:** A implementação P0 foi aplicada no working tree. Para revisão isolada, use os commits/branches abaixo na ordem indicada.

### Ficheiros tocados (resumo)

| Área | Ficheiros |
|------|-----------|
| Contrato API | `src/contracts/api-contract.ts`, `src/lib/api-client.ts` |
| Import UI | `src/components/StudentImporter.tsx`, `src/components/import/*` |
| Util | `src/lib/import-duplicate-detection.ts` |
| Entry points | `StudentDetails.tsx`, `StudentManager.tsx`, `UserLinkingManager.tsx` |

---

### PR-1 — `feat(import): contrato confirm-diet no frontend`

- `api-contract.ts` — `confirmDiet`
- `api-client.ts` — allowlist + `importConfirmDietSafe`

**Critério:** chamada autenticada 200 com payload válido.

---

### PR-2 — `feat(import): StudentImporter modos create/enrich`

- `StudentImporter.tsx` — props, banner, branch confirm, microcopy
- `import/ImportDestinationBanner.tsx`
- `import/ImportDuplicateAlert.tsx`
- `lib/import-duplicate-detection.ts`

**Critério:** perfil pode importar dieta sem criar aluno; lista permite escolher destino.

---

### PR-3 — `feat(import): entry points perfil e lista`

- `StudentDetails.tsx` — dialog import
- `StudentManager.tsx` — `existingAlunos`, título dialog, `?import=1`

**Critério:** coach importa do perfil; duplicado alertado na lista.

---

### PR-4 — `fix(linking): CTA importar em Vincular Usuários`

- `UserLinkingManager.tsx` — `navigate('/?tab=students&import=1')`

---

## 8. Testes manuais (checklist)

**Validação:** aceite 2026-05-26 (deploy + browser coach; cenário Luiz unificado).

- [x] Perfil aluno sem dieta → importar PDF → dieta aparece na tab Nutrição
- [x] Perfil com dieta → reimportar → segunda dieta criada (comportamento actual backend)
- [x] Lista → novo aluno → confirm → aluno na lista
- [x] Lista → aluno existente no picker → não cria duplicado
- [x] Lista → nome/email igual a existente → alerta duplicado
- [x] Vincular → «Importar Fichas» abre Gestão de Alunos com modal
- [x] Mobile: modal scrollável, CTA fixo no rodapé *(aceite operacional)*

---

## 9. Fora de P0 (P1+)

- [x] Wizard «Novo Aluno» com import integrado (2026-05-26)
- [x] `data_retorno` em `DietOnlyImportSchema` + envio no `confirm-diet`
- [x] Opção **Substituir dieta activa** (`replace_active_diet`)
- [x] Histórico de importações (2026-05-28)
- [ ] Card estado portal no perfil
- [ ] Importação em lote

---

## 10. Riscos conhecidos

- `confirm-diet` **adiciona** dieta, não substitui a activa — documentar na UI (P1: opção substituir).
- Telefone na importação create pode não persistir (bug pré-existente em `StudentService`).
- Email temporário `import-@blackhouse.local` se omitido no create — manter aviso na revisão.
