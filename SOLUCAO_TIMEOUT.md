# 🔧 Solução para ERR_CONNECTION_TIMED_OUT

**Data**: 12 de Janeiro de 2026  
**Problema**: Timeout ao acessar `https://blackhouse.app.br` do navegador

---

## ✅ DIAGNÓSTICO REALIZADO

### Status do Servidor
- ✅ Nginx rodando corretamente
- ✅ Porta 443 escutando (0.0.0.0:443)
- ✅ SSL configurado e funcionando
- ✅ Certificados válidos
- ✅ curl do servidor funciona
- ✅ Porta 443 acessível do servidor

### Possíveis Causas
1. **Firewall do KingHost** bloqueando conexões de certas origens
2. **Propagação DNS** ainda em andamento em algumas regiões
3. **Cache do navegador** com configurações antigas
4. **Problema de rede** temporário

---

## 🔧 SOLUÇÕES

### 1. Verificar Firewall do KingHost (PRIMEIRO)

**Acessar painel KingHost**:
1. Login no painel KingHost
2. Ir em **VPS** → Seu servidor
3. Procurar por **Firewall** ou **Segurança**
4. Verificar se portas 80 e 443 estão liberadas
5. Se não estiverem, adicionar regras:
   - Porta 80 (TCP) - HTTP
   - Porta 443 (TCP) - HTTPS
6. Salvar e aguardar 2-5 minutos

---

### 2. Limpar Cache do Navegador

**No Chrome**:
1. Pressionar `Ctrl + Shift + Delete` (Windows/Linux) ou `Cmd + Shift + Delete` (Mac)
2. Selecionar "Imagens e arquivos em cache"
3. Período: "Última hora" ou "Todo o período"
4. Clicar em "Limpar dados"
5. Tentar acessar novamente

**Ou usar modo anônimo**:
- `Ctrl + Shift + N` (Chrome)
- Testar se funciona em modo anônimo

---

### 3. Verificar DNS Local

**No Windows**:
```cmd
ipconfig /flushdns
```

**No Linux/Mac**:
```bash
sudo systemd-resolve --flush-caches
# ou
sudo dscacheutil -flushcache
```

**Testar DNS**:
```bash
nslookup blackhouse.app.br
# Deve retornar: 177.153.64.95
```

---

### 4. Testar de Outra Rede

- Testar de outro dispositivo
- Testar de outra rede (dados móveis, outro Wi-Fi)
- Usar ferramenta online: https://www.yougetsignal.com/tools/open-ports/

---

### 5. Verificar se Funciona via IP Direto

**No navegador, tentar**:
```
https://177.153.64.95
```

**⚠️ AVISO**: Vai dar erro de certificado SSL (esperado, pois o certificado é para `blackhouse.app.br`), mas se conectar, confirma que o servidor está funcionando.

---

### 6. Verificar Firewall Local (UFW)

**Se necessário ativar** (após liberar no KingHost):
```bash
sudo ufw allow 22/tcp    # SSH (IMPORTANTE!)
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status verbose
```

**⚠️ IMPORTANTE**: Não ative o UFW antes de liberar no painel do KingHost!

---

## 📋 CHECKLIST DE SOLUÇÃO

### Passo 1: Verificar KingHost
- [ ] Acessar painel KingHost
- [ ] Verificar configurações de Firewall
- [ ] Liberar portas 80 e 443
- [ ] Aguardar 2-5 minutos

### Passo 2: Limpar Cache
- [ ] Limpar cache do navegador
- [ ] Tentar em modo anônimo
- [ ] Flush DNS local

### Passo 3: Testar
- [ ] Testar de outra rede
- [ ] Testar via IP direto
- [ ] Verificar logs do Nginx

---

## 🔍 COMANDOS DE VERIFICAÇÃO

### No Servidor
```bash
# Verificar se Nginx está rodando
sudo systemctl status nginx

# Verificar portas
sudo netstat -tlnp | grep -E ":(80|443)"

# Verificar SSL
curl -I https://blackhouse.app.br

# Ver logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/blackhouse-access.log
```

### No Cliente (Sua Máquina)
```bash
# Testar conectividade
curl -I https://blackhouse.app.br

# Verificar DNS
nslookup blackhouse.app.br
dig blackhouse.app.br

# Testar porta
telnet blackhouse.app.br 443
# ou
nc -zv blackhouse.app.br 443
```

---

## ⚠️ OBSERVAÇÕES IMPORTANTES

1. **Firewall KingHost**: Muitos provedores VPS têm firewall próprio que precisa ser configurado no painel, não apenas no servidor.

2. **Propagação**: Após liberar portas no firewall, pode levar alguns minutos para propagar.

3. **Cache**: Navegadores e ISPs podem cachear respostas de erro. Limpar cache ajuda.

4. **Rede**: Se funcionar do servidor mas não do seu navegador, pode ser problema de rede/firewall do seu provedor.

---

## 📞 PRÓXIMOS PASSOS

1. **PRIMEIRO**: Verificar e liberar portas no painel KingHost
2. **SEGUNDO**: Limpar cache do navegador e tentar novamente
3. **TERCEIRO**: Testar de outra rede/dispositivo
4. **SE PERSISTIR**: Contatar suporte KingHost com os detalhes do diagnóstico

---

## ✅ STATUS ATUAL

| Item | Status |
|------|--------|
| Servidor | ✅ Funcionando |
| Nginx | ✅ Rodando |
| SSL | ✅ Configurado |
| Porta 443 | ✅ Escutando |
| Conectividade Local | ✅ Funcionando |
| Conectividade Externa | ⚠️ Verificar firewall KingHost |

---

**Última atualização**: 12 de Janeiro de 2026
