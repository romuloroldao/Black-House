# 🌐 Configuração do Domínio blackhouse.app.br

## Informações da VPS

- **IP Público**: 177.153.64.95
- **Hostname**: blackhouse-app.vps-kinghost.net
- **Domínio**: blackhouse.app.br

## 📋 Passo a Passo no Registro.br

### 1. Acessar o Painel do Registro.br

1. Acesse: https://registro.br
2. Faça login com sua conta
3. Vá em **"Meus Domínios"**
4. Selecione **blackhouse.app.br**

### 2. Configurar DNS (Zona DNS)

Clique em **"Gerenciar DNS"** ou **"Zona DNS"** e configure os seguintes registros:

#### Registro A (Principal)
```
Tipo: A
Nome: @ (ou deixe em branco)
Valor: 177.153.64.95
TTL: 3600 (ou padrão)
```

#### Registro A (www)
```
Tipo: A
Nome: www
Valor: 177.153.64.95
TTL: 3600 (ou padrão)
```

#### Registro A (API)
```
Tipo: A
Nome: api
Valor: 177.153.64.95
TTL: 3600 (ou padrão)
```

### 3. Configuração Alternativa (Usando CNAME)

Se preferir usar CNAME para www:

```
Tipo: A
Nome: @
Valor: 177.153.64.95

Tipo: CNAME
Nome: www
Valor: blackhouse.app.br

Tipo: A
Nome: api
Valor: 177.153.64.95
```

### 4. Verificar Propagação DNS

Após configurar, aguarde alguns minutos e verifique:

```bash
# Verificar registro A principal
dig blackhouse.app.br +short

# Verificar www
dig www.blackhouse.app.br +short

# Verificar api
dig api.blackhouse.app.br +short
```

Todos devem retornar: **177.153.64.95**

### 5. Tempo de Propagação

- **Normal**: 5-30 minutos
- **Máximo**: Até 48 horas (raro)
- **Recomendado**: Aguardar pelo menos 1 hora antes de configurar SSL

## ⚠️ Importante

1. **Não configure SSL antes do DNS propagar** - O Let's Encrypt precisa conseguir resolver o domínio
2. **Mantenha os registros A** - Eles são essenciais para o funcionamento
3. **Verifique a propagação** antes de continuar com a configuração do Nginx

## 🔍 Como Verificar se Propagou

Execute no servidor ou localmente:

```bash
# Verificar DNS
nslookup blackhouse.app.br
nslookup www.blackhouse.app.br
nslookup api.blackhouse.app.br

# Ou usando dig
dig blackhouse.app.br
dig www.blackhouse.app.br
dig api.blackhouse.app.br
```

Todos devem retornar o IP: **177.153.64.95**

## 📝 Checklist

- [ ] Acessou o painel do Registro.br
- [ ] Configurou registro A para @ (raiz)
- [ ] Configurou registro A para www
- [ ] Configurou registro A para api
- [ ] Aguardou propagação DNS (verificou com dig/nslookup)
- [ ] Todos os subdomínios apontam para 177.153.64.95
- [ ] Pronto para configurar Nginx e SSL

## 🚀 Próximos Passos

Após confirmar que o DNS propagou:

1. Configurar Nginx (já preparado)
2. Configurar SSL com Certbot
3. Testar acesso aos domínios
