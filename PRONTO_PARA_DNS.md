# ✅ Servidor PRONTO para Vincular DNS no Registro.br

**Data:** 08/01/2026  
**IP do Servidor:** 177.153.64.95  
**Domínio:** blackhouse.app.br

---

## ✅ Status: TUDO CONFIGURADO E FUNCIONANDO

### ✅ O que está configurado:

1. **✅ Aplicação React Buildada**
   - Arquivos em: `/var/www/blackhouse/dist/`
   - Permissões corretas: `www-data:www-data`
   - Todos os assets presentes

2. **✅ Nginx Configurado e Rodando**
   - Servidor web ativo e funcionando
   - Configuração em: `/etc/nginx/sites-available/blackhouse`
   - Site habilitado em: `/etc/nginx/sites-enabled/blackhouse`
   - Escutando na porta 80 (HTTP)
   - Configurado para:
     - `blackhouse.app.br`
     - `www.blackhouse.app.br`
     - `api.blackhouse.app.br`

3. **✅ Servidor Respondendo**
   - HTTP 200 OK em `http://localhost`
   - HTTP 200 OK em `http://177.153.64.95` (IP público)
   - Aplicação carregando corretamente

4. **✅ Certbot Instalado**
   - Pronto para configurar SSL após DNS propagar
   - Versão: 0.40.0

5. **✅ Firewall Configurado**
   - Portas 80 (HTTP) e 443 (HTTPS) permitidas
   - UFW inativo (sem bloqueios)
   - Iptables sem bloqueios

6. **✅ Scripts de Deploy**
   - `verificar-servidor.sh` - Verificação completa
   - `deploy-completo.sh` - Deploy automatizado

---

## 📋 PRÓXIMOS PASSOS - Configure DNS no Registro.br

### ⚠️ IMPORTANTE: O Registro.br NÃO aceita IP diretamente

**Problema comum:** Ao tentar usar servidores DNS da KingHost (`dns1.kinghost.com.br`), aparece erro "Pesquisa recusada".

**Solução:** Use os servidores DNS do próprio Registro.br primeiro, depois configure os registros A.

---

### 1. Configurar Servidores DNS do Registro.br

1. Acesse: https://registro.br
2. Faça login com sua conta
3. Vá em **"Meus Domínios"**
4. Selecione **`blackhouse.app.br`**
5. Procure por **"Servidores DNS"** ou **"Alterar Servidores DNS"**
6. **Clique no botão "UTILIZAR DNS DO REGISTRO.BR"** ou **"USAR DNS DO REGISTRO.BR"**

   Isso vai configurar:
   - `a.auto.dns.br`
   - `b.auto.dns.br`

7. Clique em **"SALVAR ALTERAÇÕES"**
8. Aguarde alguns minutos para a configuração ser aplicada (pode levar até 1 hora)

---

### 2. Configurar Zona DNS (Registros A)

**⚠️ IMPORTANTE:** Só faça isso DEPOIS de configurar os servidores DNS do Registro.br (Passo 1 acima).

1. Ainda na página do domínio `blackhouse.app.br`
2. Clique em **"Gerenciar DNS"** ou **"Zona DNS"** ou **"DNS"**
3. Agora você poderá adicionar os registros **A**:

#### Registro A - Domínio Raiz (@)
```
Tipo: A
Nome: @ (ou deixe em branco/vazio para o domínio raiz)
Valor: 177.153.64.95
TTL: 3600 (ou padrão)
```

#### Registro A - Subdomínio www
```
Tipo: A
Nome: www
Valor: 177.153.64.95
TTL: 3600 (ou padrão)
```

#### Registro A - Subdomínio api
```
Tipo: A
Nome: api
Valor: 177.153.64.95
TTL: 3600 (ou padrão)
```

### 3. Verificar Configuração DNS

Após configurar, aguarde alguns minutos e verifique:

```bash
# Verificar domínio principal
dig blackhouse.app.br +short
# Deve retornar: 177.153.64.95

# Verificar www
dig www.blackhouse.app.br +short
# Deve retornar: 177.153.64.95

# Verificar api
dig api.blackhouse.app.br +short
# Deve retornar: 177.153.64.95
```

**Tempo de propagação:** Normalmente 5-30 minutos, mas pode levar até 48 horas.

---

## 🔒 Configurar SSL (HTTPS) - Após DNS Propagar

Depois que o DNS propagar completamente, configure o SSL:

### Opção 1: Script Automatizado (Recomendado)

```bash
sudo bash /root/deploy-completo.sh
```

Este script irá:
- Verificar DNS
- Configurar SSL automaticamente
- Configurar redirecionamento HTTP → HTTPS
- Testar os endpoints

