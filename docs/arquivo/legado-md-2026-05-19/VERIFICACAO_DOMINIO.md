# 🔍 Verificação do Domínio blackhouse.app.br

## 📊 Status Atual

**Data da Verificação:** $(date)

### ✅ Configurado Corretamente:

1. **Servidores DNS:**
   - `a.auto.dns.br` ✅
   - `b.auto.dns.br` ✅
   - SOA configurado corretamente ✅

2. **Servidor VPS:**
   - IP: `177.153.64.95` ✅
   - Nginx instalado e rodando ✅
   - Configuração do Nginx para `blackhouse.app.br` existe ✅
   - Servidor responde via IP ✅

3. **Registros Existentes:**
   - MX: `0 .` (configurado)
   - TXT: `v=spf1 -all` (configurado)

### ❌ **PROBLEMA IDENTIFICADO:**

**Registros A NÃO configurados no DNS!**

O domínio `blackhouse.app.br` **NÃO está resolvendo** para o IP do VPS porque:

- ❌ Não há registro **A** para `blackhouse.app.br`
- ❌ Não há registro **A** para `www.blackhouse.app.br`
- ❌ Não há registro **A** para `api.blackhouse.app.br`

## 🔧 Solução: Configurar Registros A no Registro.br

### Passo 1: Acessar o Painel do Registro.br

1. Acesse: https://registro.br
2. Faça login com sua conta
3. Vá em **"Meus Domínios"**
4. Selecione **`blackhouse.app.br`**

### Passo 2: Configurar Registros DNS

Procure por uma das seguintes opções:
- **"Gerenciar DNS"** ou **"Zona DNS"** ou **"Registros DNS"**
- Ou **"DNS"** → **"Gerenciar DNS"**

### Passo 3: Adicionar Registros A

Adicione os seguintes registros:

```
Tipo  Nome    Valor
A     @       177.153.64.95
A     www     177.153.64.95
A     api     177.153.64.95
```

**Explicação:**
- `@` = domínio raiz (blackhouse.app.br)
- `www` = www.blackhouse.app.br
- `api` = api.blackhouse.app.br

### Passo 4: Salvar e Aguardar Propagação

1. Clique em **"Salvar"** ou **"Aplicar"**
2. Aguarde a propagação DNS (15 minutos a 24 horas)

## ✅ Verificação Após Configurar

Após configurar os registros A, aguarde alguns minutos e execute:

```bash
# Verificar registro A do domínio principal
dig +short blackhouse.app.br A
# Deve retornar: 177.153.64.95

# Verificar www
dig +short www.blackhouse.app.br A
# Deve retornar: 177.153.64.95

# Verificar api
dig +short api.blackhouse.app.br A
# Deve retornar: 177.153.64.95

# Testar acesso HTTP
curl -I http://blackhouse.app.br
# Deve retornar código HTTP 200
```

## 📋 Checklist Final

- [ ] Servidores DNS configurados (a.auto.dns.br, b.auto.dns.br) ✅
- [ ] Registro A para @ (blackhouse.app.br) configurado ❌
- [ ] Registro A para www (www.blackhouse.app.br) configurado ❌
- [ ] Registro A para api (api.blackhouse.app.br) configurado ❌
- [ ] Nginx configurado no servidor ✅
- [ ] Servidor respondendo via IP ✅
- [ ] Aguardar propagação DNS ⏳

## ⚠️ Observações Importantes

1. **Tempo de Propagação:** Após adicionar os registros A, pode levar de 15 minutos a 24 horas para propagar completamente

2. **Nginx Já Configurado:** O servidor já está pronto para receber requisições para:
   - `blackhouse.app.br` (frontend)
   - `www.blackhouse.app.br` (frontend)
   - `api.blackhouse.app.br` (API)

3. **Diretório do Frontend:** Verifique se `/var/www/blackhouse/dist` existe e tem os arquivos do frontend. Se não existir, você precisará fazer o build e deploy da aplicação.

4. **HTTPS:** Após configurar os registros A e confirmar que está funcionando via HTTP, configure o SSL com Let's Encrypt usando Certbot.

---

**IP do VPS:** 177.153.64.95
**Domínio:** blackhouse.app.br
**Status DNS:** ⚠️ Registros A não configurados
**Status Servidor:** ✅ Configurado e funcionando
