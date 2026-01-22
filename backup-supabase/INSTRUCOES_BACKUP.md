# 📦 Instruções para Backup do Supabase

## ❌ Problema Identificado

O servidor **NÃO tem conectividade IPv6 habilitada**, e o hostname `db.cghzttbggklhuyqxzabq.supabase.co` resolve apenas para IPv6:

```
IPv6: 2600:1f1e:75b:4b16:e112:cdb9:1232:998e
IPv4: Nenhum registro A encontrado
```

Isso impede a conexão direta via `pg_dump`/`psql` usando o hostname direto.

## ✅ Soluções Alternativas

### Solução 1: Usar Supabase CLI (RECOMENDADO)

O Supabase CLI é a forma mais fácil e confiável de fazer backup:

```bash
# Instalar Supabase CLI
npm install -g supabase

# Fazer login
supabase login

# Fazer backup completo
npx supabase db dump \
  --project-ref cghzttbggklhuyqxzabq \
  --password "RR0ld40.864050!" \
  --schema public \
  --schema storage \
  --schema auth \
  --file backup_completo.sql

# Ou usando formato custom
npx supabase db dump \
  --project-ref cghzttbggklhuyqxzabq \
  --password "RR0ld40.864050!" \
  --format custom \
  --file backup_completo.dump
```

### Solução 2: Habilitar IPv6 no Servidor

Se você tiver acesso de administrador e quiser habilitar IPv6:

```bash
# Verificar se IPv6 está desabilitado
sysctl net.ipv6.conf.all.disable_ipv6

# Habilitar IPv6 (se necessário)
sudo sysctl -w net.ipv6.conf.all.disable_ipv6=0
sudo sysctl -w net.ipv6.conf.default.disable_ipv6=0

# Tornar permanente (adicionar ao /etc/sysctl.conf)
echo "net.ipv6.conf.all.disable_ipv6 = 0" | sudo tee -a /etc/sysctl.conf
echo "net.ipv6.conf.default.disable_ipv6 = 0" | sudo tee -a /etc/sysctl.conf

# Reiniciar rede ou servidor
sudo systemctl restart networking  # ou reiniciar servidor
```

Depois disso, execute novamente:
```bash
/root/backup-supabase/backup-supabase.sh
```

### Solução 3: Fazer Backup de Outra Máquina

Execute o backup de uma máquina que tenha IPv6 habilitado ou que tenha acesso ao Supabase.

**Script pronto para copiar:**
```bash
# Em outra máquina com acesso, execute:
mkdir -p ~/backup-supabase
cd ~/backup-supabase

# Copiar certificado e script
scp root@seu-vps:/root/backup-supabase/supabase-root.crt ./
scp root@seu-vps:/root/backup-supabase/backup-supabase.sh ./

# Executar backup
chmod +x backup-supabase.sh
./backup-supabase.sh
```

### Solução 4: Usar Pooler do Supabase (se configurado)

Se você tiver acesso ao pooler e ele funcionar:

```bash
cd /root/backup-supabase

PGPASSWORD='RR0ld40.864050!' pg_dump \
  "postgresql://postgres.cghzttbggklhuyqxzabq:RR0ld40.864050!@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require&sslrootcert=/root/backup-supabase/supabase-root.crt" \
  --no-owner \
  --no-acl \
  --schema=public \
  --schema=storage \
  --schema=auth \
  -F c \
  -f backup_completo.dump
```

**Nota:** O pooler pode não estar configurado corretamente para conexões externas ou pode requerer autenticação diferente.

### Solução 5: Backup pelo Painel do Supabase

1. Acesse: https://app.supabase.com/project/cghzttbggklhuyqxzabq
2. Vá em **Database** → **Backups**
3. Clique em **Download** ou **Export**
4. Escolha os schemas: `public`, `storage`, `auth`

## 📋 Informações de Conexão

### Conexão Direta (não funciona sem IPv6)
```
Host: db.cghzttbggklhuyqxzabq.supabase.co
Port: 5432
Database: postgres
User: postgres
Password: RR0ld40.864050!
SSL: Requerido
Certificado: /root/backup-supabase/supabase-root.crt
```

### Pooler (pode não funcionar)
```
Host: aws-0-sa-east-1.pooler.supabase.com
Port: 6543
Database: postgres
User: postgres.cghzttbggklhuyqxzabq (ou apenas postgres)
Password: RR0ld40.864050!
SSL: Requerido
Certificado: /root/backup-supabase/supabase-root.crt
```

### Supabase CLI
```
Project Ref: cghzttbggklhuyqxzabq
Password: RR0ld40.864050!
```

## 🔧 Script Preparado

Um script automático foi criado em:
```bash
/root/backup-supabase/backup-supabase.sh
```

Este script tenta múltiplas formas de conexão automaticamente.

**Executar:**
```bash
/root/backup-supabase/backup-supabase.sh
```

## ✅ Recomendação Final

**Use a Solução 1 (Supabase CLI)** - É a mais confiável e fácil:

```bash
# Instalar
npm install -g supabase

# Fazer backup
npx supabase db dump \
  --project-ref cghzttbggklhuyqxzabq \
  --password "RR0ld40.864050!" \
  --schema public \
  --schema storage \
  --schema auth \
  --format custom \
  --file /root/backup-supabase/backup_completo_$(date +%Y%m%d_%H%M%S).dump
```

## 📂 Arquivos Preparados

Todos os arquivos necessários estão em `/root/backup-supabase/`:

- ✅ `supabase-root.crt` - Certificado SSL
- ✅ `backup-supabase.sh` - Script de backup automático
- ✅ `INSTRUCOES_BACKUP.md` - Este arquivo

---

**Data:** $(date)
**Status:** ⚠️ Aguardando solução para conectividade IPv6 ou uso de Supabase CLI
