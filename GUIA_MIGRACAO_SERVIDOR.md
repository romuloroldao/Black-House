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
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
cd SEU_REPOSITORIO

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

### 4.1 Criar script de migração

O Supabase usa schemas e funções especiais. Precisamos adaptar:

```bash
nano migration_postgres.sql
```

```sql
-- =============================================
-- MIGRAÇÃO PARA POSTGRESQL PURO
-- =============================================

-- Criar schema para usuários
CREATE SCHEMA IF NOT EXISTS app_auth;

-- Tabela de usuários (substituindo auth.users do Supabase)
CREATE TABLE app_auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    email_confirmed_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb
);

-- Tabela de sessões
CREATE TABLE app_auth.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES app_auth.users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_sessions_user_id ON app_auth.sessions(user_id);
CREATE INDEX idx_sessions_token ON app_auth.sessions(token);
CREATE INDEX idx_sessions_expires ON app_auth.sessions(expires_at);

-- Função para hash de senha
CREATE OR REPLACE FUNCTION app_auth.hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN crypt(password, gen_salt('bf', 10));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar senha
CREATE OR REPLACE FUNCTION app_auth.verify_password(password TEXT, hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN hash = crypt(password, hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar usuário
CREATE OR REPLACE FUNCTION app_auth.create_user(
    p_email TEXT,
    p_password TEXT
)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    INSERT INTO app_auth.users (email, password_hash)
    VALUES (LOWER(p_email), app_auth.hash_password(p_password))
    RETURNING id INTO new_user_id;
    
    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para login
CREATE OR REPLACE FUNCTION app_auth.login(
    p_email TEXT,
    p_password TEXT
)
RETURNS TABLE(user_id UUID, session_token TEXT) AS $$
DECLARE
    v_user_id UUID;
    v_password_hash TEXT;
    v_token TEXT;
BEGIN
    SELECT id, password_hash INTO v_user_id, v_password_hash
    FROM app_auth.users
    WHERE email = LOWER(p_email);
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não encontrado';
    END IF;
    
    IF NOT app_auth.verify_password(p_password, v_password_hash) THEN
        RAISE EXCEPTION 'Senha incorreta';
    END IF;
    
    -- Gerar token de sessão
    v_token := encode(gen_random_bytes(32), 'hex');
    
    -- Criar sessão (expira em 7 dias)
    INSERT INTO app_auth.sessions (user_id, token, expires_at)
    VALUES (v_user_id, v_token, NOW() + INTERVAL '7 days');
    
    -- Atualizar último login
    UPDATE app_auth.users SET last_sign_in_at = NOW() WHERE id = v_user_id;
    
    RETURN QUERY SELECT v_user_id, v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para validar sessão
CREATE OR REPLACE FUNCTION app_auth.validate_session(p_token TEXT)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT user_id INTO v_user_id
    FROM app_auth.sessions
    WHERE token = p_token AND expires_at > NOW();
    
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para logout
CREATE OR REPLACE FUNCTION app_auth.logout(p_token TEXT)
RETURNS VOID AS $$
BEGIN
    DELETE FROM app_auth.sessions WHERE token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Limpar sessões expiradas (rodar periodicamente)
CREATE OR REPLACE FUNCTION app_auth.cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM app_auth.sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TABELAS PÚBLICAS (adaptar do schema.sql exportado)
-- =============================================

-- Enum para roles
CREATE TYPE user_role AS ENUM ('coach', 'aluno');

-- Tabela user_roles (referenciando app_auth.users)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Trigger para criar role ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'coach');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created
    AFTER INSERT ON app_auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função auxiliar para obter user_id da sessão atual
-- (será usada pela API para verificar permissões)
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS user_role AS $$
    SELECT role FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_coach(p_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = p_user_id AND role = 'coach'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================
-- DEMAIS TABELAS (importar do schema_public.sql)
-- Remova referências a auth.users e substitua por app_auth.users
-- =============================================
```

### 4.2 Importar dados

```bash
# Conectar ao banco
psql -h localhost -U app_user -d blackhouse_db

# Executar script de migração
\i migration_postgres.sql

# Importar schema público (após ajustar referências)
\i schema_public.sql

# Importar dados
\i data.sql
```

---

## 🔐 Parte 5: Criar API de Autenticação

Como não usaremos mais o Supabase Auth, precisamos de uma API própria.

