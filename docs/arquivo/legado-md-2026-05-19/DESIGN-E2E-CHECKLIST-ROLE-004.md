# DESIGN-E2E-CHECKLIST-ROLE-004

**Version:** 1.0.0  
**Status:** ✅ READY FOR TESTING  
**Objective:** Garantir funcionamento completo por role sem erros de console

## Checklist E2E - Fluxo Aluno

### Pré-requisitos
- [ ] Usuário com `role='aluno'` criado no banco
- [ ] Aluno vinculado ao usuário (`alunos.user_id = users.id`)
- [ ] Coach vinculado ao aluno (`alunos.coach_id = users.id` onde role='coach')

### Testes de Login e Identidade

- [ ] **Login como aluno**
  - [ ] POST `/auth/login` com credenciais de aluno
  - [ ] Response contém `user`, `token`, `role='aluno'`
  - [ ] Token é salvo no localStorage
  - [ ] Console: Nenhum erro

- [ ] **GET /api/alunos/me resolve aluno canônico**
  - [ ] Request: `GET /api/alunos/me` com token de aluno
  - [ ] Response: `200 OK` com dados do aluno
  - [ ] `req.aluno` está presente no backend
  - [ ] Console: Nenhum erro

### Testes de Mensageria

- [ ] **Mensageria carrega sem 403**
  - [ ] Abrir tela de mensagens/chat
  - [ ] `GET /api/mensagens` é chamado
  - [ ] Response: `200 OK` com lista de mensagens (pode estar vazia)
  - [ ] Console: Nenhum erro `403 ROLE_FORBIDDEN`
  - [ ] Console: Nenhum erro `ALUNO_NOT_FOUND`

- [ ] **Enviar mensagem**
  - [ ] POST `/api/mensagens` com `conteudo`
  - [ ] Response: `201 Created` com mensagem criada
  - [ ] Mensagem aparece na lista
  - [ ] Console: Nenhum erro

- [ ] **Polling de mensagens**
  - [ ] Polling ativo a cada 10 segundos (apenas se `role='aluno'`)
  - [ ] `GET /api/mensagens` é chamado periodicamente
  - [ ] Console: Nenhum erro durante polling
  - [ ] Polling para quando componente desmonta

### Testes de Notificações

- [ ] **Notificações funcionam**
  - [ ] `GET /api/notificacoes` é chamado
  - [ ] Response: `200 OK` com lista de notificações
  - [ ] Notificações aparecem no popover/badge
  - [ ] Console: Nenhum erro `403 ROLE_FORBIDDEN`

- [ ] **Polling de notificações**
  - [ ] Polling ativo a cada 10 segundos (apenas se `role='aluno'`)
  - [ ] `GET /api/notificacoes` é chamado periodicamente
  - [ ] Console: Nenhum erro durante polling

### Testes de Check-in

- [ ] **Check-in criado com sucesso**
  - [ ] Preencher formulário de check-in semanal
  - [ ] POST `/api/checkins` com dados do check-in
  - [ ] Response: `201 Created` com check-in criado
  - [ ] `aluno_id` é resolvido automaticamente pelo backend
  - [ ] Console: Nenhum erro `ALUNO_NOT_FOUND`
  - [ ] Console: Nenhum erro `403 ROLE_FORBIDDEN`

### Testes de Console

- [ ] **Console limpo após 5 minutos**
  - [ ] Navegar por todas as telas do aluno
  - [ ] Aguardar 5 minutos
  - [ ] Console: Zero erros
  - [ ] Console: Nenhum warning de deprecação (exceto `.from()` em componentes não críticos)
  - [ ] Network: Nenhuma chamada para `/rest/v1/*` (exceto scripts)
  - [ ] Network: Nenhuma chamada para `/api/mensagens` com role='coach'

## Checklist E2E - Fluxo Coach

### Pré-requisitos
- [ ] Usuário com `role='coach'` criado no banco
- [ ] Pelo menos um aluno vinculado ao coach (`alunos.coach_id = users.id`)

### Testes de Login e Identidade

- [ ] **Login como coach**
  - [ ] POST `/auth/login` com credenciais de coach
  - [ ] Response contém `user`, `token`, `role='coach'`
  - [ ] Token é salvo no localStorage
  - [ ] Console: Nenhum erro

