# ✅ Configuração de Backup - Status

**Data**: 12 de Janeiro de 2026  
**Status**: ✅ **CONFIGURADO**

---

## 📋 O Que Está Configurado

### 1. Script de Backup

**Localização**: `/usr/local/bin/backup-db.sh`

**Funcionalidades**:
- ✅ Backup automático do PostgreSQL
- ✅ Compressão com gzip
- ✅ Rotação automática (mantém últimos 7 dias)
- ✅ Carrega senha do `.env`
- ✅ Logs de erro

### 2. Diretório de Backup

**Localização**: `/var/backups/postgresql/`

**Status**: ✅ Criado e funcionando

**Backups existentes**:
- Backup de teste criado
- Script testado e funcionando

### 3. Crontab

**Status**: ✅ Configurado

**Agendamento**:
```
0 2 * * * /usr/local/bin/backup-db.sh >> /var/log/backup-db.log 2>&1
```

**Horário**: Diariamente às 02:00

---

## 🧪 Testes Realizados

### Teste Manual
```bash
sudo /usr/local/bin/backup-db.sh
# ✅ Backup criado com sucesso
```

### Verificação de Backups
```bash
ls -lh /var/backups/postgresql/
# ✅ Backups existem e estão sendo criados
```

---

## 📊 Informações do Banco

**Nome**: `blackhouse_db`  
**Tamanho**: Verificar com `SELECT pg_size_pretty(pg_database_size('blackhouse_db'));`

---

## 🔧 Comandos Úteis

### Fazer Backup Manual
```bash
sudo /usr/local/bin/backup-db.sh
```

### Ver Backups
```bash
ls -lh /var/backups/postgresql/
```

### Ver Logs do Backup
```bash
sudo tail -f /var/log/backup-db.log
```

### Verificar Crontab
```bash
crontab -l
```

### Restaurar Backup
```bash
# Descompactar se necessário
gunzip backup_YYYYMMDD_HHMMSS.sql.gz

# Restaurar
sudo -u postgres psql -d blackhouse_db < backup_YYYYMMDD_HHMMSS.sql
```

---

## ⚠️ Importante

### Rotação de Backups
- Backups antigos (> 7 dias) são removidos automaticamente
- Mantém sempre os últimos 7 dias de backup

### Localização dos Backups
- **Produção**: `/var/backups/postgresql/`
- **Recomendação**: Fazer backup externo periódico (S3, outro servidor, etc.)

### Segurança
- Backups contêm dados sensíveis
- Proteger acesso ao diretório `/var/backups/postgresql/`
- Considerar criptografia para backups externos

---

## 📝 Próximos Passos (Opcional)

1. ✅ Backup automático configurado
2. ⏳ Configurar backup externo (S3, outro servidor)
3. ⏳ Testar restauração completa
4. ⏳ Documentar procedimento de restauração
5. ⏳ Configurar alertas de falha de backup

---

**Última atualização**: 12 de Janeiro de 2026  
**Status**: ✅ Backup automático configurado e funcionando