### 5.1 Criar servidor Express para Auth

```bash
mkdir -p server
cd server
npm init -y
npm install express pg cors jsonwebtoken bcrypt dotenv helmet
```

### 5.2 Criar arquivo do servidor

```bash
nano server/index.js
```

```javascript
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

// Middlewares
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

// Pool de conexão PostgreSQL
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'blackhouse_db',
    user: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD,
});

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware de autenticação
const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const result = await pool.query(
            'SELECT * FROM app_auth.users WHERE id = $1',
            [decoded.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }
        
        req.user = result.rows[0];
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};

// =============== ROTAS DE AUTH ===============

// Registro
app.post('/auth/signup', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const result = await pool.query(
            'SELECT app_auth.create_user($1, $2)',
            [email, password]
        );
        
        const userId = result.rows[0].create_user;
        const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({ 
            user: { id: userId, email },
            token 
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// Login
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const result = await pool.query(
            'SELECT * FROM app_auth.login($1, $2)',
            [email, password]
        );
        
        const { user_id } = result.rows[0];
        const token = jwt.sign({ userId: user_id }, JWT_SECRET, { expiresIn: '7d' });
        
        // Buscar dados do usuário
        const userResult = await pool.query(
            'SELECT id, email, created_at FROM app_auth.users WHERE id = $1',
            [user_id]
        );
        
        res.json({ 
            user: userResult.rows[0],
            token 
        });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

// Obter usuário atual
app.get('/auth/user', authenticate, (req, res) => {
    const { id, email, created_at } = req.user;
    res.json({ user: { id, email, created_at } });
});

// Logout (client-side - apenas invalida token no frontend)
app.post('/auth/logout', (req, res) => {
    res.json({ message: 'Logout realizado' });
});

// =============== ROTAS DA API ===============

// Proxy para queries do banco (simplificado)
app.post('/rest/v1/rpc/:function', authenticate, async (req, res) => {
    const { function: funcName } = req.params;
    const params = req.body;
    
    try {
        // Construir chamada de função
        const paramKeys = Object.keys(params);
        const paramValues = Object.values(params);
        const placeholders = paramKeys.map((_, i) => `$${i + 1}`).join(', ');
        
        const query = `SELECT * FROM public.${funcName}(${placeholders})`;
        const result = await pool.query(query, paramValues);
        
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Query genérica para tabelas
app.get('/rest/v1/:table', authenticate, async (req, res) => {
    const { table } = req.params;
    const { select, order, limit } = req.query;
    
    try {
        let query = `SELECT ${select || '*'} FROM public.${table}`;
        
        if (order) {
            const [column, direction] = order.split('.');
            query += ` ORDER BY ${column} ${direction || 'ASC'}`;
        }
        
        if (limit) {
            query += ` LIMIT ${parseInt(limit)}`;
        }
        
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Insert
app.post('/rest/v1/:table', authenticate, async (req, res) => {
    const { table } = req.params;
    const data = req.body;
    
    try {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        
        const query = `
            INSERT INTO public.${table} (${columns.join(', ')})
            VALUES (${placeholders})
            RETURNING *
        `;
        
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update
app.patch('/rest/v1/:table', authenticate, async (req, res) => {
    const { table } = req.params;
    const { id, ...data } = req.body;
    
    try {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
        
        const query = `
            UPDATE public.${table}
            SET ${setClause}
            WHERE id = $${values.length + 1}
            RETURNING *
        `;
        
        const result = await pool.query(query, [...values, id]);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete
app.delete('/rest/v1/:table', authenticate, async (req, res) => {
    const { table } = req.params;
    const { id } = req.query;
    
    try {
        await pool.query(`DELETE FROM public.${table} WHERE id = $1`, [id]);
        res.json({ message: 'Deletado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =============== STORAGE (arquivos locais) ===============

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const bucket = req.params.bucket;
        const dir = path.join(__dirname, 'storage', bucket);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

app.post('/storage/v1/object/:bucket/*', authenticate, upload.single('file'), (req, res) => {
    const filePath = `/storage/${req.params.bucket}/${req.file.filename}`;
    res.json({ path: filePath });
});

app.get('/storage/v1/object/public/:bucket/*', (req, res) => {
    const filePath = path.join(__dirname, 'storage', req.params.bucket, req.params[0]);
    res.sendFile(filePath);
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`API rodando na porta ${PORT}`);
});
```

