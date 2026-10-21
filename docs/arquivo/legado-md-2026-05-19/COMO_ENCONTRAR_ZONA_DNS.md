# 🔍 Como Encontrar a Configuração de Registros A no Registro.br

## ⚠️ Problema

Você já configurou os servidores DNS do Registro.br (`a.auto.dns.br` e `b.auto.dns.br`), mas não encontra onde adicionar os registros A.

---

## 🔎 Onde Procurar

### Opção 1: Dentro do Botão "Alterar servidores DNS"

1. Na página do domínio `blackhouse.app.br`
2. Clique no botão **"Alterar servidores DNS"** (mesmo que você já usou)
3. Dentro do modal, procure por:
   - Uma **aba** ou **guia** chamada "Registros" ou "Zona DNS"
   - Um botão **"Gerenciar Registros"** ou **"Configurar Registros"**
   - Um link **"Configurar registros DNS"** ou similar

### Opção 2: Menu Lateral ou Superior

Na página do domínio, procure no menu:

- **"DNS"** → pode ter submenu com "Registros" ou "Zona DNS"
- **"Configurações"** → pode ter opção de DNS
- **"Gerenciar"** → pode ter opção de DNS

### Opção 3: Seção DNS na Página Principal

Na própria página do domínio, na seção **"DNS"** (onde mostra os servidores):

- Pode haver um botão **"Gerenciar"** ou **"Configurar"** ao lado
- Pode haver um link **"Ver registros"** ou **"Editar registros"**
- Pode haver uma lista de registros existentes com botão **"+"** ou **"Adicionar"**

### Opção 4: URL Direta (Tentar)

Às vezes o Registro.br tem URLs diretas. Tente acessar diretamente:

```
https://registro.br/meus-dominios/blackhouse.app.br/dns
https://registro.br/meus-dominios/blackhouse.app.br/zonadns
https://registro.br/meus-dominios/blackhouse.app.br/registros
```

---

## 📝 O Que Você Precisa Adicionar

Quando encontrar a seção de registros, adicione:

**Registro 1:**
```
Tipo: A
Nome: @ (ou deixe vazio)
Valor: 177.153.64.95
TTL: 3600
```

**Registro 2:**
```
Tipo: A
Nome: www
Valor: 177.153.64.95
TTL: 3600
```

**Registro 3:**
```
Tipo: A
Nome: api
Valor: 177.153.64.95
TTL: 3600
```

---

## 🆘 Se Ainda Não Encontrar

### Verificar se os DNS do Registro.br estão realmente ativos

```bash
dig NS blackhouse.app.br +short
```

Deve retornar:
```
a.auto.dns.br.
b.auto.dns.br.
```

### Aguardar mais tempo

Às vezes a interface pode demorar para atualizar após configurar os servidores DNS. Aguarde 1-2 horas e tente novamente.

### Contatar Suporte do Registro.br

Se mesmo após aguardar não encontrar a opção, entre em contato com o suporte do Registro.br:

- **Email:** atendimento@registro.br
- **Telefone:** Verifique no site do Registro.br
- **Chat:** Pode haver chat online no painel

---

## 💡 Dica

No Registro.br, quando você usa os servidores DNS deles (`a.auto.dns.br` e `b.auto.dns.br`), a configuração de registros geralmente fica:

1. **Dentro do botão "Alterar servidores DNS"** - como uma segunda etapa
2. **Em uma seção separada na mesma página** - abaixo ou ao lado da seção DNS
3. **Em um menu específico** - pode estar oculto ou em um submenu

Procure por palavras-chave como: "registros", "zona", "configurar", "gerenciar", "adicionar"

---

**Última atualização:** 08/01/2026
