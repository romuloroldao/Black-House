# Guia de Migração para Servidor Próprio

Este guia detalha como migrar a aplicação do Lovable para seu próprio servidor, incluindo o banco de dados Supabase.

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
- Docker e Docker Compose (para Supabase self-hosted)
- Nginx ou Caddy (para reverse proxy)
- Git

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

### 1.2 Configurar variáveis de ambiente

Crie o arquivo `.env` na raiz do projeto:

```bash
cp .env.example .env
# ou crie manualmente:
touch .env
```

---

## 🗄️ Parte 2: Migrar o Supabase

Você tem duas opções:

### Opção A: Supabase Self-Hosted (Recomendado para controle total)

#### 2.1 Instalar Docker e Docker Compose

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalar Docker Compose
sudo apt install docker-compose-plugin -y

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER
newgrp docker
```

#### 2.2 Configurar Supabase Self-Hosted

```bash
# Clonar repositório do Supabase
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Copiar arquivo de configuração
cp .env.example .env
```

#### 2.3 Editar configurações do Supabase

Edite o arquivo `.env`:

```env
# IMPORTANTE: Gere novas chaves seguras!
# Use: openssl rand -base64 32

POSTGRES_PASSWORD=sua_senha_super_segura_aqui
JWT_SECRET=sua_chave_jwt_secreta_32_caracteres_minimo
ANON_KEY=gere_uma_nova_anon_key
SERVICE_ROLE_KEY=gere_uma_nova_service_role_key

# Configurações do site
SITE_URL=https://seudominio.com
API_EXTERNAL_URL=https://api.seudominio.com

# Email (configure com seu provedor SMTP)
SMTP_HOST=smtp.seudominio.com
SMTP_PORT=587
SMTP_USER=noreply@seudominio.com
SMTP_PASS=sua_senha_smtp
SMTP_SENDER_NAME=Sua Empresa
```

#### 2.4 Gerar novas chaves JWT

```bash
# Gerar JWT_SECRET
openssl rand -base64 32

# Para gerar ANON_KEY e SERVICE_ROLE_KEY, use o site:
# https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
```

#### 2.5 Iniciar Supabase

```bash
# Iniciar todos os serviços
docker compose up -d

# Verificar se está rodando
docker compose ps
```

O Supabase estará disponível em:
- **Studio (Dashboard)**: http://localhost:3000
- **API**: http://localhost:8000
- **Database**: localhost:5432

### Opção B: Continuar usando Supabase Cloud

Se preferir manter o banco no Supabase Cloud, apenas atualize as variáveis de ambiente com as credenciais atuais.

---

## 📤 Parte 3: Exportar Dados do Supabase Atual

### 3.1 Exportar Schema (estrutura)

Acesse o Supabase atual e exporte o schema:

```bash
# Via Supabase CLI
npx supabase db dump --project-ref cghzttbggklhuyqxzabq > schema.sql
```

Ou manualmente pelo Dashboard:
1. Acesse https://supabase.com/dashboard/project/cghzttbggklhuyqxzabq/settings/database
2. Em "Connection string", copie a string de conexão
3. Use pg_dump:

```bash
pg_dump "postgresql://postgres:[PASSWORD]@db.cghzttbggklhuyqxzabq.supabase.co:5432/postgres" \
  --schema-only \
  --no-owner \
  --no-privileges \
  > schema.sql
```

### 3.2 Exportar Dados

```bash
pg_dump "postgresql://postgres:[PASSWORD]@db.cghzttbggklhuyqxzabq.supabase.co:5432/postgres" \
  --data-only \
  --no-owner \
  --no-privileges \
  > data.sql
```

### 3.3 Exportar Storage (arquivos)

```bash
# Listar buckets
npx supabase storage ls --project-ref cghzttbggklhuyqxzabq

# Baixar arquivos de cada bucket
npx supabase storage cp -r supabase://progress-photos ./backup/progress-photos --project-ref cghzttbggklhuyqxzabq
npx supabase storage cp -r supabase://avatars ./backup/avatars --project-ref cghzttbggklhuyqxzabq
```

---

## 📥 Parte 4: Importar Dados no Novo Supabase

### 4.1 Conectar ao novo banco

```bash
# Se self-hosted
psql -h localhost -p 5432 -U postgres -d postgres
```

### 4.2 Importar schema e dados

```bash
# Importar estrutura
psql -h localhost -p 5432 -U postgres -d postgres < schema.sql

