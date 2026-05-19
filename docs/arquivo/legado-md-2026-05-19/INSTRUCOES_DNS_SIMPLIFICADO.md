# 🚀 Guia Rápido: Configurar DNS no Registro.br

## ⚠️ Problema Resolvido

**Erro:** "Pesquisa recusada" ao tentar usar DNS da KingHost  
**Solução:** Use DNS do Registro.br e depois configure os registros A

---

## 📝 Passo a Passo Simplificado

### 1️⃣ Configurar Servidores DNS

No Registro.br:
1. Acesse seu domínio `blackhouse.app.br`
2. Clique em **"Servidores DNS"** ou **"Alterar Servidores DNS"**
3. Clique em **"UTILIZAR DNS DO REGISTRO.BR"**
4. Clique em **"SALVAR ALTERAÇÕES"**
5. Aguarde até 1 hora para aplicar

### 2️⃣ Configurar Registros A (Zona DNS)

**Só faça isso DEPOIS do passo 1!**

No Registro.br:
1. Vá em **"Gerenciar DNS"** ou **"Zona DNS"**
2. Adicione 3 registros A:

**Registro 1 - Raiz:**
```
Tipo: A
Nome: @ (ou deixe vazio)
Valor: 177.153.64.95
TTL: 3600
```

**Registro 2 - www:**
```
Tipo: A
Nome: www
Valor: 177.153.64.95
TTL: 3600
```

**Registro 3 - api:**
```
Tipo: A
Nome: api
Valor: 177.153.64.95
TTL: 3600
```

### 3️⃣ Aguardar e Verificar

Aguarde 5-30 minutos e verifique:

```bash
dig blackhouse.app.br +short
# Deve retornar: 177.153.64.95

dig www.blackhouse.app.br +short
# Deve retornar: 177.153.64.95

dig api.blackhouse.app.br +short
# Deve retornar: 177.153.64.95
```

### 4️⃣ Configurar SSL (HTTPS)

Quando o DNS propagar, configure SSL:

```bash
sudo bash /root/deploy-completo.sh
```

---

## ❌ O QUE NÃO FUNCIONA

- ❌ Usar servidores DNS da KingHost (`dns1.kinghost.com.br`)
- ❌ Tentar adicionar registros A antes de configurar servidores DNS
- ❌ Usar IP diretamente nos servidores DNS

## ✅ O QUE FUNCIONA

- ✅ Usar servidores DNS do Registro.br (`a.auto.dns.br`, `b.auto.dns.br`)
- ✅ Configurar servidores DNS primeiro
- ✅ Depois configurar registros A na Zona DNS

---

**IP do Servidor:** 177.153.64.95  
**Documentação completa:** Ver `CONFIGURAR_DNS_REGISTRO_BR.md`
