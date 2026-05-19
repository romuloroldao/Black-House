# 🔧 Ajustes Necessários Após Configuração DNS no Registro.br

**Data**: 12 de Janeiro de 2026  
**Status DNS**: ✅ **Propagado e funcionando** (`blackhouse.app.br`, `www.blackhouse.app.br`, `api.blackhouse.app.br` → `177.153.64.95`)

---

## ✅ O QUE JÁ ESTÁ FUNCIONANDO

### DNS
- ✅ **blackhouse.app.br** → `177.153.64.95` ✅
- ✅ **www.blackhouse.app.br** → `177.153.64.95` ✅
- ✅ **api.blackhouse.app.br** → `177.153.64.95` ✅

### Nginx
- ✅ Configurado corretamente com os 3 domínios
- ✅ Frontend servindo em `blackhouse.app.br` (HTTP 200 OK)
- ✅ API proxy configurado para `api.blackhouse.app.br`
- ✅ Porta 80 aberta e escutando

### Servidor
- ✅ API rodando na porta 3001
- ✅ Nginx ativo e funcionando
- ✅ Traceroute confirma conectividade ao servidor

---

## 🔧 AJUSTES NECESSÁRIOS

### 1. Atualizar CORS na API (IMPORTANTE)

**Problema**: O CORS está configurado apenas para `FRONTEND_URL` (atualmente HTTP).  
**Solução**: Atualizar para aceitar os domínios corretos.

**Arquivo**: `/var/www/blackhouse/server/index.js`

**Ação**:
```javascript
// ANTES:
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));

// DEPOIS:
app.use(cors({ 
    origin: [
        'http://blackhouse.app.br',
        'https://blackhouse.app.br',
        'http://www.blackhouse.app.br',
        'https://www.blackhouse.app.br',
        process.env.FRONTEND_URL
    ].filter(Boolean),
    credentials: true 
}));
```

**Ou usar variável de ambiente**:
```javascript
const allowedOrigins = [
    'http://blackhouse.app.br',
    'https://blackhouse.app.br',
    'http://www.blackhouse.app.br',
    'https://www.blackhouse.app.br',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
```

---

### 2. Atualizar Variáveis de Ambiente

**Arquivo**: `/var/www/blackhouse/server/.env`

**Atualizar**:
```bash
# ANTES:
FRONTEND_URL=http://blackhouse.app.br

# DEPOIS (após configurar SSL):
FRONTEND_URL=https://blackhouse.app.br
```

**Por enquanto, manter HTTP** até configurar SSL.

---

### 3. Verificar e Ajustar Firewall (SEGURANÇA)

**Status atual**: Firewall inativo (`ufw status: inactive`)

**Ações**:
```bash
# Verificar se há firewall do provedor (KingHost pode ter firewall próprio)
# Se usar UFW, configurar:

sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS (após SSL)
sudo ufw enable
sudo ufw status
```

**⚠️ IMPORTANTE**: Verifique se o KingHost tem firewall próprio antes de ativar o UFW.

---

### 4. Configurar SSL com Certbot (PRÓXIMO PASSO)

**Pré-requisitos**:
- ✅ DNS propagado (já está)
- ✅ Porta 80 acessível (já está)
- ✅ Nginx configurado (já está)

**Comandos**:
```bash
# 1. Instalar Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# 2. Configurar SSL para os 3 domínios
sudo certbot --nginx -d blackhouse.app.br -d www.blackhouse.app.br -d api.blackhouse.app.br

# 3. Verificar certificados
sudo certbot certificates

# 4. Testar renovação automática
sudo certbot renew --dry-run
```

**Após SSL**:
- Atualizar `FRONTEND_URL` para HTTPS
- O Certbot já atualiza o Nginx automaticamente para redirecionar HTTP → HTTPS

---

### 5. Atualizar Variáveis de Ambiente do Frontend

**Arquivo**: `/root/.env.production`

**Verificar se está correto**:
```bash
VITE_API_URL=https://api.blackhouse.app.br
```

**Após configurar SSL**, fazer novo build:
```bash
cd /root
npm run build
sudo cp -r dist/* /var/www/blackhouse/dist/
```

---

### 6. Testar Conectividade Completa

