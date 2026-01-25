# 🚨 URGENTE - Configurações de Segurança

**Data**: 12 de Janeiro de 2026  
**Prioridade**: 🔴 **CRÍTICA**

---

## ⚠️ AÇÕES URGENTES NECESSÁRIAS

### 1. Alterar Senha do PostgreSQL

**Status Atual**: Senha temporária `temp_password_change_me_123!`

**Ação Necessária**:
```bash
# 1. Gerar senha segura
openssl rand -base64 24

# 2. Alterar senha no PostgreSQL
sudo -u postgres psql
ALTER USER app_user WITH PASSWORD 'nova_senha_gerada_aqui';
\q

# 3. Atualizar .env do servidor
sudo nano /var/www/blackhouse/server/.env
# Alterar DB_PASSWORD=nova_senha_gerada_aqui

# 4. Reiniciar API
sudo systemctl restart blackhouse-api
```

---

### 2. Gerar JWT_SECRET Seguro

**Status Atual**: Valor temporário `change_this_to_a_very_long_and_secure_random_string...`

**Ação Necessária**:
```bash
# Gerar JWT_SECRET seguro (32+ caracteres)
openssl rand -base64 32
# Exemplo gerado: rTocb8P/nWcIFTq34AvQ9mw5o32NVucox87VM5qb7RI=

# Atualizar .env do servidor
sudo nano /var/www/blackhouse/server/.env
# Alterar JWT_SECRET=valor_gerado_aqui

# Reiniciar API
sudo systemctl restart blackhouse-api
```

---

### 3. Atualizar .env do Servidor

**Arquivo**: `/var/www/blackhouse/server/.env`

**Valores que DEVEM ser alterados**:
```env
DB_PASSWORD=nova_senha_segura_gerada
JWT_SECRET=jwt_secret_seguro_gerado_32_caracteres_minimo
```

**Valores que podem ser mantidos**:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=blackhouse_db
DB_USER=app_user
FRONTEND_URL=http://blackhouse.app.br
PORT=3001
NODE_ENV=production
```

---

## 🔐 Boas Práticas de Segurança

### Senhas
- ✅ Mínimo 24 caracteres
- ✅ Mistura de letras, números e símbolos
- ✅ Não usar palavras comuns
- ✅ Não compartilhar ou versionar

### JWT_SECRET
- ✅ Mínimo 32 caracteres
- ✅ Gerado aleatoriamente
- ✅ Único por ambiente
- ✅ Nunca versionar no Git

### PostgreSQL
- ✅ Usuário com permissões mínimas necessárias
- ✅ Senha forte
- ✅ Não expor porta 5432 publicamente
- ✅ Firewall configurado

---

## 📋 Checklist de Segurança

- [ ] Senha do PostgreSQL alterada
- [ ] JWT_SECRET gerado e configurado
- [ ] .env atualizado com novas credenciais
- [ ] API reiniciada após mudanças
- [ ] Testado que API ainda funciona
- [ ] Credenciais antigas removidas de logs/histórico
- [ ] Backup das novas credenciais em local seguro

---

## 🚨 Riscos de Não Fazer

### Se não alterar:
- ❌ Servidor vulnerável a ataques
- ❌ Tokens JWT podem ser forjados
- ❌ Banco de dados pode ser acessado por terceiros
- ❌ Dados sensíveis em risco

---

## 📝 Comandos Rápidos

### Gerar Credenciais Seguras

```bash
# Senha PostgreSQL (24 caracteres)
openssl rand -base64 24

# JWT_SECRET (32 caracteres)
openssl rand -base64 32
```

### Atualizar Tudo de Uma Vez

```bash
# 1. Gerar credenciais
PG_PASSWORD=$(openssl rand -base64 24)
JWT_SECRET=$(openssl rand -base64 32)

# 2. Alterar no PostgreSQL
sudo -u postgres psql -c "ALTER USER app_user WITH PASSWORD '$PG_PASSWORD';"

# 3. Atualizar .env
sudo bash -c "cat >> /var/www/blackhouse/server/.env.new << EOF
DB_PASSWORD=$PG_PASSWORD
JWT_SECRET=$JWT_SECRET
EOF"

# 4. Fazer backup do .env antigo
sudo cp /var/www/blackhouse/server/.env /var/www/blackhouse/server/.env.backup

# 5. Substituir .env
sudo mv /var/www/blackhouse/server/.env.new /var/www/blackhouse/server/.env

# 6. Reiniciar API
sudo systemctl restart blackhouse-api

# 7. Testar
curl http://localhost:3001/health
```

---

**Última atualização**: 12 de Janeiro de 2026  
**Status**: ⚠️ **AÇÃO URGENTE NECESSÁRIA**
