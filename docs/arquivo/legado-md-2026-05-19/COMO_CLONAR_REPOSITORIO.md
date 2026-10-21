# 🔐 Como Clonar o Repositório Privado

## ⚠️ Situação

O repositório é **privado** e requer autenticação. Não é possível clonar diretamente sem credenciais.

## ✅ Soluções

### Opção 1: Usar Token de Acesso Pessoal (Recomendado)

#### Passo 1: Criar Token no GitHub

1. Acesse: https://github.com/settings/tokens
2. Clique em **"Generate new token"** → **"Generate new token (classic)"**
3. Dê um nome: `BlackHouse VPS`
4. Selecione escopo: **`repo`** (acesso completo a repositórios privados)
5. Clique em **"Generate token"**
6. **COPIE O TOKEN** (só aparece uma vez!)

#### Passo 2: Clonar com Token

```bash
cd /root

# Substitua SEU_TOKEN pelo token que você copiou
git clone https://SEU_TOKEN@github.com/romuloroldao/Black-House.git
```

**Exemplo:**
```bash
git clone https://ghp_xxxxxxxxxxxxxxxxxxxx@github.com/romuloroldao/Black-House.git
```

---

### Opção 2: Configurar SSH

#### Passo 1: Gerar Chave SSH (se não tiver)

```bash
ssh-keygen -t ed25519 -C "seu-email@exemplo.com"
# Pressione Enter para aceitar local padrão
# Digite uma senha ou deixe vazio
```

#### Passo 2: Adicionar Chave ao GitHub

```bash
# Mostrar chave pública
cat ~/.ssh/id_ed25519.pub
```

1. Copie a chave exibida
2. Acesse: https://github.com/settings/keys
3. Clique em **"New SSH key"**
4. Cole a chave e salve

#### Passo 3: Clonar com SSH

```bash
cd /root
git clone git@github.com:romuloroldao/Black-House.git
```

---

### Opção 3: Clonar no Seu Computador e Transferir

#### No seu computador local:

```bash
# Clonar
git clone https://github.com/romuloroldao/Black-House.git

# Compactar
tar -czf Black-House.tar.gz Black-House/

# Transferir para VPS
scp Black-House.tar.gz root@177.153.64.95:/root/
```

#### Na VPS:

```bash
cd /root
tar -xzf Black-House.tar.gz
cd Black-House
npm install
```

---

### Opção 4: Usar Script Interativo

Execute o script que criei:

```bash
./scripts/clonar-e-preparar.sh
```

O script perguntará qual método você quer usar.

---

## 🚀 Após Clonar

Depois de clonar com sucesso, execute:

```bash
# 1. Preparar projeto
cd /root/Black-House
npm install

# 2. Adaptar código automaticamente
/root/scripts/adaptar-automatico.sh /root/Black-House

# 3. Configurar .env
echo "VITE_API_URL=https://api.blackhouse.app.br" > .env
```

---

## ✅ Verificar se Clonou com Sucesso

```bash
ls -la /root/Black-House
# Deve mostrar arquivos como package.json, src/, etc.
```

---

## 🔐 Segurança

**IMPORTANTE**: 
- Não compartilhe tokens ou chaves SSH
- Tokens expiram - você pode configurar expiração
- Se usar token na URL, ele pode aparecer em logs - use com cuidado

**Recomendação**: Use SSH (Opção 2) para maior segurança.

---

## 📞 Precisa de Ajuda?

Se nenhuma opção funcionar:
1. Verifique se você tem acesso ao repositório
2. Verifique se o repositório existe: https://github.com/romuloroldao/Black-House
3. Use a Opção 3 (clonar localmente e transferir)

---

**Escolha a opção mais conveniente para você!**
