# 🔧 Solução para Problema de Conectividade IPv6

## 🔍 Diagnóstico

O Supabase está retornando apenas endereço IPv6 (`2600:1f1e:75b:4b16:e112:cdb9:1232:998e`), mas a VPS não tem conectividade IPv6 configurada ou habilitada.

## ✅ Soluções Possíveis

### Opção 1: Habilitar IPv6 na VPS (Se o Provedor Suportar)

#### Verificar se o Provedor Oferece IPv6

```bash
# Verificar se há suporte IPv6
ip -6 addr show

# Verificar gateway IPv6
ip -6 route show
```

#### Se o Provedor Oferecer IPv6:

1. **Configurar IPv6** (depende do provedor - KingHost, DigitalOcean, AWS, etc.)
2. **Habilitar IPv6 no sistema:**
   ```bash
   # Verificar se está desabilitado
   cat /proc/sys/net/ipv6/conf/all/disable_ipv6
   # Se retornar 1, está desabilitado
   
   # Habilitar (temporário)
   sudo sysctl -w net.ipv6.conf.all.disable_ipv6=0
   
   # Habilitar permanentemente
   echo "net.ipv6.conf.all.disable_ipv6=0" | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

3. **Configurar endereço IPv6** (consulte documentação do seu provedor VPS)

### Opção 2: Usar Túnel IPv6 (Se Provedor Não Oferecer)

#### Hurricane Electric (TunnelBroker) - Gratuito

1. Acesse: https://tunnelbroker.net/
2. Crie uma conta gratuita
3. Crie um túnel IPv6
4. Configure na VPS seguindo as instruções do site

#### Configuração Básica do Túnel:

```bash
# Exemplo (substitua pelos valores do seu túnel)
sudo ip tunnel add he-ipv6 mode sit remote [IP_REMOTO] local [SEU_IP] ttl 255
sudo ip link set he-ipv6 up
sudo ip addr add [IPV6_DELEGADO] dev he-ipv6
sudo ip route add ::/0 dev he-ipv6
```

### Opção 3: Usar Proxy/Túnel SSH (Solução Rápida)

#### Criar Túnel SSH do Seu Computador

No seu computador local (que tem IPv6 ou acesso ao Supabase):

```bash
# Criar túnel SSH que redireciona porta local para Supabase
ssh -L 5433:db.cghzttbggklhuyqxzabq.supabase.co:5432 root@177.153.64.95 -N

# Em outro terminal, na VPS, conectar via localhost
export SUPABASE_PASSWORD='RR0ld40.864050!'
pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@localhost:5433/postgres" \
  --schema-only > backup/schema_public.sql
```

### Opção 4: Usar Proxy HTTP/HTTPS (Alternativa)

#### Instalar e Configurar Proxy

```bash
# Instalar squid ou outro proxy
sudo apt-get install -y squid

# Configurar (exemplo básico)
# Editar /etc/squid/squid.conf conforme necessário
```

### Opção 5: Solicitar IPv4 do Supabase (Não Recomendado)

O Supabase pode não oferecer IPv4 diretamente. Você pode:
- Verificar se há connection pooling que use IPv4
- Usar Supabase CLI que pode ter workarounds

### Opção 6: Exportar Localmente (Mais Prático)

**Esta é a solução mais simples e recomendada:**

1. Exporte no seu computador local (que tem acesso)
2. Transfira os arquivos para a VPS
3. Importe na VPS

Veja: `INSTRUCOES_EXPORTACAO_ALTERNATIVA.md`

## 🔍 Verificar Conectividade IPv6

### Teste 1: Verificar se IPv6 está habilitado

```bash
cat /proc/sys/net/ipv6/conf/all/disable_ipv6
# 0 = habilitado, 1 = desabilitado
```

### Teste 2: Verificar se há endereço IPv6

```bash
ip -6 addr show
```

### Teste 3: Testar conectividade IPv6

```bash
ping6 -c 2 2001:4860:4860::8888  # Google DNS IPv6
```

### Teste 4: Testar conexão com Supabase via IPv6

```bash
ping6 -c 2 2600:1f1e:75b:4b16:e112:cdb9:1232:998e
```

## 📋 Checklist de Solução

- [ ] Verificar se provedor VPS oferece IPv6
- [ ] Se sim, configurar IPv6
- [ ] Se não, usar túnel IPv6 (Hurricane Electric)
- [ ] Ou usar túnel SSH do computador local
- [ ] Ou exportar localmente e transferir (mais simples)

## 🎯 Recomendação

**Para resolver rapidamente**, use a **Opção 6** (exportar localmente):

1. No seu computador local:
   ```bash
   export SUPABASE_PASSWORD='RR0ld40.864050!'
   pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@db.cghzttbggklhuyqxzabq.supabase.co:5432/postgres" \
     --schema-only --exclude-schema=auth --exclude-schema=storage > schema_public.sql
   ```

2. Transferir para VPS:
   ```bash
   scp schema_public.sql root@177.153.64.95:/root/backup/
   ```

3. Na VPS, importar:
   ```bash
   ./scripts/preparar-importacao.sh
   ./scripts/importar-dados.sh
   ```

## 🔧 Se Quiser Habilitar IPv6 Permanente

Consulte a documentação do seu provedor VPS:
- **KingHost**: Entre em contato com suporte
- **DigitalOcean**: Já oferece IPv6 por padrão
- **AWS**: Configure via console
- **Outros**: Consulte documentação específica

---

**Resumo**: O problema é que a VPS não tem IPv6. A solução mais rápida é exportar localmente e transferir os arquivos.
