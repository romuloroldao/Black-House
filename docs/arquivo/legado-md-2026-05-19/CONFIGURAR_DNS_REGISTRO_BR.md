# 🌐 Como Configurar DNS no Registro.br - Passo a Passo CORRETO

**Problema:** O Registro.br não aceita IP diretamente e os servidores DNS da KingHost não funcionam.

**Solução:** Use os servidores DNS do próprio Registro.br e depois configure os registros A.

---

## ✅ SOLUÇÃO: Usar DNS do Registro.br

### Passo 1: Configurar Servidores DNS do Registro.br

1. Acesse: https://registro.br
2. Faça login
3. Vá em **"Meus Domínios"**
4. Selecione **`blackhouse.app.br`**
5. Procure por **"Servidores DNS"** ou **"Alterar Servidores DNS"**

6. **IMPORTANTE:** Clique no botão **"UTILIZAR DNS DO REGISTRO.BR"** ou **"USAR DNS DO REGISTRO.BR"**

   - Isso vai configurar os servidores DNS padrão do Registro.br:
     - `a.auto.dns.br`
     - `b.auto.dns.br`

7. Clique em **"SALVAR ALTERAÇÕES"**

8. Aguarde alguns minutos para a configuração ser aplicada (pode levar até 1 hora)

---

### Passo 2: Configurar Zona DNS (Registros A)

**⚠️ IMPORTANTE:** Só faça isso DEPOIS de configurar os servidores DNS do Registro.br (Passo 1).

**Onde encontrar a configuração de registros A no Registro.br:**

1. Na página do domínio `blackhouse.app.br`
2. Procure por uma das seguintes opções:
   - **"Alterar servidores DNS"** (mesmo botão do Passo 1) - pode ter opção de configurar registros dentro dele
   - **Aba "DNS"** ou **"Zona DNS"** no menu lateral ou superior
   - **"Registros DNS"** ou **"Configurar DNS"**
   - Dentro da seção **"DNS"** (onde mostra os servidores a.auto.dns.br e b.auto.dns.br)

3. **Se não encontrar nenhuma opção acima:**
   - Clique novamente em **"Alterar servidores DNS"**
   - Dentro do modal, pode haver uma opção para **"Gerenciar registros"** ou **"Configurar registros DNS"**
   - Ou pode haver uma aba/guia dentro do modal para configurar registros

4. **Alternativa:** Procure no menu lateral ou superior da página do domínio por:
   - **"DNS"**
   - **"Zona DNS"**
   - **"Registros"**
   - **"Configurações DNS"**

5. Uma vez encontrada a seção de registros DNS, adicione os registros A:

#### Adicionar Registro A - Domínio Raiz (@)

1. Clique em **"Adicionar Registro"** ou **"+"**
2. Configure:
   ```
   Tipo: A
   Nome: @ (ou deixe em branco/vazio)
   Valor: 177.153.64.95
   TTL: 3600 (ou padrão)
   ```
3. Clique em **"Salvar"** ou **"Adicionar"**

#### Adicionar Registro A - www

1. Clique em **"Adicionar Registro"** ou **"+"**
2. Configure:
   ```
   Tipo: A
   Nome: www
   Valor: 177.153.64.95
   TTL: 3600 (ou padrão)
   ```
3. Clique em **"Salvar"** ou **"Adicionar"**

#### Adicionar Registro A - api

1. Clique em **"Adicionar Registro"** ou **"+"**
2. Configure:
   ```
   Tipo: A
   Nome: api
   Valor: 177.153.64.95
   TTL: 3600 (ou padrão)
   ```
3. Clique em **"Salvar"** ou **"Adicionar"**

---

### Passo 3: Verificar Propagação DNS

Após configurar os registros A, aguarde a propagação (5-30 minutos):

```bash
# Verificar domínio principal
dig blackhouse.app.br +short

# Verificar www
dig www.blackhouse.app.br +short

# Verificar api
dig api.blackhouse.app.br +short
```

Todos devem retornar: **177.153.64.95**

---

## 🔍 Verificar Servidores DNS Configurados

Para verificar quais servidores DNS estão configurados para seu domínio:

```bash
dig NS blackhouse.app.br +short
```

Se estiver usando DNS do Registro.br, deve retornar algo como:
```
a.auto.dns.br.
b.auto.dns.br.
```

---

## ⚠️ Por que os DNS da KingHost não funcionam?

Os servidores DNS da KingHost (`dns1.kinghost.com.br` e `dns2.kinghost.com.br`) não estão respondendo corretamente ou não estão configurados para seu domínio. 

**Solução:** Use os servidores DNS do Registro.br, que são mais confiáveis e fáceis de configurar.

---

## 📋 Resumo do Processo Completo

1. ✅ **Configurar Servidores DNS:**
   - Use DNS do Registro.br (`a.auto.dns.br` e `b.auto.dns.br`)
   - Aguarde aplicação (até 1 hora)

2. ✅ **Configurar Registros A:**
   - @ → 177.153.64.95
   - www → 177.153.64.95
   - api → 177.153.64.95

3. ✅ **Aguardar Propagação:**
   - 5-30 minutos normalmente
   - Verificar com `dig`

4. ✅ **Configurar SSL:**
   ```bash
   sudo bash /root/deploy-completo.sh
   ```

---

## 🆘 Se ainda não funcionar

### Verificar Status dos Servidores DNS do Registro.br

```bash
dig @a.auto.dns.br blackhouse.app.br +short
dig @b.auto.dns.br blackhouse.app.br +short
```

### Verificar se o domínio está delegado corretamente

```bash
dig NS blackhouse.app.br
```

### Aguardar mais tempo

Às vezes pode levar até 24 horas para a propagação completa, especialmente a primeira vez que configura DNS.

---

## ✅ Checklist

- [ ] Configurou servidores DNS do Registro.br (não KingHost)
- [ ] Aguardou aplicação dos servidores DNS (até 1 hora)
- [ ] Adicionou registro A para @ (raiz) → 177.153.64.95
- [ ] Adicionou registro A para www → 177.153.64.95
- [ ] Adicionou registro A para api → 177.153.64.95
- [ ] Aguardou propagação DNS (5-30 minutos)
- [ ] Verificou com `dig` que está apontando para 177.153.64.95
- [ ] Configurou SSL com Certbot

---

**Última atualização:** 08/01/2026
