# ✅ Tarefas que Podem Ser Feitas Sem o Banco de Dados

## 🎯 Resumo

Você pode fazer várias tarefas importantes **sem precisar do banco de dados exportado**. Isso vai acelerar o processo quando os dados estiverem prontos.

---

## ✅ Tarefas Disponíveis Agora

### 1. Clonar Repositório do GitHub ⭐

```bash
cd /root
git clone https://github.com/romuloroldao/Black-House.git
cd Black-House
npm install
```

**Status**: Pode ser feito agora  
**Tempo estimado**: 5-10 minutos

---

### 2. Adaptar Frontend para Nova API ⭐⭐⭐

Esta é a tarefa mais importante e pode ser feita agora!

#### 2.1. Copiar api-client.ts

```bash
cd /root/Black-House
mkdir -p src/lib
cp /root/src/lib/api-client.ts src/lib/api-client.ts
```

#### 2.2. Substituir Importações do Supabase

Siga o guia: `ADAPTACAO_FRONTEND.md`

Principais mudanças:
- `import { createClient } from '@supabase/supabase-js'` 
  → `import { apiClient } from './lib/api-client'`
- `supabase.auth.signUp()` → `apiClient.signUp()`
- `supabase.from('tabela')` → `apiClient.from('tabela')`
- `supabase.storage` → `apiClient.uploadFile()`

#### 2.3. Atualizar Variáveis de Ambiente

```bash
cd /root/Black-House
cat > .env << 'EOF'
VITE_API_URL=https://api.blackhouse.app.br
EOF
```

**Status**: Pode ser feito agora  
**Tempo estimado**: 30-60 minutos (depende do tamanho do código)

---

### 3. Configurar Variáveis de Ambiente

#### Frontend (.env)
```bash
cd /root/Black-House
echo "VITE_API_URL=https://api.blackhouse.app.br" > .env
```

#### Backend (já feito, mas pode melhorar)
```bash
# Editar /var/www/blackhouse/server/.env
sudo nano /var/www/blackhouse/server/.env
```

**Status**: Pode ser feito agora  
**Tempo estimado**: 5 minutos

---

### 4. Fazer Build do Frontend

```bash
cd /root/Black-House
npm run build

# Copiar para diretório do Nginx
sudo cp -r dist/* /var/www/blackhouse/dist/
sudo chown -R www-data:www-data /var/www/blackhouse/dist
```

**Status**: Pode ser feito agora (após adaptar código)  
**Tempo estimado**: 5-10 minutos

---

### 5. Alterar Credenciais de Produção ⭐

**IMPORTANTE**: As credenciais atuais são temporárias!

#### 5.1. Gerar Senha Segura para PostgreSQL

```bash
# Gerar senha aleatória
openssl rand -base64 32
```

#### 5.2. Alterar Senha do PostgreSQL

```bash
# Gerar nova senha
NOVA_SENHA=$(openssl rand -base64 32)
echo "Nova senha: $NOVA_SENHA"

# Alterar no PostgreSQL
sudo -u postgres psql << EOF
ALTER USER app_user WITH PASSWORD '$NOVA_SENHA';
\q
EOF
```

#### 5.3. Gerar JWT_SECRET Seguro

```bash
# Gerar JWT secret (mínimo 32 caracteres)
openssl rand -hex 32
```

#### 5.4. Atualizar .env da API

```bash
sudo nano /var/www/blackhouse/server/.env
```

Alterar:
```
DB_PASSWORD=nova_senha_gerada_aqui
JWT_SECRET=jwt_secret_gerado_aqui
FRONTEND_URL=https://blackhouse.app.br
NODE_ENV=production
```

#### 5.5. Reiniciar API

```bash
sudo systemctl restart blackhouse-api
```

**Status**: Pode ser feito agora  
**Tempo estimado**: 10 minutos

---

### 6. Configurar Backup Automático no Crontab

```bash
# Editar crontab
crontab -e

# Adicionar linha (backup diário às 2h da manhã):
0 2 * * * DB_PASSWORD=$(grep DB_PASSWORD /var/www/blackhouse/server/.env | cut -d '=' -f2) /usr/local/bin/backup-db.sh >> /var/log/backup-db.log 2>&1
```