**Testes a fazer**:
```bash
# 1. Testar DNS
dig +short blackhouse.app.br A
dig +short www.blackhouse.app.br A
dig +short api.blackhouse.app.br A

# 2. Testar Frontend
curl -I http://blackhouse.app.br
curl -I http://www.blackhouse.app.br

# 3. Testar API
curl -I http://api.blackhouse.app.br/health
curl http://api.blackhouse.app.br/health

# 4. Testar de fora (usar outro servidor ou ferramenta online)
# https://www.whatsmydns.net/#A/blackhouse.app.br
```

---

## 📋 CHECKLIST DE AJUSTES

### Imediato (Agora)
- [ ] Atualizar CORS na API para aceitar os domínios
- [ ] Reiniciar API: `sudo systemctl restart blackhouse-api`
- [ ] Testar acesso externo aos domínios
- [ ] Verificar logs do Nginx: `sudo tail -f /var/log/nginx/blackhouse-error.log`

### Próximo (Hoje)
- [ ] Configurar SSL com Certbot
- [ ] Atualizar variáveis de ambiente para HTTPS
- [ ] Fazer novo build do frontend
- [ ] Testar HTTPS

### Segurança (Esta Semana)
- [ ] Configurar firewall (verificar firewall do KingHost primeiro)
- [ ] Alterar credenciais (PostgreSQL + JWT_SECRET)
- [ ] Configurar rotação de logs
- [ ] Configurar monitoramento

---

## 🔍 VERIFICAÇÕES ATUAIS

### Status DNS
```bash
$ dig +short blackhouse.app.br A
177.153.64.95 ✅

$ dig +short www.blackhouse.app.br A
177.153.64.95 ✅

$ dig +short api.blackhouse.app.br A
177.153.64.95 ✅
```

### Status Servidor
```bash
$ curl -I http://blackhouse.app.br
HTTP/1.1 200 OK ✅

$ curl -I http://api.blackhouse.app.br/health
HTTP/1.1 200 OK ✅ (após ajustes)
```

### Portas Abertas
```bash
Porta 80: ✅ Aberta (Nginx)
Porta 443: ⏳ Aguardando SSL
Porta 3001: ✅ Aberta (API Node.js)
```

---

## 🚀 COMANDOS RÁPIDOS

### Verificar Status
```bash
# DNS
dig +short blackhouse.app.br A

# Nginx
sudo systemctl status nginx
sudo nginx -t

# API
sudo systemctl status blackhouse-api
curl http://localhost:3001/health

# Logs
sudo tail -f /var/log/nginx/blackhouse-error.log
sudo journalctl -u blackhouse-api -f
```

### Reiniciar Serviços
```bash
# Nginx
sudo systemctl restart nginx
sudo nginx -t

# API
sudo systemctl restart blackhouse-api
sudo systemctl status blackhouse-api
```

---

## ⚠️ PROBLEMAS COMUNS E SOLUÇÕES

### Problema: DNS não resolve
**Solução**: Aguardar propagação (pode levar até 48h, geralmente 1-2h)

### Problema: Nginx retorna 502 Bad Gateway
**Solução**: 
```bash
# Verificar se API está rodando
sudo systemctl status blackhouse-api
curl http://localhost:3001/health

# Verificar logs
sudo journalctl -u blackhouse-api -n 50
```

### Problema: CORS bloqueando requisições
**Solução**: Atualizar CORS na API (ver item 1 acima)

### Problema: Certbot falha na verificação
**Solução**: 
- Verificar se DNS está propagado: `dig +short blackhouse.app.br`
- Verificar se porta 80 está acessível externamente
- Verificar se Nginx está rodando: `sudo systemctl status nginx`

---

## 📊 RESUMO

### ✅ Já Funcionando
- DNS propagado
- Nginx configurado
- Servidor acessível
- Frontend servindo
- API rodando

### 🔧 Ajustes Necessários
1. **CORS** na API (aceitar domínios corretos)
2. **SSL** com Certbot (próximo passo)
3. **Variáveis de ambiente** (atualizar para HTTPS após SSL)
4. **Firewall** (configurar se necessário)

### 🎯 Próximo Passo
**Configurar SSL com Certbot** - DNS já está funcionando, pode configurar agora!

---

**Última atualização**: 12 de Janeiro de 2026
