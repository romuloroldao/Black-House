# 🔍 Diagnóstico: ERR_CONNECTION_TIMED_OUT

**Data**: 12 de Janeiro de 2026  
**Problema**: Timeout ao acessar `https://blackhouse.app.br` externamente

---

## ✅ VERIFICAÇÕES REALIZADAS

### Servidor Local
- ✅ Nginx rodando (active/running)
- ✅ Porta 80 escutando (0.0.0.0:80)
- ✅ Porta 443 escutando (0.0.0.0:443)
- ✅ SSL configurado corretamente
- ✅ Certificados válidos
- ✅ Configuração Nginx válida
- ✅ curl local funciona (HTTP 200)

### Problema Identificado
- ❌ **Timeout ao acessar externamente**
- ⚠️ Provável causa: **Firewall do provedor (KingHost) bloqueando portas 80/443**

---

## 🔧 SOLUÇÕES POSSÍVEIS

### 1. Verificar Firewall do KingHost (MAIS PROVÁVEL)

O KingHost geralmente tem um firewall próprio no painel de controle que precisa ser configurado.

**Ações necessárias**:
1. Acessar o painel do KingHost
2. Ir em "Firewall" ou "Segurança"
3. Liberar portas 80 (HTTP) e 443 (HTTPS)
4. Salvar e aguardar alguns minutos

**Localização no painel**:
- Painel KingHost → VPS → Firewall/Segurança
- Adicionar regras para portas 80 e 443

---

### 2. Verificar Firewall do Sistema (UFW)

**Status atual**: UFW inativo

Se quiser ativar (após liberar no KingHost):
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

**⚠️ IMPORTANTE**: Não ative o UFW antes de liberar no painel do KingHost, ou você pode perder acesso SSH.

---

### 3. Verificar Conectividade Externa

**Teste de conectividade**:
```bash
# De outro servidor ou máquina externa
curl -I https://blackhouse.app.br
curl -I http://blackhouse.app.br

# Ou usar ferramenta online
# https://www.yougetsignal.com/tools/open-ports/
```

---

### 4. Verificar DNS

**Status DNS**:
```bash
$ dig +short blackhouse.app.br A
177.153.64.95 ✅
```

DNS está correto. O problema é de conectividade de rede/firewall.

---

## 📋 CHECKLIST DE DIAGNÓSTICO

### ✅ Funcionando Localmente
- [x] Nginx rodando
- [x] Portas 80 e 443 abertas localmente
- [x] SSL configurado
- [x] Certificados válidos
- [x] curl local funciona

### ❌ Problema Externo
- [ ] Firewall do KingHost bloqueando portas
- [ ] Conectividade de rede
- [ ] Propagação de configurações

---

## 🎯 AÇÃO RECOMENDADA

### Passo 1: Liberar Portas no Painel KingHost
1. Acessar painel do KingHost
2. Navegar até configurações de Firewall/Segurança
3. Adicionar regras:
   - Porta 80 (TCP) - HTTP
   - Porta 443 (TCP) - HTTPS
4. Salvar e aguardar 2-5 minutos

### Passo 2: Testar Conectividade
```bash
# Após liberar no painel, testar de fora
curl -I https://blackhouse.app.br
```

### Passo 3: Se ainda não funcionar
- Verificar logs do Nginx: `sudo tail -f /var/log/nginx/error.log`
- Verificar se há outros firewalls
- Contatar suporte KingHost se necessário

---

## 📊 STATUS ATUAL

| Componente | Status |
|------------|--------|
| Nginx | ✅ Rodando |
| Porta 80 | ✅ Escutando localmente |
| Porta 443 | ✅ Escutando localmente |
| SSL | ✅ Configurado |
| DNS | ✅ Resolvendo corretamente |
| Firewall Local (UFW) | ⚠️ Inativo |
| Firewall KingHost | ❓ **VERIFICAR NO PAINEL** |
| Conectividade Externa | ❌ Timeout |

---

## ⚠️ CONCLUSÃO

**Causa mais provável**: Firewall do KingHost bloqueando portas 80 e 443.

**Solução**: Liberar portas 80 e 443 no painel de controle do KingHost.

**Próximo passo**: Acessar painel KingHost e configurar firewall.

---

**Última atualização**: 12 de Janeiro de 2026