# Importar dados
psql -h localhost -p 5432 -U postgres -d postgres < data.sql
```

### 4.3 Importar arquivos do Storage

Via Supabase Studio ou CLI:
```bash
# Upload para cada bucket
npx supabase storage cp -r ./backup/progress-photos supabase://progress-photos
npx supabase storage cp -r ./backup/avatars supabase://avatars
```

---

## ⚙️ Parte 5: Configurar a Aplicação

### 5.1 Atualizar variáveis de ambiente

Edite o arquivo `.env` do projeto:

```env
# Para Supabase Self-Hosted
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_PUBLISHABLE_KEY=sua_nova_anon_key
VITE_SUPABASE_PROJECT_ID=local

# Para produção com domínio
VITE_SUPABASE_URL=https://api.seudominio.com
VITE_SUPABASE_PUBLISHABLE_KEY=sua_nova_anon_key
```

### 5.2 Atualizar o cliente Supabase

Edite `src/integrations/supabase/client.ts`:

```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "http://localhost:8000";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sua_anon_key";
```

---

## 🚀 Parte 6: Deploy da Aplicação

### 6.1 Build de produção

```bash
npm run build
```

Isso gera a pasta `dist/` com os arquivos estáticos.

### 6.2 Configurar Nginx

```bash
sudo apt install nginx -y
```

Crie o arquivo de configuração:

```bash
sudo nano /etc/nginx/sites-available/seuapp
```

```nginx
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;

    root /var/www/seuapp/dist;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache de assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Ativar e reiniciar:

```bash
sudo ln -s /etc/nginx/sites-available/seuapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6.3 Configurar SSL com Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d seudominio.com -d www.seudominio.com
```

---

## 🔧 Parte 7: Edge Functions

### 7.1 Para Supabase Self-Hosted

As Edge Functions precisam ser hospedadas no Deno Deploy ou como serviço separado.

#### Opção 1: Deno Deploy

1. Crie uma conta em https://deno.com/deploy
2. Conecte seu repositório GitHub
3. Configure as variáveis de ambiente necessárias

#### Opção 2: Self-hosted com Deno

```bash
# Instalar Deno
curl -fsSL https://deno.land/install.sh | sh

# Criar serviço systemd para cada função
sudo nano /etc/systemd/system/edge-function.service
```

```ini
[Unit]
Description=Edge Functions
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/seuapp/supabase/functions
ExecStart=/home/user/.deno/bin/deno run --allow-all index.ts
Restart=always

[Install]
WantedBy=multi-user.target
```

### 7.2 Configurar secrets das Edge Functions

Para cada função, configure as variáveis de ambiente:

```bash
# Criar arquivo .env para as funções
cat > /var/www/seuapp/supabase/functions/.env << EOF
SUPABASE_URL=https://api.seudominio.com
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
SUPABASE_ANON_KEY=sua_anon_key
ASAAS_API_KEY=sua_chave_asaas
LOVABLE_API_KEY=sua_chave_lovable
EOF
```

---

## 📊 Parte 8: Monitoramento

### 8.1 Instalar PM2 (gerenciador de processos)

```bash
npm install -g pm2
```

### 8.2 Configurar logs

```bash
# Logs do Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Logs do Supabase
cd supabase/docker
docker compose logs -f
```

---

## ✅ Checklist Final

- [ ] Servidor configurado e acessível
- [ ] Docker e Docker Compose instalados
- [ ] Supabase self-hosted rodando
- [ ] Schema do banco importado
- [ ] Dados migrados
- [ ] Arquivos do Storage migrados
- [ ] Aplicação frontend buildada
- [ ] Nginx configurado
- [ ] SSL configurado
- [ ] Edge Functions funcionando
- [ ] Domínio apontando para o servidor
- [ ] Backup automático configurado

---

## 🔐 Segurança Adicional

### Firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Backup automático

```bash
# Crontab para backup diário
crontab -e
```

Adicione:
```
0 2 * * * pg_dump -h localhost -U postgres postgres > /backup/db_$(date +\%Y\%m\%d).sql
```

---

## 📞 Suporte

Se encontrar problemas durante a migração:
1. Verifique os logs dos serviços
2. Confirme que todas as variáveis de ambiente estão corretas
3. Teste a conexão com o banco de dados
4. Verifique as políticas RLS após a migração

---

## 📝 Notas Importantes

1. **Chaves JWT**: Nunca reutilize as chaves do Supabase Cloud. Gere novas para sua instância.
2. **Senhas**: Use senhas fortes e únicas para todos os serviços.
3. **Backup**: Configure backups automáticos antes de colocar em produção.
4. **SSL**: Sempre use HTTPS em produção.
5. **Atualizações**: Mantenha todos os serviços atualizados.