### Testes de Dashboard

- [ ] **Dashboard carrega sem polling**
  - [ ] Abrir dashboard do coach
  - [ ] `GET /api/alunos/by-coach` é chamado
  - [ ] Response: `200 OK` com lista de alunos
  - [ ] Dashboard exibe estatísticas
  - [ ] Console: Nenhum erro
  - [ ] **CRÍTICO:** Nenhum polling ativo (verificar `setInterval` no código)

- [ ] **Nenhuma chamada a /api/mensagens**
  - [ ] Navegar pelo dashboard
  - [ ] Network: Nenhuma chamada para `GET /api/mensagens`
  - [ ] Network: Nenhuma chamada para `POST /api/mensagens`
  - [ ] Console: Nenhum erro relacionado a mensagens

- [ ] **Nenhuma chamada a /api/notificacoes**
  - [ ] Navegar pelo dashboard
  - [ ] Network: Nenhuma chamada para `GET /api/notificacoes` (exceto se houver endpoint específico para coach)
  - [ ] Console: Nenhum erro relacionado a notificações

### Testes de Linkagem

- [ ] **Linkagem via POST /api/alunos/link-user**
  - [ ] Abrir tela de linkagem de alunos
  - [ ] Selecionar aluno importado e usuário para vincular
  - [ ] POST `/api/alunos/link-user` com `importedAlunoId` e `userIdToLink`
  - [ ] Response: `200 OK` com aluno vinculado
  - [ ] Console: Nenhum erro `400 Bad Request`
  - [ ] Console: Nenhum erro `403 FORBIDDEN`

### Testes de Console

- [ ] **Console limpo durante navegação**
  - [ ] Navegar por todas as telas do coach
  - [ ] Aguardar 2 minutos
  - [ ] Console: Zero erros
  - [ ] Console: Nenhum warning de deprecação (exceto `.from()` em componentes não críticos)
  - [ ] Network: Nenhuma chamada para `/api/mensagens`
  - [ ] Network: Nenhuma chamada para `/api/notificacoes` (exceto se houver endpoint específico)
  - [ ] Network: Nenhuma chamada para `/api/checkins`

## Testes Negativos

### Coach tentando acessar rota de aluno

- [ ] **GET /api/mensagens como coach**
  - [ ] Request: `GET /api/mensagens` com token de coach
  - [ ] Response: `403 Forbidden`
  - [ ] Body: `{ "error": "Acesso negado", "error_code": "ROLE_FORBIDDEN" }`
  - [ ] Console: Nenhum erro inesperado

- [ ] **POST /api/mensagens como coach**
  - [ ] Request: `POST /api/mensagens` com token de coach
  - [ ] Response: `403 Forbidden`
  - [ ] Body: `{ "error": "Acesso negado", "error_code": "ROLE_FORBIDDEN" }`
  - [ ] Console: Nenhum erro inesperado

- [ ] **GET /api/notificacoes como coach**
  - [ ] Request: `GET /api/notificacoes` com token de coach
  - [ ] Response: `403 Forbidden`
  - [ ] Body: `{ "error": "Acesso negado", "error_code": "ROLE_FORBIDDEN" }`
  - [ ] Console: Nenhum erro inesperado

- [ ] **POST /api/checkins como coach**
  - [ ] Request: `POST /api/checkins` com token de coach
  - [ ] Response: `403 Forbidden`
  - [ ] Body: `{ "error": "Acesso negado", "error_code": "ROLE_FORBIDDEN" }`
  - [ ] Console: Nenhum erro inesperado

- [ ] **GET /api/alunos/me como coach**
  - [ ] Request: `GET /api/alunos/me` com token de coach
  - [ ] Response: `403 Forbidden`
  - [ ] Body: `{ "error": "Acesso negado", "error_code": "ROLE_FORBIDDEN" }`
  - [ ] Console: Nenhum erro inesperado

### Aluno tentando acessar rota de coach

- [ ] **POST /api/alunos/link-user como aluno**
  - [ ] Request: `POST /api/alunos/link-user` com token de aluno
  - [ ] Response: `403 Forbidden`
  - [ ] Body: `{ "error": "Acesso negado", "error_code": "ROLE_FORBIDDEN" }`
  - [ ] Console: Nenhum erro inesperado

