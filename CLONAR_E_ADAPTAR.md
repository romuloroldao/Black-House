# 📋 Guia: Clonar Repositório e Adaptar Frontend

## 🔐 Passo 1: Clonar Repositório

O repositório é privado, então você precisa de autenticação. Escolha uma opção:

### Opção A: Usar SSH (Recomendado)

```bash
# Se você tem chave SSH configurada no GitHub
cd /root
git clone git@github.com:romuloroldao/Black-House.git
```

### Opção B: Usar Token de Acesso Pessoal

1. Crie um token em: https://github.com/settings/tokens
2. Dê permissões: `repo`
3. Use o token:

```bash
cd /root
git clone https://SEU_TOKEN@github.com/romuloroldao/Black-House.git
```

### Opção C: Clonar Manualmente e Transferir

No seu computador local:
```bash
git clone https://github.com/romuloroldao/Black-House.git
tar -czf Black-House.tar.gz Black-House/
scp Black-House.tar.gz root@177.153.64.95:/root/
```

Na VPS:
```bash
cd /root
tar -xzf Black-House.tar.gz
```

---

## 🔧 Passo 2: Instalar Dependências

```bash
cd /root/Black-House
npm install
```

---

## 🔄 Passo 3: Adaptar Frontend

### 3.1. Copiar api-client.ts

```bash
cd /root/Black-House
mkdir -p src/lib
cp /root/src/lib/api-client.ts src/lib/api-client.ts
```

### 3.2. Encontrar Arquivos que Usam Supabase

```bash
cd /root/Black-House
grep -r "@supabase\|supabase\|createClient" src/ --include="*.ts" --include="*.tsx"
```

### 3.3. Substituições Principais

#### Antes:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

#### Depois:
```typescript
import { apiClient } from './lib/api-client'
// Não precisa mais de URL e chave
```

#### Autenticação:

**Antes:**
```typescript
await supabase.auth.signUp({ email, password })
await supabase.auth.signInWithPassword({ email, password })
await supabase.auth.signOut()
const { data: { user } } = await supabase.auth.getUser()
```

**Depois:**
```typescript
await apiClient.signUp(email, password)
await apiClient.signIn(email, password)
await apiClient.signOut()
const { user } = await apiClient.getUser()
```

#### Queries:

**Antes:**
```typescript
const { data } = await supabase.from('tabela').select('*')
await supabase.from('tabela').insert({ campo: 'valor' })
await supabase.from('tabela').update({ campo: 'valor' }).eq('id', id)
await supabase.from('tabela').delete().eq('id', id)
```

**Depois:**
```typescript
const data = await apiClient.from('tabela').select('*')
await apiClient.from('tabela').insert({ campo: 'valor' })
await apiClient.from('tabela').update({ id, campo: 'valor' })
await apiClient.from('tabela').delete(id)
```

#### Storage:

**Antes:**
```typescript
await supabase.storage.from('bucket').upload('path', file)
const { data } = supabase.storage.from('bucket').getPublicUrl('path')
```

**Depois:**
```typescript
await apiClient.uploadFile('bucket', 'path', file)
const url = apiClient.getPublicUrl('bucket', 'path')
```

### 3.4. Configurar Variáveis de Ambiente

```bash
cd /root/Black-House
cat > .env << 'EOF'
VITE_API_URL=https://api.blackhouse.app.br
EOF
```

### 3.5. Remover Dependência do Supabase

```bash
cd /root/Black-House
npm uninstall @supabase/supabase-js
```

---

## ✅ Passo 4: Verificar Adaptação

```bash
cd /root/Black-House

# Verificar se ainda há referências ao Supabase
grep -r "supabase" src/ --include="*.ts" --include="*.tsx" | grep -v "api-client"

# Se retornar vazio, está tudo adaptado!
```

---

## 🚀 Passo 5: Testar Localmente (Opcional)

```bash
cd /root/Black-House
npm run dev
```

Teste se a aplicação funciona localmente.

---

## 📦 Passo 6: Build de Produção

```bash
cd /root/Black-House
npm run build

# Copiar para diretório do Nginx
sudo cp -r dist/* /var/www/blackhouse/dist/
sudo chown -R www-data:www-data /root/Black-House/dist
```

---

## 🔍 Script de Adaptação Automática

Criei um script que ajuda na adaptação:

```bash
cd /root
./scripts/adaptar-frontend.sh /root/Black-House
```

O script:
- Copia `api-client.ts`
- Configura `.env`
- Lista arquivos que precisam adaptação manual
- Instala dependências

---

## 📋 Checklist

- [ ] Repositório clonado
- [ ] Dependências instaladas (`npm install`)
- [ ] `api-client.ts` copiado
- [ ] Todas as importações do Supabase substituídas
- [ ] Todas as chamadas `supabase.*` substituídas por `apiClient.*`
- [ ] Variáveis de ambiente configuradas
- [ ] Dependência `@supabase/supabase-js` removida
- [ ] Código testado localmente
- [ ] Build feito com sucesso

---

## 🆘 Problemas Comuns

### Erro: "Repository not found"
- Verifique se o repositório é privado
- Use token de acesso ou SSH

### Erro: "Cannot find module '@supabase/supabase-js'"
- Isso é esperado após remover a dependência
- Verifique se todas as importações foram substituídas

### Erro: "apiClient is not defined"
- Verifique se `api-client.ts` foi copiado corretamente
- Verifique se a importação está correta: `import { apiClient } from './lib/api-client'`

---

**Após clonar, execute o script de adaptação para facilitar o processo!**
