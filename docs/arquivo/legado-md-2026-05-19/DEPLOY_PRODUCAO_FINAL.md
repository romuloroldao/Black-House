# ✅ Deploy para Produção - blackhouse.app.br

**Data**: 13 de Janeiro de 2026  
**Status**: ✅ **DEPLOY CONCLUÍDO**

---

## 🚀 Deploy Realizado

### Arquivos Deployados

1. ✅ `package.json` - Atualizado com `zod@4.3.5`
2. ✅ `schemas/import-schema.js` - Schema canônico rígido
3. ✅ `services/ai.service.js` - Prompt atualizado e logging
4. ✅ `controllers/import.controller.js` - Validação estrita

### Dependências Instaladas

- ✅ `zod@4.3.5` - Validação de schema
- ✅ `express-rate-limit@7.1.5` - Rate limiting
- ✅ `winston@3.11.0` - Structured logging
- ✅ `socket.io@4.7.2` - WebSocket
- ✅ `node-cron@3.0.3` - Background jobs
- ✅ `axios@1.6.2` - HTTP client

---

## ✅ Validações Realizadas

- ✅ Sintaxe do schema válida
- ✅ Sintaxe do controller válida
- ✅ Sintaxe do AI service válida
- ✅ Serviço reiniciado com sucesso
- ✅ Health check local funcionando

---

## 🌐 Endpoints de Teste

### Local (VPS)

```bash
# Health check
curl http://localhost:3001/health

# Parse PDF (requer JWT)
curl -X POST http://localhost:3001/api/import/parse-pdf \
  -H "Authorization: Bearer <token>" \
  -F "pdf=@/caminho/para/ficha.pdf"
```

### Produção (https://blackhouse.app.br)

```bash
# Health check
curl https://blackhouse.app.br/health

# Parse PDF (requer JWT)
curl -X POST https://blackhouse.app.br/api/import/parse-pdf \
  -H "Authorization: Bearer <token>" \
  -F "pdf=@/caminho/para/ficha.pdf"
```

---

## 🧪 Como Testar

### 1. Teste de Health Check

Acesse: https://blackhouse.app.br/health

**Resultado esperado**:
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": ...,
  "environment": "production"
}
```

### 2. Teste de Importação de PDF

1. Acesse o frontend: https://blackhouse.app.br
2. Faça login
3. Vá para a seção de importação de alunos
4. Faça upload de um PDF de ficha
5. Verifique que:
   - PDF é processado
   - Dados são extraídos
   - Schema é validado
   - Dados podem ser revisados
   - Importação funciona

### 3. Teste de Validação de Schema

Se a IA retornar dados inválidos:
- Deve retornar erro 400
- Mensagem clara de erro
- Lista de erros de validação

---

## 📊 Monitoramento

### Ver Logs em Tempo Real

```bash
sudo journalctl -u blackhouse-api -f
```

### Ver Erros de Validação

```bash
sudo journalctl -u blackhouse-api | grep -i "schema\|validação\|validation"
```

### Ver Erros da IA

```bash
sudo journalctl -u blackhouse-api | grep -i "AI\|IA\|openai"
```

---

## ⚠️ Troubleshooting

### Problema: Erro 502 Bad Gateway

**Causa**: Serviço não está rodando ou Nginx não está configurado

**Solução**:
```bash
# Verificar status do serviço
sudo systemctl status blackhouse-api

# Verificar logs
sudo journalctl -u blackhouse-api --since "5 minutes ago"

# Reiniciar se necessário
sudo systemctl restart blackhouse-api
```

### Problema: Erro 401 Unauthorized

**Causa**: Token JWT inválido ou expirado

**Solução**:
1. Fazer login novamente
2. Verificar se token está sendo enviado no header
3. Verificar se JWT_SECRET está configurado corretamente

### Problema: Erro 400 na Importação

**Causa**: Dados da IA não passaram na validação de schema

**Solução**:
1. Verificar logs para ver erros específicos
2. Verificar se PDF contém dados válidos
3. Tentar novamente (pode ser erro temporário da IA)

---

## ✅ Checklist de Teste

- [ ] Health check responde em https://blackhouse.app.br/health
- [ ] Login funciona
- [ ] Upload de PDF funciona
- [ ] Dados são extraídos corretamente
- [ ] Validação de schema funciona (rejeita dados inválidos)
- [ ] Importação completa funciona
- [ ] Aluno e dieta são criados no banco
- [ ] Logs estão sendo gerados corretamente

---

## 📝 Próximos Passos

1. **Testar em produção**: Fazer upload de PDF real
2. **Monitorar logs**: Verificar se há erros
3. **Ajustar se necessário**: Baseado em feedback real
4. **Documentar problemas**: Se encontrar issues

---

## 🎉 Conclusão

**Deploy concluído com sucesso!**

O sistema está pronto para testes em produção:
- ✅ Validação de schema rígida implementada
- ✅ Logging detalhado ativo
- ✅ Remoção completa do Supabase
- ✅ Endpoints protegidos com JWT
- ✅ Rate limiting ativo

**Acesse**: https://blackhouse.app.br e teste a importação de PDFs!

---

**Última atualização**: 13 de Janeiro de 2026 - 10:30
