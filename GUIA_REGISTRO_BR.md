# 🌐 Guia de Configuração do Domínio no Registro.br

Este guia mostra como vincular o domínio **blackhouse.app.br** à sua VPS.

## 📋 Informações Necessárias

Antes de começar, você precisa saber:
- **IP da sua VPS**: Execute `curl ifconfig.me` no servidor para descobrir
- **Domínio**: blackhouse.app.br
- **Subdomínios necessários**:
  - `blackhouse.app.br` (frontend)
  - `www.blackhouse.app.br` (redireciona para blackhouse.app.br)
  - `api.blackhouse.app.br` (API)

## 🔧 Passo a Passo no Registro.br

### 1. Acessar o Painel do Registro.br

1. Acesse: https://registro.br/
2. Faça login com suas credenciais
3. Vá em **"Meus Domínios"**
4. Clique no domínio **blackhouse.app.br**

### 2. Configurar DNS (Zona de DNS)

1. No painel do domínio, procure por **"DNS"** ou **"Zona de DNS"**
2. Clique em **"Gerenciar DNS"** ou **"Editar Zona"**

### 3. Configurar Registros DNS

Você precisa criar os seguintes registros (substitua `SEU_IP_VPS` pelo IP real):

#### Registro A (Principal)
```
Tipo: A
Nome: @
Valor: SEU_IP_VPS
TTL: 3600 (ou padrão)
```

#### Registro A (WWW)
```
Tipo: A
Nome: www
Valor: SEU_IP_VPS
TTL: 3600 (ou padrão)
```

#### Registro A (API)
```
Tipo: A
Nome: api
Valor: SEU_IP_VPS
TTL: 3600 (ou padrão)
```

### 4. Exemplo Visual

No painel do Registro.br, você verá algo assim:

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| A | @ | 123.456.789.012 | 3600 |
| A | www | 123.456.789.012 | 3600 |
| A | api | 123.456.789.012 | 3600 |

### 5. Salvar Alterações

1. Clique em **"Salvar"** ou **"Confirmar"**
2. Aguarde a propagação DNS (pode levar de 5 minutos a 48 horas, geralmente 1-2 horas)

## 🔍 Verificar Configuração DNS

Após configurar, você pode verificar se está funcionando:

### No servidor:
```bash
# Verificar se o domínio aponta para o IP correto
dig blackhouse.app.br +short
dig www.blackhouse.app.br +short
dig api.blackhouse.app.br +short
```

### Online:
- Use: https://dnschecker.org/
- Digite: `blackhouse.app.br`, `www.blackhouse.app.br`, `api.blackhouse.app.br`
- Verifique se todos apontam para o IP da sua VPS

## ⚠️ Importante

1. **Propagação DNS**: Pode levar até 48 horas, mas geralmente é mais rápido (1-2 horas)
2. **IP Público**: Certifique-se de usar o IP público da VPS, não o IP privado
3. **Firewall**: Certifique-se de que as portas 80 e 443 estão abertas no firewall da VPS
4. **Nginx**: O Nginx precisa estar rodando antes de testar

## 🚀 Após Configurar DNS

Depois que o DNS estiver propagado, você pode:

1. Testar acesso HTTP:
   ```bash
   curl -I http://blackhouse.app.br
   ```

2. Configurar SSL (HTTPS):
   ```bash
   sudo certbot --nginx -d blackhouse.app.br -d www.blackhouse.app.br -d api.blackhouse.app.br
   ```

3. Verificar se está funcionando:
   ```bash
   curl -I https://blackhouse.app.br
   ```

## 📞 Suporte

Se tiver problemas:
1. Verifique se o IP está correto
2. Aguarde a propagação DNS (pode levar tempo)
3. Verifique se o Nginx está rodando: `sudo systemctl status nginx`
4. Verifique logs: `sudo tail -f /var/log/nginx/error.log`
