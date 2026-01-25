# 🎯 Passo a Passo Visual: Configurar Registros A no Registro.br

## ✅ Status Atual

- ✅ Servidores DNS do Registro.br já configurados:
  - `a.auto.dns.br`
  - `b.auto.dns.br`

**Próximos passos:**
1. Adicionar os registros A apontando para `177.153.64.95`
2. (Opcional) Configurar DNSSEC para maior segurança (veja `CONFIGURAR_DNSSEC.md`)

---

## 📍 ONDE ENCONTRAR A CONFIGURAÇÃO DE REGISTROS A

### Método 1: Através do Botão "Alterar servidores DNS"

1. Na página do domínio `blackhouse.app.br`
2. Na seção **"DNS"** (onde mostra os servidores)
3. Clique no botão **"Alterar servidores DNS"**
4. **Dentro do modal que abrir:**
   - Procure por **abas** ou **guias** no topo do modal
   - Pode haver uma aba chamada **"Registros"**, **"Zona DNS"** ou **"Configurar"**
   - OU pode haver um botão **"Gerenciar Registros"** ou **"Configurar Registros DNS"** dentro do modal

### Método 2: Menu Lateral ou Tabs

Na página do domínio, procure por:

- **Tabs/Abas no topo da página:**
  - "Visão Geral"
  - **"DNS"** ← Clique aqui
  - "Renovação"
  - "Transferência"
  - etc.

- **Menu lateral (se houver):**
  - "Informações"
  - **"DNS"** ou **"Zona DNS"** ← Clique aqui
  - "Configurações"

### Método 3: Na Própria Seção DNS

Na seção **"DNS"** da página (onde mostra os servidores `a.auto.dns.br` e `b.auto.dns.br`):

- Procure por um botão **"Gerenciar"**, **"Configurar"** ou **"Editar"**
- Pode haver um link **"Ver registros DNS"** ou **"Configurar registros"**
- Pode haver uma lista de registros existentes com botão **"+"** ou **"Adicionar registro"**

---

## 📝 O QUE FAZER QUANDO ENCONTRAR

Quando encontrar a seção de registros DNS, você verá:

- Uma lista de registros (pode estar vazia)
- Um botão **"+"**, **"Adicionar"**, **"Novo Registro"** ou similar

### Adicionar os 3 Registros A:

#### Registro 1 - Domínio Raiz (@)

1. Clique em **"Adicionar"** ou **"+"**
2. Preencha:
   - **Tipo:** Selecione **"A"**
   - **Nome:** Deixe **vazio** ou digite **"@"**
   - **Valor:** Digite **177.153.64.95**
   - **TTL:** Deixe **3600** (ou padrão)
3. Clique em **"Salvar"** ou **"Adicionar"**

#### Registro 2 - www

1. Clique em **"Adicionar"** ou **"+"**
2. Preencha:
   - **Tipo:** Selecione **"A"**
   - **Nome:** Digite **"www"**
   - **Valor:** Digite **177.153.64.95**
   - **TTL:** Deixe **3600** (ou padrão)
3. Clique em **"Salvar"** ou **"Adicionar"**

#### Registro 3 - api

1. Clique em **"Adicionar"** ou **"+"**
2. Preencha:
   - **Tipo:** Selecione **"A"**
   - **Nome:** Digite **"api"**
   - **Valor:** Digite **177.153.64.95**
   - **TTL:** Deixe **3600** (ou padrão)
3. Clique em **"Salvar"** ou **"Adicionar"**

---

## 🔍 Se Ainda Não Encontrar

### 1. Verificar se DNS está realmente ativo

Execute no servidor:

```bash
dig NS blackhouse.app.br +short
```

Se retornar `a.auto.dns.br.` e `b.auto.dns.br.`, está correto.

### 2. Aguardar mais tempo

Às vezes a interface do Registro.br demora para atualizar. Aguarde 1-2 horas após configurar os servidores DNS e tente novamente.

### 3. Tentar em navegador diferente ou modo anônimo

Às vezes cache do navegador pode esconder opções.

### 4. Verificar se há mensagem de "aguardando propagação"

O Registro.br pode mostrar uma mensagem dizendo que está aguardando a propagação dos servidores DNS. Nesse caso, aguarde o tempo indicado.

### 5. Contatar Suporte do Registro.br

Se mesmo após aguardar não encontrar:

- **Email:** atendimento@registro.br
- **Telefone:** Verifique no site
- **Chat Online:** Pode haver no painel

---

## ✅ Após Adicionar os Registros

1. Aguarde 5-30 minutos para propagação
2. Verifique:

```bash
dig blackhouse.app.br +short
# Deve retornar: 177.153.64.95

dig www.blackhouse.app.br +short
# Deve retornar: 177.153.64.95

dig api.blackhouse.app.br +short
# Deve retornar: 177.153.64.95
```

3. Quando todos retornarem `177.153.64.95`, configure SSL:

```bash
sudo bash /root/deploy-completo.sh
```

---

## 📸 Dica Visual

Na interface do Registro.br, procure por:

- **Ícones de "+"** ou **"Adicionar"**
- **Botões verdes** ou destacados
- **Tabelas** com colunas "Tipo", "Nome", "Valor"
- **Listas vazias** com opção de adicionar

A configuração de registros geralmente aparece como uma **tabela** ou **lista** onde você pode adicionar, editar e excluir registros DNS.

---

**Última atualização:** 08/01/2026
