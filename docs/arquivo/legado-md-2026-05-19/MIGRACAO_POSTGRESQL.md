# Guia de Migração para Servidor Próprio com PostgreSQL

Este guia detalha como migrar a aplicação para seu próprio servidor usando PostgreSQL puro, substituindo completamente o Supabase.

---

## 📋 Pré-requisitos

### Servidor
- VPS ou servidor dedicado (recomendado: 2GB RAM, 2 vCPUs mínimo)
- Sistema operacional: Ubuntu 22.04 LTS ou similar
- Acesso root/sudo
- Domínio configurado (opcional, mas recomendado)

### Software Necessário
- Node.js 18+ 
- npm ou pnpm
- PostgreSQL 15+
- Nginx ou Caddy (para reverse proxy)
- Git
- Deno (para Edge Functions)

---

## 🔄 Parte 1: Clonar o Repositório

### 1.1 Obter o código do GitHub

```bash
# Clone o repositório (substitua pela URL do seu repo)
git clone https://github.com/romuloroldao/Black-House.git
cd Black-House

# Instalar dependências
npm install
```

---

## 🗄️ Parte 2: Instalar e Configurar PostgreSQL

### 2.1 Instalar PostgreSQL

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar PostgreSQL 15
sudo apt install postgresql-15 postgresql-contrib-15 -y

# Iniciar e habilitar serviço
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2.2 Configurar usuário e banco de dados

```bash
# Acessar como superusuário postgres
sudo -u postgres psql

# Criar usuário da aplicação
CREATE USER app_user WITH PASSWORD 'sua_senha_super_segura';

# Criar banco de dados
CREATE DATABASE blackhouse_db OWNER app_user;

# Dar permissões
GRANT ALL PRIVILEGES ON DATABASE blackhouse_db TO app_user;

# Sair
\q
```

### 2.3 Configurar acesso remoto (se necessário)

```bash
# Editar postgresql.conf
sudo nano /etc/postgresql/15/main/postgresql.conf

# Alterar:
listen_addresses = '*'

# Editar pg_hba.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Adicionar linha (ajuste o IP conforme necessário):
host    blackhouse_db    app_user    0.0.0.0/0    md5

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

### 2.4 Instalar extensões necessárias

```bash
sudo -u postgres psql -d blackhouse_db

# Instalar extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\q
```

---

## 📤 Parte 3: Exportar Dados do Supabase Atual

### 3.1 Exportar Schema (estrutura)

```bash
# Via Supabase CLI
npx supabase db dump --project-ref cghzttbggklhuyqxzabq > schema_supabase.sql
```

Ou manualmente:
```bash
pg_dump "postgresql://postgres:[PASSWORD]@db.cghzttbggklhuyqxzabq.supabase.co:5432/postgres" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --exclude-schema=auth \
  --exclude-schema=storage \
  --exclude-schema=supabase_functions \
  --exclude-schema=realtime \
  --exclude-schema=vault \
  > schema_public.sql
```

### 3.2 Exportar Dados

```bash
pg_dump "postgresql://postgres:[PASSWORD]@db.cghzttbggklhuyqxzabq.supabase.co:5432/postgres" \
  --data-only \
  --no-owner \
  --no-privileges \
  --exclude-schema=auth \
  --exclude-schema=storage \
  > data.sql
```

### 3.3 Exportar arquivos do Storage

```bash
# Criar pasta de backup
mkdir -p backup/storage

# Baixar arquivos de cada bucket
npx supabase storage cp -r supabase://progress-photos ./backup/storage/progress-photos --project-ref cghzttbggklhuyqxzabq
npx supabase storage cp -r supabase://avatars ./backup/storage/avatars --project-ref cghzttbggklhuyqxzabq
```

---

## 🔧 Parte 4: Adaptar Schema para PostgreSQL Puro

Execute o script de migração fornecido em `migration/migration_postgres.sql`:

```bash
# Conectar ao banco
psql -h localhost -U app_user -d blackhouse_db

# Executar script de migração
\i migration/migration_postgres.sql

# Importar schema público (após ajustar referências)
\i schema_public.sql

# Importar dados
\i data.sql
```

---

## 🔐 Parte 5: Criar API de Autenticação

### 5.1 Instalar dependências do servidor

```bash
cd server
npm install
```

### 5.2 Configurar variáveis de ambiente

Edite o arquivo `server/.env` com suas credenciais.

### 5.3 Iniciar servidor

```bash
# Desenvolvimento
npm run dev

# Produção (após configurar systemd)
sudo systemctl start blackhouse-api
```

---

## ⚙️ Parte 6: Adaptar Frontend

### 6.1 Atualizar variáveis de ambiente

Edite o arquivo `.env` na raiz do projeto:

```env
VITE_API_URL=https://api.seudominio.com
```

### 6.2 Substituir cliente Supabase

O novo cliente de API está em `src/lib/api-client.ts`. Atualize as importações no seu código para usar `apiClient` ao invés do cliente Supabase.

---

## 🚀 Parte 7: Deploy da Aplicação

### 7.1 Build de produção

```bash
npm run build
```

### 7.2 Configurar Nginx

Use o arquivo de configuração fornecido em `deployment/nginx.conf` como referência.

### 7.3 Configurar SSL

```bash
sudo certbot --nginx -d seudominio.com -d www.seudominio.com -d api.seudominio.com
```

---

## 📊 Parte 9: Monitoramento e Backup

### 9.1 Backup automático

O script de backup está em `scripts/backup-db.sh`. Configure o crontab:

```bash
crontab -e
# Adicionar:
0 2 * * * /usr/local/bin/backup-db.sh
```

---

## ✅ Checklist Final

- [ ] Servidor configurado e acessível
- [ ] PostgreSQL instalado e configurado
- [ ] Banco de dados criado com extensões
- [ ] Schema migrado e adaptado
- [ ] Dados importados
- [ ] API Node.js funcionando
- [ ] Frontend buildado e servido
- [ ] Nginx configurado como reverse proxy
- [ ] SSL configurado
- [ ] Arquivos do Storage migrados
- [ ] Backup automático configurado
- [ ] Domínio apontando para o servidor

---

## 🔐 Segurança

### Firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
# NÃO exponha a porta 5432 (PostgreSQL) publicamente!
sudo ufw enable
```

### Boas Práticas

1. **Senhas fortes** para PostgreSQL e JWT
2. **Não exponha** o PostgreSQL para a internet
3. **Use HTTPS** sempre em produção
4. **Mantenha backups** em local separado
5. **Atualize** regularmente o sistema e dependências

---

## 📝 Diferenças do Supabase

| Funcionalidade | Supabase | PostgreSQL Puro |
|---------------|----------|-----------------|
| Autenticação | Integrada | API própria (JWT) |
| RLS | Nativo | Implementar na API |
| Realtime | WebSocket integrado | Implementar separado |
| Storage | Integrado | Arquivos locais/S3 |
| Edge Functions | Deno Deploy | Express/Deno |
| Dashboard | Supabase Studio | pgAdmin/próprio |

---

## 📞 Suporte

Se encontrar problemas durante a migração:
1. Verifique logs do PostgreSQL, API e Nginx
2. Confirme conexão com banco de dados
3. Teste endpoints da API individualmente
4. Verifique variáveis de ambiente