**Status**: Pode ser feito agora  
**Tempo estimado**: 2 minutos

---

### 7. Preparar Estrutura de Deploy

#### 7.1. Verificar Diretórios

```bash
sudo mkdir -p /var/www/blackhouse/{dist,server/storage}
sudo chown -R www-data:www-data /var/www/blackhouse
```

#### 7.2. Verificar Permissões

```bash
sudo chmod -R 755 /var/www/blackhouse
sudo chmod -R 775 /var/www/blackhouse/server/storage
```

**Status**: Pode ser feito agora  
**Tempo estimado**: 2 minutos

---

### 8. Testar API Localmente

```bash
# Verificar se API está rodando
curl http://localhost:3001/health

# Testar endpoint de autenticação (sem dados ainda)
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@teste.com","password":"senha123"}'
```

**Status**: Pode ser feito agora  
**Tempo estimado**: 5 minutos

---

### 9. Documentar Estrutura do Projeto

Criar documentação sobre:
- Estrutura de pastas
- Como adicionar novas rotas
- Como fazer deploy
- Troubleshooting

**Status**: Pode ser feito agora  
**Tempo estimado**: 15 minutos

---

### 10. Configurar Monitoramento Básico

```bash
# Criar script de monitoramento
cat > /root/scripts/check-services.sh << 'EOF'
#!/bin/bash
echo "=== Status dos Serviços ==="
systemctl is-active postgresql && echo "✅ PostgreSQL" || echo "❌ PostgreSQL"
systemctl is-active blackhouse-api && echo "✅ API" || echo "❌ API"
systemctl is-active nginx && echo "✅ Nginx" || echo "❌ Nginx"
EOF

chmod +x /root/scripts/check-services.sh
```

**Status**: Pode ser feito agora  
**Tempo estimado**: 5 minutos

---

## 📋 Ordem Recomendada de Execução

1. **Clonar repositório** (5 min)
2. **Adaptar frontend** (30-60 min) ⭐ Mais importante
3. **Alterar credenciais** (10 min) ⭐ Importante
4. **Configurar variáveis de ambiente** (5 min)
5. **Fazer build do frontend** (5-10 min)
6. **Configurar backup automático** (2 min)
7. **Preparar estrutura** (2 min)
8. **Testar API** (5 min)

**Total**: ~1-2 horas de trabalho que pode ser feito agora!

---

## ⏳ Tarefas que Ainda Aguardam

- ❌ Exportar dados do Supabase (problema IPv6)
- ❌ Importar dados no PostgreSQL
- ❌ Configurar SSL (aguarda DNS propagar)
- ❌ Teste completo com dados reais

---

## 🚀 Script Rápido para Começar

```bash
#!/bin/bash
# Executar tarefas que não precisam do banco

# 1. Clonar repositório
cd /root
git clone https://github.com/romuloroldao/Black-House.git
cd Black-House
npm install

# 2. Copiar api-client
mkdir -p src/lib
cp /root/src/lib/api-client.ts src/lib/api-client.ts

# 3. Configurar .env
echo "VITE_API_URL=https://api.blackhouse.app.br" > .env

# 4. Alterar credenciais (gerar novas)
NOVA_SENHA_DB=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -hex 32)

echo "Nova senha DB: $NOVA_SENHA_DB"
echo "JWT Secret: $JWT_SECRET"
echo ""
echo "Atualize /var/www/blackhouse/server/.env com essas credenciais"
```

---

## ✅ Checklist

- [ ] Repositório clonado
- [ ] Frontend adaptado (Supabase → apiClient)
- [ ] Variáveis de ambiente configuradas
- [ ] Credenciais alteradas
- [ ] Build do frontend feito
- [ ] Backup automático configurado
- [ ] Estrutura de deploy preparada
- [ ] API testada localmente

---

**Resumo**: Você pode fazer ~80% do trabalho agora! A parte mais importante é adaptar o frontend, que não depende do banco de dados.
