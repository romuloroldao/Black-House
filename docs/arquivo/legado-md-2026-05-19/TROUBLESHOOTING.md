# Troubleshooting - Guia de Solução de Problemas

## Problemas Comuns e Soluções

### 1. Erro de Conexão com PostgreSQL

**Sintoma:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Soluções:**
```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql

# Iniciar PostgreSQL
sudo systemctl start postgresql

# Verificar configuração de conexão no server/.env
DB_HOST=localhost
DB_PORT=5432
```

### 2. Erro de Autenticação no PostgreSQL

**Sintoma:**
```
Error: password authentication failed for user "app_user"
```

**Soluções:**
```bash
# Verificar senha no .env
# Resetar senha do usuário
sudo -u postgres psql
ALTER USER app_user WITH PASSWORD 'nova_senha';
\q

# Atualizar server/.env com a nova senha
```

### 3. Erro "relation does not exist"

**Sintoma:**
```
Error: relation "app_auth.users" does not exist
```

**Soluções:**
```bash
# Verificar se a migração foi executada
psql -U app_user -d blackhouse_db -c "\dt app_auth.*"

# Executar migração novamente
psql -U app_user -d blackhouse_db -f migration/migration_postgres.sql
```

### 4. Erro de Token JWT Inválido

**Sintoma:**
```
Error: Token inválido
```

**Soluções:**
```bash
# Verificar JWT_SECRET no server/.env
# Deve ter pelo menos 32 caracteres
JWT_SECRET=sua_chave_jwt_super_secreta_minimo_32_caracteres

# Limpar token no frontend e fazer login novamente
localStorage.removeItem('auth_token')
```

### 5. Erro 401 Unauthorized

**Sintoma:**
```
401 Unauthorized em todas as requisições
```

**Soluções:**
- Verificar se o token está sendo enviado no header
- Verificar se o token não expirou (expira em 7 dias)
- Verificar se JWT_SECRET está correto
- Fazer logout e login novamente

### 6. Erro ao Fazer Upload de Arquivos

**Sintoma:**
```
Error: ENOENT: no such file or directory
```

**Soluções:**
```bash
# Criar diretórios de storage
mkdir -p server/storage/progress-photos
mkdir -p server/storage/avatars

# Dar permissões
chown -R www-data:www-data server/storage
chmod -R 755 server/storage
```

### 7. API não Inicia

**Sintoma:**
```
Error: Cannot find module 'express'
```

**Soluções:**
```bash
cd server
npm install
```

### 8. Nginx retorna 502 Bad Gateway

**Sintoma:**
```
502 Bad Gateway ao acessar API
```

**Soluções:**
```bash
# Verificar se a API está rodando
sudo systemctl status blackhouse-api

# Verificar logs
sudo journalctl -u blackhouse-api -n 50

# Verificar se a porta está correta no nginx.conf
# Deve apontar para localhost:3001 (ou porta configurada)
```

### 9. Erro ao Importar Schema

**Sintoma:**
```
ERROR: relation "auth.users" does not exist
```

**Soluções:**
```bash
# Adaptar schema antes de importar
./scripts/adapt-schema.sh backup/schema_public.sql backup/schema_public_adapted.sql

# Revisar arquivo adaptado
# Importar arquivo adaptado
psql -U app_user -d blackhouse_db -f backup/schema_public_adapted.sql
```

### 10. Erro de Permissão no Banco

**Sintoma:**
```
ERROR: permission denied for schema app_auth
```

**Soluções:**
```bash
# Dar permissões ao usuário
sudo -u postgres psql -d blackhouse_db
GRANT ALL ON SCHEMA app_auth TO app_user;
GRANT ALL ON ALL TABLES IN SCHEMA app_auth TO app_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA app_auth TO app_user;
\q
```

### 11. Frontend não Conecta com API

**Sintoma:**
```
CORS error ou Network error
```

**Soluções:**
```bash
# Verificar FRONTEND_URL no server/.env
FRONTEND_URL=https://seudominio.com

# Para desenvolvimento local:
FRONTEND_URL=http://localhost:5173

# Reiniciar API
sudo systemctl restart blackhouse-api
```

### 12. Backup não Funciona

**Sintoma:**
```
pg_dump: error: connection to server failed
```

**Soluções:**
```bash
# Verificar variáveis de ambiente no script
export DB_PASSWORD=sua_senha

# Ou editar o script para usar .pgpass
# Criar ~/.pgpass
echo "localhost:5432:blackhouse_db:app_user:senha" > ~/.pgpass
chmod 600 ~/.pgpass
```

### 13. Sessões não Expirando

**Sintoma:**
```
Sessões antigas ainda funcionam
```

**Soluções:**
```bash
# Executar limpeza manual
./scripts/cleanup-sessions.sh

# Configurar cron para limpeza automática
crontab -e
# Adicionar: 0 3 * * * /root/scripts/cleanup-sessions.sh
```

### 14. Erro ao Criar Usuário

**Sintoma:**
```
Error: Email já cadastrado (mas não está)
```

**Soluções:**
```bash
# Verificar se há usuários duplicados
psql -U app_user -d blackhouse_db -c "SELECT email, COUNT(*) FROM app_auth.users GROUP BY email HAVING COUNT(*) > 1;"

# Limpar duplicatas se necessário
```

### 15. Performance Lenta

**Sintoma:**
```
Queries muito lentas
```

**Soluções:**
```bash
# Verificar índices
psql -U app_user -d blackhouse_db -c "\d+ tabela"

# Criar índices se necessário
CREATE INDEX idx_tabela_campo ON public.tabela(campo);

# Analisar queries lentas
# Ativar log de queries lentas no postgresql.conf
```

## Verificação de Saúde do Sistema

### Checklist Rápido

```bash
# 1. PostgreSQL rodando?
sudo systemctl status postgresql

# 2. API rodando?
sudo systemctl status blackhouse-api

# 3. Nginx rodando?
sudo systemctl status nginx

# 4. Conexão com banco?
psql -U app_user -d blackhouse_db -c "SELECT 1;"

# 5. API respondendo?
curl http://localhost:3001/health

# 6. Logs sem erros?
sudo journalctl -u blackhouse-api -n 20
```

## Logs Importantes

### PostgreSQL
```bash
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### API
```bash
sudo journalctl -u blackhouse-api -f
```

### Nginx
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## Comandos Úteis

```bash
# Reiniciar todos os serviços
sudo systemctl restart postgresql blackhouse-api nginx

# Verificar portas em uso
sudo netstat -tulpn | grep -E '5432|3001|80|443'

# Verificar espaço em disco
df -h

# Verificar memória
free -h

# Verificar processos Node
ps aux | grep node
```

## Suporte Adicional

Se os problemas persistirem:

1. Verifique todos os logs
2. Confirme todas as variáveis de ambiente
3. Teste cada componente isoladamente
4. Verifique firewall e permissões
5. Consulte a documentação do PostgreSQL e Node.js
