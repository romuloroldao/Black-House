# 🔥 Guia: Verificar e Configurar Firewall KingHost

**Data**: 12 de Janeiro de 2026  
**Objetivo**: Liberar portas 80 (HTTP) e 443 (HTTPS) no firewall do KingHost

---

## 📋 PASSO A PASSO

### 1. Acessar o Painel KingHost

1. Acesse: https://www.kinghost.com.br
2. Faça login com suas credenciais
3. Vá para **"Meus Produtos"** ou **"Painel de Controle"**

---

### 2. Localizar o Servidor VPS

1. Na lista de produtos, encontre seu VPS
2. Clique no servidor ou em **"Gerenciar"**

---

### 3. Acessar Configurações de Firewall

**Opção A - Se houver menu "Firewall"**:
1. No menu lateral, procure por **"Firewall"** ou **"Segurança"**
2. Clique para abrir as configurações

**Opção B - Se houver menu "Rede"**:
1. Procure por **"Rede"** ou **"Network"**
2. Dentro, procure por **"Firewall"** ou **"Regras de Firewall"**

**Opção C - Se houver menu "Configurações"**:
1. Vá em **"Configurações"** ou **"Settings"**
2. Procure por **"Firewall"**, **"Segurança"** ou **"Security"**

---

### 4. Verificar Regras Existentes

1. Você verá uma lista de regras de firewall
2. Verifique se já existem regras para:
   - Porta 80 (HTTP)
   - Porta 443 (HTTPS)
   - Porta 22 (SSH) - **IMPORTANTE manter esta!**

---

### 5. Adicionar Regras (Se Não Existirem)

#### Regra para HTTP (Porta 80)
1. Clique em **"Adicionar Regra"** ou **"Nova Regra"**
2. Configure:
   - **Protocolo**: TCP
   - **Porta**: 80
   - **Ação**: Permitir / Allow
   - **Direção**: Entrada / Inbound
   - **Descrição**: "HTTP - Acesso Web"
3. Salve a regra

#### Regra para HTTPS (Porta 443)
1. Clique em **"Adicionar Regra"** ou **"Nova Regra"**
2. Configure:
   - **Protocolo**: TCP
   - **Porta**: 443
   - **Ação**: Permitir / Allow
   - **Direção**: Entrada / Inbound
   - **Descrição**: "HTTPS - Acesso Web Seguro"
3. Salve a regra

---

### 6. Verificar Regra SSH (Porta 22)

**⚠️ IMPORTANTE**: Certifique-se de que a porta 22 (SSH) está liberada, caso contrário você pode perder acesso ao servidor!

Se não houver regra para SSH:
1. Adicione regra:
   - **Protocolo**: TCP
   - **Porta**: 22
   - **Ação**: Permitir / Allow
   - **Direção**: Entrada / Inbound
   - **Descrição**: "SSH - Acesso Remoto"

---

### 7. Aplicar/Alterar Configurações

1. Após adicionar as regras, procure por botão:
   - **"Aplicar"**
   - **"Salvar"**
   - **"Atualizar Firewall"**
   - **"Deploy Rules"**
2. Clique para aplicar as mudanças
3. Aguarde confirmação (pode levar 1-5 minutos)

---

### 8. Aguardar Propagação

- Após aplicar as regras, aguarde **2-5 minutos**
- As mudanças podem levar alguns minutos para propagar

---

## 🔍 VERIFICAÇÃO NO SERVIDOR

### Verificar Status do Firewall Local

```bash
# Verificar UFW (se estiver ativo)
sudo ufw status verbose

# Verificar iptables
sudo iptables -L -n -v

# Verificar portas abertas
sudo netstat -tlnp | grep -E ":(80|443)"
```

### Testar Conectividade

```bash
# Testar HTTP
curl -I http://blackhouse.app.br

# Testar HTTPS
curl -I https://blackhouse.app.br

# Testar porta diretamente
nc -zv blackhouse.app.br 443
```

---

## 📊 REGRAS RECOMENDADAS

### Regras Mínimas Necessárias

| Porta | Protocolo | Descrição | Status |
|-------|-----------|-----------|--------|
| 22 | TCP | SSH - Acesso remoto | ✅ Obrigatório |
| 80 | TCP | HTTP - Acesso web | ✅ Necessário |
| 443 | TCP | HTTPS - Acesso web seguro | ✅ Necessário |

### Regras Opcionais (Se Necessário)

| Porta | Protocolo | Descrição |
|-------|-----------|-----------|
| 3001 | TCP | API Node.js (se acesso direto necessário) |
| 5432 | TCP | PostgreSQL (NÃO liberar publicamente!) |

---

## ⚠️ IMPORTANTE

### Segurança

1. **NÃO libere a porta 5432 (PostgreSQL)** publicamente
2. **Mantenha a porta 22 (SSH)** sempre liberada
3. **Use apenas as portas necessárias**
4. **Considere restringir SSH por IP** (se possível)

### Após Configurar

1. Aguarde 2-5 minutos para propagação
2. Teste acessar `https://blackhouse.app.br`
3. Se ainda não funcionar:
   - Limpe cache do navegador
   - Teste de outra rede
   - Verifique logs: `sudo tail -f /var/log/nginx/error.log`

---

## 🔧 ALTERNATIVA: Configurar Firewall no Servidor (UFW)

**⚠️ Só faça isso APÓS liberar no painel KingHost!**

Se o KingHost não tiver firewall próprio ou você quiser uma camada extra:

```bash
# Permitir SSH (IMPORTANTE!)
sudo ufw allow 22/tcp

# Permitir HTTP
sudo ufw allow 80/tcp

# Permitir HTTPS
sudo ufw allow 443/tcp

# Verificar regras
sudo ufw status verbose

# Ativar firewall
sudo ufw enable

# Verificar status
sudo ufw status
```

---

## 📞 SUPORTE

Se não encontrar as opções de firewall no painel:

1. **Contatar Suporte KingHost**:
   - Email: suporte@kinghost.com.br
   - Telefone: Verificar no site
   - Chat: Disponível no painel

2. **Informações para fornecer**:
   - IP do servidor: `177.153.64.95`
   - Portas necessárias: 80, 443
   - Problema: Timeout ao acessar HTTPS

---

## ✅ CHECKLIST

- [ ] Acessei o painel KingHost
- [ ] Localizei o servidor VPS
- [ ] Encontrei configurações de Firewall
- [ ] Verifiquei regras existentes
- [ ] Adicionei regra para porta 80 (HTTP)
- [ ] Adicionei regra para porta 443 (HTTPS)
- [ ] Verifiquei que porta 22 (SSH) está liberada
- [ ] Apliquei/Salvei as configurações
- [ ] Aguardei 2-5 minutos
- [ ] Testei acesso a `https://blackhouse.app.br`

---

## 📊 STATUS ATUAL DO SERVIDOR

### Firewall Local (UFW)
```
Status: inactive
```

### Portas Escutando
```
Porta 80: ✅ Escutando (0.0.0.0:80)
Porta 443: ✅ Escutando (0.0.0.0:443)
```

### Conclusão
O servidor está configurado corretamente. O problema é provavelmente o firewall do KingHost bloqueando conexões externas.

---

**Última atualização**: 12 de Janeiro de 2026
