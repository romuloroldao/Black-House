# ⚡ Solução Rápida - Problema IPv6

## 🔍 Diagnóstico Confirmado

**Problema**: A VPS não tem IPv6 global configurado. O provedor (KingHost) não fornece IPv6 público.

**Resultado**: Não consegue conectar ao Supabase que está apenas em IPv6.

## ✅ Solução Mais Rápida: Túnel SSH

### Do Seu Computador Local

Seu computador provavelmente tem acesso ao Supabase. Use um túnel SSH:

```bash
# No seu computador local
# Criar túnel SSH que redireciona porta local para Supabase
ssh -L 5433:db.cghzttbggklhuyqxzabq.supabase.co:5432 root@177.153.64.95 -N -f

# O túnel ficará rodando em background
# Agora você pode conectar via localhost:5433 na VPS
```

### Na VPS - Conectar via Túnel

```bash
# Na VPS, conectar via localhost (que passa pelo túnel SSH)
export SUPABASE_PASSWORD='RR0ld40.864050!'

# Exportar schema
pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@localhost:5433/postgres" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --exclude-schema=auth \
  --exclude-schema=storage \
  --exclude-schema=supabase_functions \
  --exclude-schema=realtime \
  --exclude-schema=vault \
  > backup/schema_public.sql

# Exportar dados
pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@localhost:5433/postgres" \
  --data-only \
  --no-owner \
  --no-privileges \
  --exclude-schema=auth \
  --exclude-schema=storage \
  > backup/data.sql
```

### Parar o Túnel

```bash
# No seu computador local
pkill -f "ssh.*5433.*177.153.64.95"
```

## ✅ Solução Alternativa: Exportar Localmente

Se o túnel SSH não funcionar, exporte no seu computador:

```bash
# No seu computador local
export SUPABASE_PASSWORD='RR0ld40.864050!'

# Exportar
pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@db.cghzttbggklhuyqxzabq.supabase.co:5432/postgres" \
  --schema-only \
  --exclude-schema=auth \
  --exclude-schema=storage \
  > schema_public.sql

pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@db.cghzttbggklhuyqxzabq.supabase.co:5432/postgres" \
  --data-only \
  --exclude-schema=auth \
  --exclude-schema=storage \
  > data.sql

# Transferir para VPS
scp schema_public.sql data.sql root@177.153.64.95:/root/backup/
```

## 🔧 Solução Permanente: Configurar Túnel IPv6

Se quiser resolver permanentemente o problema de IPv6:

### Hurricane Electric TunnelBroker (Gratuito)

1. Acesse: https://tunnelbroker.net/
2. Crie conta gratuita
3. Crie um túnel IPv6
4. Configure na VPS:

```bash
# Exemplo (substitua pelos valores do seu túnel)
sudo ip tunnel add he-ipv6 mode sit remote [IP_REMOTO] local 177.153.64.95 ttl 255
sudo ip link set he-ipv6 up
sudo ip addr add [IPV6_DELEGADO] dev he-ipv6
sudo ip route add ::/0 dev he-ipv6
```

## 📋 Recomendação

**Use a Solução do Túnel SSH** - É a mais rápida e não requer configuração adicional:

1. No seu computador: `ssh -L 5433:db.cghzttbggklhuyqxzabq.supabase.co:5432 root@177.153.64.95 -N -f`
2. Na VPS: Conectar via `localhost:5433` ao invés de `db.cghzttbggklhuyqxzabq.supabase.co:5432`

---

**Resumo**: O IPv6 não funciona porque o provedor não fornece. Use túnel SSH ou exporte localmente.
