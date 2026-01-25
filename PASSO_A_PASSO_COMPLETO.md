# 🚀 Passo a Passo Completo - Deploy BlackHouse

## 📋 Resumo do que já foi feito

✅ PostgreSQL instalado e configurado  
✅ Schema de autenticação migrado  
✅ API Node.js configurada  
✅ Scripts de backup instalados  
✅ Nginx instalado  
✅ Certbot instalado  
✅ Fundações criadas para o domínio  

---

## 🔴 AÇÃO 1: Configurar DNS no Registro.br

### ⏱️ Tempo estimado: 10 minutos + propagação (15-60 min)

**Siga as instruções detalhadas em:** `INSTRUCOES_REGISTRO_BR.md`

**Resumo rápido:**
1. Acesse https://registro.br
2. Vá em "Meus Domínios" → "blackhouse.app.br"
3. Clique em "Gerenciar DNS" ou "Zona DNS"
4. Adicione 3 registros A:
   - `@` → `177.153.64.95`
   - `www` → `177.153.64.95`
   - `api` → `177.153.64.95`
5. Salve e aguarde propagação (15-60 minutos)

**Verificar propagação:**
```bash
dig blackhouse.app.br +short
dig www.blackhouse.app.br +short
dig api.blackhouse.app.br +short
```

Todos devem retornar: `177.153.64.95`

---

## 🔴 AÇÃO 2: Exportar Dados do Supabase

### ⏱️ Tempo estimado: 5-10 minutos

**Você precisa da senha do PostgreSQL do Supabase.**

### Como obter a senha:

1. Acesse: https://supabase.com/dashboard
2. Selecione projeto: `cghzttbggklhuyqxzabq`
3. Vá em **Settings** → **Database**
4. Procure **"Connection string"** ou **"Connection pooling"**
5. A senha está na string ou você pode resetá-la

### Executar exportação:

```bash
cd /root

# Definir senha do PostgreSQL do Supabase
export SUPABASE_PASSWORD='sua_senha_postgresql_aqui'

# Executar script
./scripts/export-supabase.sh
```

Os arquivos serão salvos em `/root/backup/`:
- `schema_public.sql` - Estrutura
- `data.sql` - Dados
- `schema_completo.sql` - Referência

**Detalhes completos em:** `EXPORTAR_DADOS.md`

---

## 🔴 AÇÃO 3: Importar Dados no PostgreSQL Local

### ⏱️ Tempo estimado: 5 minutos

```bash
cd /root

# 1. Adaptar schema (substituir auth.users por app_auth.users)
./scripts/adapt-schema.sh backup/schema_public.sql backup/schema_public_adapted.sql

# 2. Revisar arquivo adaptado (opcional mas recomendado)
# nano backup/schema_public_adapted.sql

# 3. Importar schema adaptado
PGPASSWORD='temp_password_change_me_123!' psql -h localhost -U app_user -d blackhouse_db -f backup/schema_public_adapted.sql

# 4. Importar dados
PGPASSWORD='temp_password_change_me_123!' psql -h localhost -U app_user -d blackhouse_db -f backup/data.sql
```

**Verificar importação:**
```bash
PGPASSWORD='temp_password_change_me_123!' psql -h localhost -U app_user -d blackhouse_db -c "\dt public.*"
```

---

## 🔴 AÇÃO 4: Adaptar Frontend

### ⏱️ Tempo estimado: 15-30 minutos

**Siga o guia completo em:** `ADAPTACAO_FRONTEND.md`

### Resumo:

1. **Clonar repositório** (se ainda não fez):
   ```bash
   cd /root
   git clone https://github.com/romuloroldao/Black-House.git
   cd Black-House
   npm install
   ```

2. **Substituir cliente Supabase:**
   - O arquivo `src/lib/api-client.ts` já está criado
   - Substitua todas as importações do Supabase por:
     ```typescript
     import { apiClient } from './lib/api-client'
     ```

3. **Atualizar variáveis de ambiente:**
   ```bash
   # Criar/editar .env na raiz do projeto
   echo "VITE_API_URL=https://api.blackhouse.app.br" > .env
   ```

4. **Principais mudanças:**
   - `supabase.auth.signUp()` → `apiClient.signUp()`
   - `supabase.auth.signIn()` → `apiClient.signIn()`
   - `supabase.from('tabela')` → `apiClient.from('tabela')`
   - `supabase.storage` → `apiClient.uploadFile()`

**Ver guia completo:** `ADAPTACAO_FRONTEND.md`

---

## 🔴 AÇÃO 5: Build do Frontend

### ⏱️ Tempo estimado: 5-10 minutos

```bash
cd /root/Black-House  # ou onde clonou o repositório

# Build de produção
npm run build

# Copiar para diretório do Nginx
sudo cp -r dist/* /var/www/blackhouse/dist/
sudo chown -R www-data:www-data /var/www/blackhouse/dist
```

