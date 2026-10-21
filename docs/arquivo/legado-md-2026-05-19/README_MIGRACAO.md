# Guia Rápido de Migração

Este diretório contém todos os arquivos necessários para migrar a aplicação BlackHouse do Supabase para PostgreSQL puro.

## Estrutura de Arquivos

```
.
├── MIGRACAO_POSTGRESQL.md          # Guia completo de migração
├── migration/
│   └── migration_postgres.sql      # Script SQL de migração
├── server/
│   ├── index.js                    # Servidor Express com API
│   ├── package.json                # Dependências do servidor
│   └── .env.example                # Exemplo de variáveis de ambiente
├── src/
│   └── lib/
│       └── api-client.ts           # Cliente de API para o frontend
├── scripts/
│   ├── setup-postgres.sh          # Script de instalação do PostgreSQL
│   └── backup-db.sh               # Script de backup automático
├── deployment/
│   ├── nginx.conf                  # Configuração do Nginx
│   └── blackhouse-api.service     # Serviço systemd
└── .env.example                    # Variáveis de ambiente do frontend
```

## Passos Rápidos

### 1. Instalar PostgreSQL

```bash
chmod +x scripts/setup-postgres.sh
./scripts/setup-postgres.sh
```

### 2. Executar Migração do Banco

```bash
psql -U app_user -d blackhouse_db -f migration/migration_postgres.sql
```

### 3. Configurar Servidor API

```bash
cd server
cp .env.example .env
# Edite o .env com suas credenciais
npm install
npm start
```

### 4. Configurar Frontend

```bash
cp .env.example .env
# Edite o .env com a URL da API
# Substitua importações do Supabase por apiClient
```

### 5. Deploy

Siga as instruções no arquivo `MIGRACAO_POSTGRESQL.md` para:
- Configurar Nginx
- Configurar SSL
- Configurar systemd
- Configurar backups

## Diferenças Principais

### Autenticação

**Antes (Supabase):**
```typescript
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, key)
await supabase.auth.signUp({ email, password })
```

**Depois (API própria):**
```typescript
import { apiClient } from './lib/api-client'
await apiClient.signUp(email, password)
```

### Queries de Banco

**Antes:**
```typescript
const { data } = await supabase.from('tabela').select('*')
```

**Depois:**
```typescript
const data = await apiClient.from('tabela').select('*')
```

### Storage

**Antes:**
```typescript
await supabase.storage.from('bucket').upload('path', file)
```

**Depois:**
```typescript
await apiClient.uploadFile('bucket', 'path', file)
const url = apiClient.getPublicUrl('bucket', 'path')
```

## Suporte

Para mais detalhes, consulte o arquivo `MIGRACAO_POSTGRESQL.md`.