- [ ] **GET /api/alunos/by-coach como aluno**
  - [ ] Request: `GET /api/alunos/by-coach` com token de aluno
  - [ ] Response: `403 Forbidden`
  - [ ] Body: `{ "error": "Acesso negado", "error_code": "ROLE_FORBIDDEN" }`
  - [ ] Console: Nenhum erro inesperado

## Critérios de Aceitação

### Zero erros no console
- [ ] Nenhum erro `403 ROLE_FORBIDDEN` em rotas corretas
- [ ] Nenhum erro `ALUNO_NOT_FOUND` após login
- [ ] Nenhum erro `COACH_NOT_FOUND` após login
- [ ] Nenhum erro de CORS
- [ ] Nenhum erro de rede (exceto 403 em testes negativos)

### Nenhum polling indevido
- [ ] Coach não tem polling de mensagens
- [ ] Coach não tem polling de notificações (exceto se houver endpoint específico)
- [ ] Aluno tem polling apenas de mensagens e notificações
- [ ] Polling para quando componente desmonta

### Nenhum erro intermitente
- [ ] Erros não aparecem e desaparecem
- [ ] Erros são consistentes e reproduzíveis
- [ ] Logs no backend são claros sobre causa do erro

## Comandos de Teste Manual

### Teste 1: Login como Aluno
```bash
curl -X POST https://api.blackhouse.app.br/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "aluno@example.com", "password": "senha123"}'
```

### Teste 2: GET /api/alunos/me (Aluno)
```bash
curl -X GET https://api.blackhouse.app.br/api/alunos/me \
  -H "Authorization: Bearer <token_aluno>"
```

### Teste 3: GET /api/mensagens (Aluno)
```bash
curl -X GET https://api.blackhouse.app.br/api/mensagens \
  -H "Authorization: Bearer <token_aluno>"
```

### Teste 4: GET /api/mensagens (Coach) - Deve falhar
```bash
curl -X GET https://api.blackhouse.app.br/api/mensagens \
  -H "Authorization: Bearer <token_coach>"
# Esperado: 403 ROLE_FORBIDDEN
```

### Teste 5: GET /api/alunos/by-coach (Coach)
```bash
curl -X GET https://api.blackhouse.app.br/api/alunos/by-coach \
  -H "Authorization: Bearer <token_coach>"
```

### Teste 6: GET /api/alunos/by-coach (Aluno) - Deve falhar
```bash
curl -X GET https://api.blackhouse.app.br/api/alunos/by-coach \
  -H "Authorization: Bearer <token_aluno>"
# Esperado: 403 ROLE_FORBIDDEN
```

## Checklist de Verificação de Código

### Frontend
- [ ] `StudentSidebar.tsx` - Polling apenas se `role === 'aluno'`
- [ ] `Sidebar.tsx` - Sem polling de notificações para coaches
- [ ] `Dashboard.tsx` - Sem chamadas a `/api/mensagens`
- [ ] `MessagesPopover.tsx` - Polling apenas se `role === 'aluno'`
- [ ] `NotificationsPopover.tsx` - Polling apenas se `role === 'aluno'`
- [ ] `StudentChatView.tsx` - Verificação de role antes de carregar

### Backend
- [ ] `routes/api.js` - Todas as rotas `alunoOnly` têm `validateRole(['aluno'])`
- [ ] `routes/api.js` - Todas as rotas `coachOnly` têm `validateRole(['coach'])`
- [ ] `middleware/resolveAlunoOrFail.js` - Valida role antes de processar
- [ ] `middleware/resolveCoachOrFail.js` - Valida role antes de processar
- [ ] `middleware/validateRole.js` - Funciona corretamente

## Status de Implementação

### ✅ Implementado
- Middleware `validateRole` criado
- Rotas protegidas com `validateRole`
- Polling condicionado por role no frontend
- Validação de role nos middlewares de resolução

### ⚠️ Requer Teste
- Fluxo completo de aluno
- Fluxo completo de coach
- Testes negativos de acesso indevido
- Verificação de console limpo

### 📝 Próximos Passos
1. Executar checklist E2E completo
2. Documentar resultados
3. Corrigir problemas encontrados
4. Re-executar testes até 100% de sucesso
