# 📋 Status do Deploy - blackhouse.app.br

## ✅ O que JÁ está configurado:

1. ✅ **Aplicação buildada** - Arquivos em `/var/www/blackhouse/dist/`
2. ✅ **Nginx configurado** - Servidor web ativo e respondendo
3. ✅ **Configuração Nginx** - Arquivo em `/etc/nginx/sites-available/blackhouse`
4. ✅ **Certbot instalado** - Pronto para configurar SSL
5. ✅ **API Client configurado** - Usa `https://api.blackhouse.app.br`
6. ✅ **Servidor respondendo** - HTTP 200 OK no IP 177.153.64.95

## ❌ O que ESTÁ FALTANDO:

### 1. **Configurar DNS no Registro.br** 🔴 CRÍTICO

O domínio `blackhouse.app.br` **NÃO está apontando** para o IP do servidor.

**IP do servidor:** `177.153.64.95`

**Como configurar no Registro.br:**

1. Acesse: https://registro.br
2. Faça login
3. Vá em **"Meus Domínios"**
4. Selecione **blackhouse.app.br**
5. Clique em **"Gerenciar DNS"** ou **"Zona DNS"**
6. Configure os seguintes registros:

```
Tipo: A
Nome: @ (ou deixe em branco para o domínio raiz)
Valor: 177.153.64.95
TTL: 3600

Tipo: A
Nome: www
Valor: 177.153.64.95
TTL: 3600

Tipo: A
Nome: api
Valor: 177.153.64.95
TTL: 3600
```

**⚠️ IMPORTANTE:** 
- Você está usando o provedor **KINGHOST** como "Provedor de serviços" no Registro.br
- Isso **NÃO altera** os servidores DNS automaticamente
- Você precisa configurar os registros A manualmente na **Zona DNS**

### 2. **Aguardar propagação DNS** ⏰

Após configurar o DNS, aguarde a propagação (5-30 minutos, até 48 horas em casos raros).

**Verificar propagação:**
```bash
dig blackhouse.app.br +short
# Deve retornar: 177.153.64.95

dig www.blackhouse.app.br +short
# Deve retornar: 177.153.64.95

dig api.blackhouse.app.br +short
# Deve retornar: 177.153.64.95
```

### 3. **Configurar SSL (HTTPS)** 🔒

Após o DNS propagar, configure o SSL com Certbot:

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

**Ou execute o script completo:**
```bash
sudo bash /root/deploy-completo.sh
```

## 🚀 Checklist Final:

- [ ] Configurar registros A no Registro.br (Zona DNS)
- [ ] Aguardar propagação DNS (verificar com `dig`)
- [ ] Configurar SSL com Certbot
- [ ] Testar acesso: https://blackhouse.app.br
- [ ] Testar acesso: https://www.blackhouse.app.br
- [ ] Testar API: https://api.blackhouse.app.br/health

## 📝 Notas:

- A aplicação já está buildada e servida pelo Nginx
- O Nginx está configurado e funcionando corretamente
- O Certbot está instalado e pronto para uso
- A única coisa faltando é o DNS apontar para o IP correto

## 🔍 Verificações atuais:

**DNS Status:**
```bash
$ dig blackhouse.app.br +short
# (vazio - DNS não configurado)
```

**Nginx Status:**
```bash
$ curl -I http://177.153.64.95
HTTP/1.1 200 OK ✅
```

**Aplicação:**
```bash
$ ls -la /var/www/blackhouse/dist/
# Arquivos presentes ✅
```

---

**Última atualização:** 08/01/2026