---

## 🔴 AÇÃO 6: Alterar Credenciais de Produção

### ⏱️ Tempo estimado: 5 minutos

**IMPORTANTE**: As credenciais atuais são temporárias!

```bash
# 1. Alterar senha do PostgreSQL
sudo -u postgres psql
ALTER USER app_user WITH PASSWORD 'nova_senha_super_segura_aqui';
\q

# 2. Gerar JWT_SECRET seguro (mínimo 32 caracteres)
# Pode usar: openssl rand -hex 32

# 3. Editar arquivo .env
sudo nano /var/www/blackhouse/server/.env

# Alterar:
DB_PASSWORD=nova_senha_super_segura_aqui
JWT_SECRET=seu_jwt_secret_gerado_aqui_minimo_32_caracteres
FRONTEND_URL=https://blackhouse.app.br
NODE_ENV=production

# 4. Reiniciar API
sudo systemctl restart blackhouse-api
```

---

## 🔴 AÇÃO 7: Deploy Completo (Nginx + SSL)

### ⏱️ Tempo estimado: 10-15 minutos

**IMPORTANTE**: Execute apenas após confirmar que o DNS propagou!

```bash
cd /root

# Executar script de deploy completo
sudo ./deploy-completo.sh
```

O script irá:
- ✅ Configurar Nginx
- ✅ Verificar DNS
- ✅ Configurar SSL com Let's Encrypt
- ✅ Configurar permissões
- ✅ Iniciar serviços
- ✅ Configurar backup automático

**OU execute manualmente:**

```bash
# 1. Configurar Nginx
sudo cp /root/deployment/nginx-blackhouse.conf /etc/nginx/sites-available/blackhouse
sudo ln -sf /etc/nginx/sites-available/blackhouse /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# 2. Configurar SSL (após DNS propagar)
sudo certbot --nginx \
    -d blackhouse.app.br \
    -d www.blackhouse.app.br \
    -d api.blackhouse.app.br \
    --non-interactive \
    --agree-tos \
    --email seu-email@exemplo.com \
    --redirect

# 3. Iniciar API
sudo systemctl enable blackhouse-api
sudo systemctl start blackhouse-api
```

---

## ✅ Verificação Final

### Testar Endpoints:

```bash
# Health check da API
curl https://api.blackhouse.app.br/health

# Verificar frontend
curl -I https://blackhouse.app.br

# Verificar logs
sudo journalctl -u blackhouse-api -n 50
sudo tail -f /var/log/nginx/blackhouse-error.log
```

### Acessar no Navegador:

- Frontend: https://blackhouse.app.br
- Frontend: https://www.blackhouse.app.br
- API Health: https://api.blackhouse.app.br/health

---

## 📋 Checklist Final

- [ ] DNS configurado no Registro.br
- [ ] DNS propagado (todos apontam para 177.153.64.95)
- [ ] Dados exportados do Supabase
- [ ] Dados importados no PostgreSQL local
- [ ] Frontend adaptado (Supabase → apiClient)
- [ ] Frontend buildado
- [ ] Credenciais alteradas (senha PostgreSQL e JWT_SECRET)
- [ ] Nginx configurado
- [ ] SSL configurado
- [ ] API rodando
- [ ] Frontend acessível
- [ ] Backup automático configurado

---

## 🆘 Problemas Comuns

### DNS não propagou
- Aguarde mais tempo (até 48h em casos raros)
- Verifique se os registros foram salvos corretamente
- Use ferramentas online: https://dnschecker.org

### SSL não funciona
- Confirme que DNS propagou
- Verifique firewall (portas 80 e 443 abertas)
- Veja logs: `sudo tail -f /var/log/letsencrypt/letsencrypt.log`

### API não responde
- Verifique se está rodando: `sudo systemctl status blackhouse-api`
- Veja logs: `sudo journalctl -u blackhouse-api -f`
- Verifique .env: `sudo cat /var/www/blackhouse/server/.env`

### Frontend não carrega
- Verifique se build foi copiado: `ls -la /var/www/blackhouse/dist/`
- Verifique logs do Nginx: `sudo tail -f /var/log/nginx/blackhouse-error.log`
- Verifique permissões: `sudo chown -R www-data:www-data /var/www/blackhouse`

---

## 📞 Documentação de Referência

- `INSTRUCOES_REGISTRO_BR.md` - Configuração DNS detalhada
- `EXPORTAR_DADOS.md` - Como exportar do Supabase
- `ADAPTACAO_FRONTEND.md` - Adaptação do código frontend
- `TROUBLESHOOTING.md` - Solução de problemas
- `STATUS_FINAL.md` - Status da migração

---

**Boa sorte com o deploy! 🚀**
