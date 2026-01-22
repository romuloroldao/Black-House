# ⚠️ Problema de Conectividade com Supabase

## 🔍 Diagnóstico

A VPS não consegue conectar diretamente ao banco de dados do Supabase devido a:

1. **Falta de conectividade IPv6** - O Supabase está retornando apenas IPv6
2. **Possível bloqueio de firewall** - Conexões diretas ao PostgreSQL podem estar bloqueadas
3. **Network unreachable** - A rede não consegue alcançar o servidor do Supabase

## ✅ Soluções Alternativas

### Opção 1: Exportar via Supabase CLI (Recomendado)

Execute **localmente no seu computador** (não na VPS):

```bash
# Instalar Supabase CLI
npm install -g supabase

# Fazer login
npx supabase login

# Exportar dados
npx supabase db dump --project-ref cghzttbggklhuyqxzabq > schema.sql

# Transferir para a VPS
scp schema.sql root@177.153.64.95:/root/backup/schema_public.sql
scp data.sql root@177.153.64.95:/root/backup/data.sql
```

### Opção 2: Exportar via Dashboard do Supabase

1. Acesse: https://supabase.com/dashboard
2. Selecione projeto: `cghzttbggklhuyqxzabq`
3. Vá em: **Database → Backups**
4. Clique em **"Create backup"** ou **"Download backup"**
5. Baixe o arquivo SQL
6. Transfira para a VPS:
   ```bash
   scp backup.sql root@177.153.64.95:/root/backup/
   ```

### Opção 3: Usar Supabase Studio (SQL Editor)

1. Acesse: https://supabase.com/dashboard
2. Vá em: **SQL Editor**
3. Execute queries para exportar dados manualmente
4. Copie os resultados e salve em arquivos SQL

### Opção 4: Usar pgAdmin ou DBeaver

1. Instale pgAdmin ou DBeaver no seu computador local
2. Configure conexão:
   - Host: `db.cghzttbggklhuyqxzabq.supabase.co`
   - Port: `5432`
   - Database: `postgres`
   - User: `postgres`
   - Password: `RR0ld40.864050!`
3. Use a ferramenta para exportar schema e dados
4. Transfira os arquivos para a VPS

### Opção 5: Habilitar IPv6 na VPS (Avançado)

Se você tiver controle sobre a VPS e quiser habilitar IPv6:

```bash
# Verificar se IPv6 está disponível
ip -6 addr show

# Configurar IPv6 (depende do provedor)
# Consulte a documentação do seu provedor VPS
```

## 📋 Após Obter os Arquivos

Quando você tiver os arquivos SQL na VPS:

```bash
cd /root

# 1. Adaptar schema
./scripts/adapt-schema.sh backup/schema_public.sql backup/schema_public_adapted.sql

# 2. Importar dados
./scripts/importar-dados.sh
```

## 🔧 Script para Receber Arquivos

Criei um script para facilitar a importação quando você transferir os arquivos:

```bash
# Na VPS, após transferir os arquivos
cd /root/backup

# Verificar arquivos
ls -lh *.sql

# Adaptar e importar
cd /root
./scripts/adapt-schema.sh backup/schema_public.sql backup/schema_public_adapted.sql
./scripts/importar-dados.sh
```

## 📞 Informações para Transferência

**IP da VPS**: `177.153.64.95`  
**Usuário**: `root`  
**Diretório de destino**: `/root/backup/`

**Comando SCP exemplo:**
```bash
scp arquivo.sql root@177.153.64.95:/root/backup/schema_public.sql
```

## ✅ Recomendação

**Use a Opção 1 (Supabase CLI)** - É a mais completa e confiável:

1. Execute localmente no seu computador
2. Transfira os arquivos para a VPS
3. Execute os scripts de adaptação e importação

---

**Nota**: A senha do PostgreSQL foi salva com segurança. Você pode usar qualquer uma das opções acima para exportar os dados.