### 5.3 Criar arquivo .env do servidor

```bash
nano server/.env
```

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=blackhouse_db
DB_USER=app_user
DB_PASSWORD=sua_senha_super_segura
JWT_SECRET=sua_chave_jwt_super_secreta_minimo_32_caracteres
FRONTEND_URL=https://seudominio.com
PORT=3001
```

### 5.4 Criar serviço systemd

```bash
sudo nano /etc/systemd/system/blackhouse-api.service
```

```ini
[Unit]
Description=BlackHouse API
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/seuapp/server
ExecStart=/usr/bin/node index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable blackhouse-api
sudo systemctl start blackhouse-api
```

---

## ⚙️ Parte 6: Adaptar Frontend

### 6.1 Criar novo cliente de API

```bash
nano src/lib/api-client.ts
```

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
    private token: string | null = null;

    constructor() {
        this.token = localStorage.getItem('auth_token');
    }

    setToken(token: string | null) {
        this.token = token;
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

    getToken() {
        return this.token;
    }

    private async request(endpoint: string, options: RequestInit = {}) {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...options.headers as Record<string, string>,
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro na requisição');
        }

        return response.json();
    }

    // Auth
    async signUp(email: string, password: string) {
        const data = await this.request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        this.setToken(data.token);
        return data;
    }

    async signIn(email: string, password: string) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        this.setToken(data.token);
        return data;
    }

    async signOut() {
        this.setToken(null);
    }

    async getUser() {
        return this.request('/auth/user');
    }

    // Database queries
    async from(table: string) {
        return {
            select: async (columns = '*') => {
                return this.request(`/rest/v1/${table}?select=${columns}`);
            },
            insert: async (data: any) => {
                return this.request(`/rest/v1/${table}`, {
                    method: 'POST',
                    body: JSON.stringify(data),
                });
            },
            update: async (data: any) => {
                return this.request(`/rest/v1/${table}`, {
                    method: 'PATCH',
                    body: JSON.stringify(data),
                });
            },
            delete: async (id: string) => {
                return this.request(`/rest/v1/${table}?id=${id}`, {
                    method: 'DELETE',
                });
            },
        };
    }

    // Storage
    async uploadFile(bucket: string, path: string, file: File) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_URL}/storage/v1/object/${bucket}/${path}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
            },
            body: formData,
        });

        return response.json();
    }

    getPublicUrl(bucket: string, path: string) {
        return `${API_URL}/storage/v1/object/public/${bucket}/${path}`;
    }
}

export const apiClient = new ApiClient();
```

### 6.2 Atualizar variáveis de ambiente

```bash
nano .env
```

```env
VITE_API_URL=https://api.seudominio.com
```

---

## 🚀 Parte 7: Deploy da Aplicação

### 7.1 Build de produção

```bash
npm run build
```

### 7.2 Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/seuapp
```

```nginx
# Frontend
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;

    root /var/www/seuapp/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# API
server {
    listen 80;
    server_name api.seudominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 7.3 Ativar e configurar SSL

```bash
sudo ln -s /etc/nginx/sites-available/seuapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# SSL
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d seudominio.com -d www.seudominio.com -d api.seudominio.com
```

---

## 🔧 Parte 8: Edge Functions (Opcional)

Se precisar manter as Edge Functions, você pode adaptá-las para rodar como endpoints Express no servidor API ou usar Deno Deploy separadamente.

### 8.1 Migrar para Express

Adicione as rotas das edge functions no `server/index.js`:

```javascript
// Exemplo: webhook Asaas
app.post('/functions/asaas-webhook', async (req, res) => {
    const event = req.body;
    // Lógica da função
    res.json({ success: true });
});
```

---

## 📊 Parte 9: Monitoramento e Backup

### 9.1 Backup automático PostgreSQL

```bash
# Criar script de backup
sudo nano /usr/local/bin/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

pg_dump -h localhost -U app_user blackhouse_db > $BACKUP_DIR/backup_$DATE.sql

# Manter apenas últimos 7 dias
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

```bash
chmod +x /usr/local/bin/backup-db.sh

# Crontab para backup diário às 2h
crontab -e
# Adicionar:
0 2 * * * /usr/local/bin/backup-db.sh
```

### 9.2 Monitoramento

```bash
# Logs do PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Logs da API
sudo journalctl -u blackhouse-api -f

# Logs do Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
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
