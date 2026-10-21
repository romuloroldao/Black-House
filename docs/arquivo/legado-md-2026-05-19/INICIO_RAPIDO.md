# 🚀 Início Rápido - Migração Supabase para PostgreSQL

## O que foi criado?

Uma estrutura completa para migrar sua aplicação BlackHouse do Supabase para PostgreSQL puro, incluindo:

- ✅ Scripts SQL de migração
- ✅ API Express completa com autenticação
- ✅ Cliente de API TypeScript para frontend
- ✅ Scripts de automação
- ✅ Configurações de deploy (Nginx, systemd)
- ✅ Documentação completa

## 📂 Arquivos Criados

### Documentação
- `MIGRACAO_POSTGRESQL.md` - Guia completo detalhado
- `README_MIGRACAO.md` - Visão geral e estrutura
- `ADAPTACAO_FRONTEND.md` - Como adaptar código frontend
- `TROUBLESHOOTING.md` - Solução de problemas
- `INDEX.md` - Índice de todos os arquivos

### Código
- `migration/migration_postgres.sql` - Script de migração do banco
- `server/index.js` - API Express completa
- `server/package.json` - Dependências do servidor
- `src/lib/api-client.ts` - Cliente de API para frontend

### Scripts
- `scripts/setup-postgres.sh` - Instala PostgreSQL
- `scripts/export-supabase.sh` - Exporta dados do Supabase
- `scripts/adapt-schema.sh` - Adapta schema exportado
- `scripts/backup-db.sh` - Backup automático
- `scripts/cleanup-sessions.sh` - Limpa sessões expiradas

### Deploy
- `deployment/nginx.conf` - Configuração Nginx
- `deployment/blackhouse-api.service` - Serviço systemd
- `deployment/install.sh` - Instalação completa

## 🎯 Próximos Passos

### 1. Leia a Documentação
Comece pelo `README_MIGRACAO.md` para entender a estrutura, depois siga o `MIGRACAO_POSTGRESQL.md` para o processo completo.

### 2. Prepare o Servidor
```bash
# Instalar PostgreSQL
./scripts/setup-postgres.sh
```

### 3. Exporte os Dados do Supabase
```bash
# Exportar schema e dados
./scripts/export-supabase.sh
```

### 4. Execute a Migração
```bash
# Adaptar schema
./scripts/adapt-schema.sh backup/schema_public.sql backup/schema_public_adapted.sql

# Executar migração
psql -U app_user -d blackhouse_db -f migration/migration_postgres.sql
psql -U app_user -d blackhouse_db -f backup/schema_public_adapted.sql
psql -U app_user -d blackhouse_db -f backup/data.sql
```

### 5. Configure a API
```bash
cd server
cp .env.example .env
# Editar .env com suas credenciais
npm install
npm start
```

### 6. Adapte o Frontend
- Leia `ADAPTACAO_FRONTEND.md`
- Substitua importações do Supabase por `apiClient`
- Atualize variáveis de ambiente

### 7. Faça o Deploy
```bash
# Instalação completa
sudo ./deployment/install.sh

# Configurar domínio e SSL
sudo certbot --nginx -d seudominio.com
```

## ⚠️ Importante

1. **Backup**: Sempre faça backup antes de executar migrações
2. **Teste**: Teste em ambiente de desenvolvimento primeiro
3. **Variáveis**: Configure todas as variáveis de ambiente
4. **Segurança**: Use senhas fortes e não exponha PostgreSQL publicamente
5. **SSL**: Use HTTPS em produção

## 📞 Precisa de Ajuda?

- Consulte `TROUBLESHOOTING.md` para problemas comuns
- Revise os logs do sistema
- Verifique variáveis de ambiente
- Teste cada componente isoladamente

## ✅ Checklist Rápido

- [ ] Servidor preparado
- [ ] PostgreSQL instalado
- [ ] Dados exportados do Supabase
- [ ] Migração executada
- [ ] API configurada e testada
- [ ] Frontend adaptado
- [ ] Deploy realizado
- [ ] SSL configurado
- [ ] Backups configurados

---

**Boa sorte com a migração! 🎉**
