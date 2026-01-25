# Índice da Estrutura de Migração

## 📚 Documentação Principal

1. **[MIGRACAO_POSTGRESQL.md](./MIGRACAO_POSTGRESQL.md)** - Guia completo passo a passo
2. **[README_MIGRACAO.md](./README_MIGRACAO.md)** - Visão geral rápida
3. **[ADAPTACAO_FRONTEND.md](./ADAPTACAO_FRONTEND.md)** - Como adaptar o código frontend
4. **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Solução de problemas comuns

## 📁 Estrutura de Arquivos

```
.
├── 📄 MIGRACAO_POSTGRESQL.md          # Guia completo detalhado
├── 📄 README_MIGRACAO.md              # Guia rápido
├── 📄 ADAPTACAO_FRONTEND.md           # Adaptação do código
├── 📄 TROUBLESHOOTING.md              # Solução de problemas
│
├── 📂 migration/
│   ├── 📄 migration_postgres.sql      # Script SQL principal
│   └── 📄 README.md                   # Instruções de migração
│
├── 📂 server/
│   ├── 📄 index.js                    # Servidor Express (API)
│   ├── 📄 package.json                # Dependências do servidor
│   └── 📄 .env.example                # Variáveis de ambiente (exemplo)
│
├── 📂 src/
│   └── 📂 lib/
│       └── 📄 api-client.ts           # Cliente de API para frontend
│
├── 📂 scripts/
│   ├── 🔧 setup-postgres.sh          # Instala PostgreSQL
│   ├── 🔧 export-supabase.sh         # Exporta dados do Supabase
│   ├── 🔧 adapt-schema.sh            # Adapta schema exportado
│   ├── 🔧 backup-db.sh               # Backup automático
│   └── 🔧 cleanup-sessions.sh        # Limpa sessões expiradas
│
└── 📂 deployment/
    ├── 📄 nginx.conf                  # Configuração Nginx
    ├── 📄 blackhouse-api.service      # Serviço systemd
    └── 🔧 install.sh                  # Script de instalação completa
```

## 🚀 Início Rápido

### Para quem está começando:

1. Leia **[README_MIGRACAO.md](./README_MIGRACAO.md)** para visão geral
2. Siga **[MIGRACAO_POSTGRESQL.md](./MIGRACAO_POSTGRESQL.md)** passo a passo
3. Consulte **[ADAPTACAO_FRONTEND.md](./ADAPTACAO_FRONTEND.md)** ao adaptar código
4. Use **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** se encontrar problemas

### Ordem de Execução Recomendada:

1. **Preparação**
   ```bash
   ./scripts/setup-postgres.sh
   ```

2. **Exportar Dados do Supabase**
   ```bash
   ./scripts/export-supabase.sh
   ```

3. **Adaptar Schema**
   ```bash
   ./scripts/adapt-schema.sh backup/schema_public.sql backup/schema_public_adapted.sql
   ```

4. **Executar Migração**
   ```bash
   psql -U app_user -d blackhouse_db -f migration/migration_postgres.sql
   psql -U app_user -d blackhouse_db -f backup/schema_public_adapted.sql
   psql -U app_user -d blackhouse_db -f backup/data.sql
   ```

5. **Configurar API**
   ```bash
   cd server
   cp .env.example .env
   # Editar .env com suas credenciais
   npm install
   ```

6. **Deploy**
   ```bash
   sudo ./deployment/install.sh
   # Seguir instruções do guia para configurar domínio e SSL
   ```

## 📋 Checklist de Migração

- [ ] Servidor configurado
- [ ] PostgreSQL instalado e configurado
- [ ] Dados exportados do Supabase
- [ ] Schema adaptado
- [ ] Migração executada
- [ ] API configurada e testada
- [ ] Frontend adaptado
- [ ] Nginx configurado
- [ ] SSL configurado
- [ ] Backups configurados
- [ ] Monitoramento configurado

## 🔗 Links Úteis

- [Documentação PostgreSQL](https://www.postgresql.org/docs/)
- [Documentação Express](https://expressjs.com/)
- [Documentação Nginx](https://nginx.org/en/docs/)
- [Documentação Node.js](https://nodejs.org/docs/)

## 📞 Suporte

Em caso de problemas:
1. Consulte **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**
2. Verifique logs do sistema
3. Revise variáveis de ambiente
4. Teste componentes isoladamente