### Opção 2: Comando Manual

```bash
sudo certbot --nginx \
    -d blackhouse.app.br \
    -d www.blackhouse.app.br \
    -d api.blackhouse.app.br \
    --non-interactive \
    --agree-tos \
    --email admin@blackhouse.app.br \
    --redirect
```

O parâmetro `--redirect` configura redirecionamento automático de HTTP para HTTPS.

---

## 🔍 Verificação Completa do Servidor

Execute o script de verificação a qualquer momento:

```bash
sudo bash /root/verificar-servidor.sh
```

Este script verifica:
- ✅ IP do servidor
- ✅ Status do Nginx
- ✅ Arquivos da aplicação
- ✅ Configuração Nginx
- ✅ Resposta HTTP
- ✅ Status da API
- ✅ Certbot instalado
- ✅ Status DNS
- ✅ Configuração Firewall

---

## 📝 Checklist Final

- [x] ✅ Aplicação buildada e servida
- [x] ✅ Nginx configurado e rodando
- [x] ✅ Servidor respondendo HTTP 200
- [x] ✅ Certbot instalado
- [x] ✅ Firewall configurado (portas 80 e 443)
- [x] ✅ Scripts de deploy criados
- [ ] ⏳ **CONFIGURE DNS NO REGISTRO.BR** ← VOCÊ ESTÁ AQUI
- [ ] ⏳ Aguardar propagação DNS
- [ ] ⏳ Configurar SSL (HTTPS)
- [ ] ⏳ Testar acesso https://blackhouse.app.br

---

## 🌐 URLs Finais (Após Configurar DNS e SSL)

- **Frontend Principal:** https://blackhouse.app.br
- **Frontend www:** https://www.blackhouse.app.br
- **API:** https://api.blackhouse.app.br
- **Health Check API:** https://api.blackhouse.app.br/health

---

## ⚠️ Observações Importantes

### 1. Servidores DNS vs Zona DNS

**IMPORTANTE:** O Registro.br exige duas configurações separadas:

1. **Servidores DNS** (nameservers):
   - Use os servidores DNS do Registro.br (`a.auto.dns.br` e `b.auto.dns.br`)
   - NÃO use servidores DNS da KingHost (`dns1.kinghost.com.br`) - eles darão erro "Pesquisa recusada"
   - Configure PRIMEIRO os servidores DNS

2. **Zona DNS** (registros A):
   - Só funciona DEPOIS de configurar os servidores DNS
   - É aqui que você configura os registros A apontando para o IP 177.153.64.95

### 2. Tempo de Propagação DNS

- **Normal:** 5-30 minutos
- **Máximo:** Até 48 horas (raro)
- **Recomendado:** Aguardar pelo menos 1 hora antes de configurar SSL

### 3. SSL (Certbot)

- Não configure SSL antes do DNS propagar
- O Let's Encrypt precisa conseguir resolver o domínio para validar
- Execute Certbot apenas após confirmar propagação DNS

### 4. Firewall do Provedor

Se você tiver acesso ao painel da **KINGHOST**, verifique se há um firewall adicional que precise permitir as portas 80 e 443.

---

## 🆘 Troubleshooting

### Se o DNS não propagar após 1 hora:

1. Verifique a configuração no Registro.br
2. Certifique-se de que os registros A estão corretos
3. Tente usar servidores DNS diferentes:
   ```bash
   dig blackhouse.app.br @8.8.8.8 +short
   dig blackhouse.app.br @1.1.1.1 +short
   ```

### Se houver erro ao configurar SSL:

1. Verifique se DNS propagou completamente:
   ```bash
   dig blackhouse.app.br +short
   ```
2. Verifique se o servidor está acessível:
   ```bash
   curl -I http://blackhouse.app.br
   ```
3. Verifique logs do Nginx:
   ```bash
   sudo tail -f /var/log/nginx/blackhouse-error.log
   ```

### Se a aplicação não carregar:

1. Verifique se arquivos estão no lugar:
   ```bash
   ls -la /var/www/blackhouse/dist/
   ```
2. Verifique permissões:
   ```bash
   ls -la /var/www/blackhouse/dist/index.html
   ```
3. Recarregue Nginx:
   ```bash
   sudo systemctl reload nginx
   ```

---

## 📞 Informações de Contato do Servidor

- **IP Público:** 177.153.64.95
- **Hostname:** blackhouse-app.vps-kinghost.net
- **Provedor:** KINGHOST

---

**✅ Servidor está 100% pronto para vincular DNS no Registro.br!**

Basta configurar os registros A conforme instruções acima e aguardar a propagação.
