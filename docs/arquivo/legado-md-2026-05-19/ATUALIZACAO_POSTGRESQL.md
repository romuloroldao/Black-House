# ✅ Atualização do PostgreSQL Concluída

## Resumo da Atualização

**Data**: 12 de Janeiro de 2026  
**Versão Anterior**: PostgreSQL 12.22  
**Versão Atual**: PostgreSQL 15.13  
**Status**: ✅ **CONCLUÍDA COM SUCESSO**

---

## O Que Foi Feito

### 1. Identificação da Situação
- PostgreSQL 12 estava rodando na porta 5432
- PostgreSQL 15 já estava instalado e rodando na porta 5433
- Banco de dados `blackhouse_db` estava no PostgreSQL 12

### 2. Migração dos Dados
- ✅ Backup completo do banco `blackhouse_db` do PostgreSQL 12
- ✅ Criação do usuário `app_user` no PostgreSQL 15
- ✅ Criação do banco `blackhouse_db` no PostgreSQL 15
- ✅ Instalação das extensões necessárias (`uuid-ossp`, `pgcrypto`)
- ✅ Restauração completa dos dados no PostgreSQL 15

### 3. Configuração
- ✅ PostgreSQL 12 desabilitado e parado
- ✅ PostgreSQL 15 configurado para usar porta 5432 (padrão)
- ✅ API reiniciada e testada
- ✅ Conexão verificada

---

## Status Atual

### PostgreSQL
```
Versão: PostgreSQL 15.13
Porta: 5432
Status: ✅ Rodando
Cluster: postgresql@15-main
```

### Banco de Dados
```
Nome: blackhouse_db
Usuário: app_user
Schemas: app_auth, public
Tabelas migradas: ✅
```

### API
```
Status: ✅ Rodando
Porta: 3001
Conexão com banco: ✅ Funcionando
Health check: ✅ OK
```

---

## Verificações Realizadas

### ✅ Versão do PostgreSQL
```bash
psql --version
# psql (PostgreSQL) 15.13
```

### ✅ Conexão ao Banco
```bash
sudo -u postgres psql -p 5432 -d blackhouse_db -c "SELECT version();"
# PostgreSQL 15.13
```

### ✅ Tabelas Migradas
- `app_auth.users` ✅
- `app_auth.sessions` ✅
- `public.user_roles` ✅

### ✅ API Funcionando
```bash
curl http://localhost:3001/health
# {"status":"ok","timestamp":"..."}
```

---

## Comandos Úteis

### Verificar Status do PostgreSQL
```bash
sudo systemctl status postgresql@15-main
```

### Conectar ao Banco
```bash
sudo -u postgres psql -p 5432 -d blackhouse_db
```

### Ver Logs do PostgreSQL
```bash
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### Verificar Versão
```bash
sudo -u postgres psql -p 5432 -c "SELECT version();"
```

---

## Limpeza (Opcional)

Se quiser remover o PostgreSQL 12 para liberar espaço:

```bash
# ⚠️ ATENÇÃO: Certifique-se de que a migração foi bem-sucedida antes!

# Parar e desabilitar (já feito)
sudo systemctl stop postgresql@12-main
sudo systemctl disable postgresql@12-main

# Remover pacotes (opcional)
# sudo apt remove --purge postgresql-12 postgresql-client-12

# Remover dados (opcional - muito cuidado!)
# sudo rm -rf /var/lib/postgresql/12
```

---

## Próximos Passos

1. ✅ PostgreSQL atualizado para versão 15
2. ⏳ Importar schema completo das tabelas públicas (usar `schema_adaptado_postgres.sql`)
3. ⏳ Importar dados do Supabase
4. ⏳ Configurar DNS
5. ⏳ Configurar SSL

---

## Notas Importantes

- ✅ Todos os dados foram preservados na migração
- ✅ A API continua funcionando normalmente
- ✅ O PostgreSQL 12 foi desabilitado mas não removido (pode ser removido depois)
- ✅ A porta padrão (5432) está sendo usada pelo PostgreSQL 15
- ✅ Extensões necessárias foram instaladas

---

## Backup

O dump do banco foi salvo em:
```
/tmp/pg_migration/blackhouse_db.dump
```

**Recomendação**: Mover este arquivo para um local permanente ou fazer backup adicional antes de remover o PostgreSQL 12.

---

**Última atualização**: 12 de Janeiro de 2026  
**Status**: ✅ Migração concluída com sucesso
