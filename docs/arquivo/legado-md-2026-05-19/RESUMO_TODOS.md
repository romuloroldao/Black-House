# ✅ Status dos To-Dos - Resumo Final

## ✅ Concluídos

1. ✅ **Obter IP da VPS e criar fundações para domínio**
   - IP identificado: `177.153.64.95`
   - Documentação criada

2. ✅ **Adaptar script de exportação do Supabase**
   - Scripts criados e configurados

3. ✅ **Configurar Nginx para blackhouse.app.br**
   - Nginx configurado e ativo
   - Configuração em `/etc/nginx/sites-available/blackhouse`
   - Diretórios criados em `/var/www/blackhouse/dist`

## ⏳ Pendentes (Com Scripts Prontos)

### 1. Exportar Dados do Supabase

**Status**: Aguardando senha do PostgreSQL do Supabase

**Como fazer:**
```bash
# Obter senha do Supabase Dashboard → Settings → Database
export SUPABASE_PASSWORD='sua_senha_postgresql'

# Executar exportação
cd /root
./scripts/exportar-com-senha.sh
```

**Arquivos criados:**
- `scripts/exportar-com-senha.sh` - Script simplificado
- `EXPORTAR_DADOS.md` - Documentação completa

---

### 2. Importar Dados no PostgreSQL Local

**Status**: Aguardando exportação dos dados

**Como fazer:**
```bash
cd /root

# 1. Adaptar schema (substituir auth.users por app_auth.users)
./scripts/adapt-schema.sh backup/schema_public.sql backup/schema_public_adapted.sql

# 2. Importar
./scripts/importar-dados.sh
```

**Arquivos criados:**
- `scripts/importar-dados.sh` - Script automatizado
- `scripts/adapt-schema.sh` - Script para adaptar schema

---

### 3. Configurar SSL com Certbot

**Status**: Aguardando propagação DNS

**Pré-requisitos:**
- DNS configurado no Registro.br
- DNS propagado (verificar com `dig blackhouse.app.br +short`)

**Como fazer:**
```bash
# Verificar DNS primeiro
dig blackhouse.app.br +short
# Deve retornar: 177.153.64.95

# Configurar SSL
sudo ./scripts/configurar-ssl.sh
```

**Arquivos criados:**
- `scripts/configurar-ssl.sh` - Script automatizado
- `INSTRUCOES_REGISTRO_BR.md` - Guia completo de DNS

---

### 4. Adaptar Frontend

**Status**: Aguardando clone do repositório

**Pré-requisitos:**
- Repositório clonado: `git clone https://github.com/romuloroldao/Black-House.git`

**Como fazer:**
```bash
cd /root
git clone https://github.com/romuloroldao/Black-House.git
cd Black-House

# Adaptar automaticamente
../scripts/adaptar-frontend.sh

# Ou seguir guia manual
# Ver: ADAPTACAO_FRONTEND.md
```

**Arquivos criados:**
- `scripts/adaptar-frontend.sh` - Script de adaptação
- `src/lib/api-client.ts` - Cliente de API pronto
- `ADAPTACAO_FRONTEND.md` - Guia completo

---

### 5. Build e Deploy do Frontend

**Status**: Aguardando adaptação do frontend

**Pré-requisitos:**
- Frontend adaptado
- Código funcionando localmente

**Como fazer:**
```bash
cd /root/Black-House

# Build e deploy automático
../scripts/build-e-deploy.sh

# Ou manualmente:
npm run build
sudo cp -r dist/* /var/www/blackhouse/dist/
sudo chown -R www-data:www-data /var/www/blackhouse/dist
sudo systemctl reload nginx
```

**Arquivos criados:**
- `scripts/build-e-deploy.sh` - Script automatizado

---

## 🚀 Scripts Criados

Todos os scripts estão em `/root/scripts/`:

1. `exportar-com-senha.sh` - Exportar dados do Supabase
2. `adapt-schema.sh` - Adaptar schema exportado
3. `importar-dados.sh` - Importar dados no PostgreSQL
4. `configurar-ssl.sh` - Configurar SSL com Certbot
5. `adaptar-frontend.sh` - Adaptar código frontend
6. `build-e-deploy.sh` - Build e deploy do frontend
7. `backup-db.sh` - Backup automático
8. `cleanup-sessions.sh` - Limpar sessões expiradas

---

## 📋 Ordem de Execução Recomendada

1. **Configurar DNS** (Registro.br)
   - Siga: `INSTRUCOES_REGISTRO_BR.md`
   - Aguardar propagação (15-60 min)

2. **Exportar Dados**
   ```bash
   export SUPABASE_PASSWORD='senha'
   ./scripts/exportar-com-senha.sh
   ```

3. **Importar Dados**
   ```bash
   ./scripts/adapt-schema.sh backup/schema_public.sql backup/schema_public_adapted.sql
   ./scripts/importar-dados.sh
   ```

4. **Clonar e Adaptar Frontend**
   ```bash
   git clone https://github.com/romuloroldao/Black-House.git
   ./scripts/adaptar-frontend.sh /root/Black-House
   # Adaptar código manualmente seguindo ADAPTACAO_FRONTEND.md
   ```

5. **Build e Deploy**
   ```bash
   ./scripts/build-e-deploy.sh /root/Black-House
   ```

6. **Configurar SSL** (após DNS propagar)
   ```bash
   sudo ./scripts/configurar-ssl.sh
   ```

---

## 📚 Documentação Completa

- `PASSO_A_PASSO_COMPLETO.md` - Guia completo passo a passo
- `INSTRUCOES_REGISTRO_BR.md` - Configuração DNS
- `EXPORTAR_DADOS.md` - Exportar do Supabase
- `ADAPTACAO_FRONTEND.md` - Adaptar frontend
- `TROUBLESHOOTING.md` - Solução de problemas

---

## ✅ Checklist Final

- [x] Nginx configurado
- [x] Scripts criados
- [x] Documentação completa
- [ ] DNS configurado no Registro.br
- [ ] Dados exportados do Supabase
- [ ] Dados importados
- [ ] Frontend clonado e adaptado
- [ ] Frontend buildado e deployado
- [ ] SSL configurado

---

**Todos os scripts estão prontos! Basta executá-los na ordem correta.** 🚀
