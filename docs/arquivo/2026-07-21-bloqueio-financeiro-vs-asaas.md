# Diagnóstico: alunos OK no Asaas mas bloqueados no app

Data: 2026-07-21

## Conclusão

Há **dois mecanismos de bloqueio** distintos. Muitos relatos misturam os dois.

| Tipo | Onde | Página aluno |
|------|------|----------------|
| Financeiro | `student_access_state` + `asaas_payments` | `/portal-aluno/blocked` |
| Operacional | `alunos.acesso_operacional` | `/portal-aluno/access-blocked` |

O app **não consulta o Asaas em tempo real** no login: usa a BD local sincronizada.

## Achados na BD (produção)

### Bloqueio operacional com financeiro CURRENT (5)

Financeiro OK; bloqueados porque o coach suspendeu o acesso:

- Danilo Lopes do Carmo (`danilolocarmo@gmail.com`)
- Emili Sousa (`emiliferrsz@gmail.com`)
- Ledigersom Carvalho (`gersoncarvalho64@gmail.com`)
- Tiago Soares (`tiagossoares87@gmail.com`)
- Vinicius Bertolino (`bertolinomotors@gmail.com`)

Acção: no perfil do aluno → reactivar acesso operacional (não é problema Asaas).

### Bloqueio financeiro real (confirmado na API Asaas)

- **Fernando Dourado** — parcela 1/12 vencida em 2026-07-20 (OVERDUE no Asaas).
- **Rubens** — 3 parcelas OVERDUE (mai–jul/2025), sem plano novo.

### Corrigidos automaticamente neste deploy

- **Kayky** — OVERDUE duplicados de parcelas já `RECEIVED` (+1 dia); desbloqueado.
- **Raphael** — OVERDUE de plano antigo (2025) com plano novo `CONFIRMED` (2026); desbloqueado.

## Correcções de código aplicadas

1. `recalculateStudentAccess` passa a calcular a partir de `asaas_payments` (não da cache).
2. Cache stale `granted` + `payment_status=OVERDUE` é revalidada.
3. Excepções (`isento`/`bolsa`/`acordo`) aplicam-se mesmo com cache; CRUD dispara recálculo.
4. Filtro anti-falso-positivo: ignora OVERDUE duplicado ou dívida antiga (>60 dias) com série posterior RECEIVED/CONFIRMED.

Ficheiros: `server/utils/financial-status.js`, `server/financial/access/access-engine.js`, `server/routes/api.js`.
