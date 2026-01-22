# 📊 Monitoramento de Logs - Configuração

**Data**: 12 de Janeiro de 2026  
**Status**: ✅ **LOGS DISPONÍVEIS**

---

## 📋 Logs Disponíveis

### 1. Logs da API

**Comando**:
```bash
# Ver logs em tempo real
sudo journalctl -u blackhouse-api -f

# Ver logs de hoje
sudo journalctl -u blackhouse-api --since "today"

# Ver últimas 50 linhas
sudo journalctl -u blackhouse-api -n 50

# Ver logs de um período específico
sudo journalctl -u blackhouse-api --since "2026-01-12 00:00:00" --until "2026-01-12 23:59:59"
```

**Localização**: Systemd journal

**Informações**:
- Inicialização da API
- Erros e exceções
- Requisições processadas
- Status do serviço

---

### 2. Logs do Nginx

#### Access Log
**Arquivo**: `/var/log/nginx/blackhouse-access.log`

**Comando**:
```bash
# Ver últimas linhas
sudo tail -f /var/log/nginx/blackhouse-access.log

# Ver logs de hoje
sudo grep "$(date +%d/%b/%Y)" /var/log/nginx/blackhouse-access.log

# Contar requisições
sudo wc -l /var/log/nginx/blackhouse-access.log
```

**Informações**:
- IPs que acessam
- URLs acessadas
- Status codes
- User agents
- Timestamps

#### Error Log
**Arquivo**: `/var/log/nginx/blackhouse-error.log`

**Comando**:
```bash
# Ver últimas linhas
sudo tail -f /var/log/nginx/blackhouse-error.log

# Ver apenas erros
sudo grep -i error /var/log/nginx/blackhouse-error.log
```

**Informações**:
- Erros 404, 403, 500, etc.
- Tentativas de acesso bloqueadas
- Problemas de configuração

#### API Access Log
**Arquivo**: `/var/log/nginx/blackhouse-api-access.log`

**Comando**:
```bash
sudo tail -f /var/log/nginx/blackhouse-api-access.log
```

---

### 3. Logs do PostgreSQL

**Arquivo**: `/var/log/postgresql/postgresql-15-main.log`

**Comando**:
```bash
# Ver últimas linhas
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Ver erros
sudo grep -i error /var/log/postgresql/postgresql-15-main.log
```

**Informações**:
- Conexões ao banco
- Queries lentas
- Erros de SQL
- Deadlocks

---

### 4. Logs de Backup

**Arquivo**: `/var/log/backup-db.log`

**Comando**:
```bash
# Ver últimas linhas
sudo tail -f /var/log/backup-db.log

# Ver histórico
sudo cat /var/log/backup-db.log
```

**Informações**:
- Status dos backups
- Erros de backup
- Tamanho dos backups
- Rotação de backups

---

## 🔍 Comandos Úteis de Monitoramento

### Verificar Status dos Serviços
```bash
# Status geral
sudo systemctl status blackhouse-api
sudo systemctl status nginx
sudo systemctl status postgresql@15-main

# Ver se estão rodando
sudo systemctl is-active blackhouse-api
sudo systemctl is-active nginx
sudo systemctl is-active postgresql@15-main
```

### Monitorar em Tempo Real
```bash
# API
sudo journalctl -u blackhouse-api -f

# Nginx access
sudo tail -f /var/log/nginx/blackhouse-access.log

# Nginx errors
sudo tail -f /var/log/nginx/blackhouse-error.log

# PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### Análise de Logs

#### Top IPs que Acessam
```bash
sudo awk '{print $1}' /var/log/nginx/blackhouse-access.log | sort | uniq -c | sort -rn | head -10
```

#### Status Codes Mais Comuns
```bash
sudo awk '{print $9}' /var/log/nginx/blackhouse-access.log | sort | uniq -c | sort -rn
```

#### URLs Mais Acessadas
```bash
sudo awk '{print $7}' /var/log/nginx/blackhouse-access.log | sort | uniq -c | sort -rn | head -10
```

#### Erros Recentes
```bash
sudo journalctl -u blackhouse-api -p err --since "1 hour ago"
```

---

## 📊 Métricas Importantes

### API
- Requisições por minuto
- Taxa de erro
- Tempo de resposta
- Uso de memória/CPU

### Nginx
- Requisições por segundo
- Taxa de erro (4xx, 5xx)
- Bandwidth usado
- Conexões ativas

### PostgreSQL
- Conexões ativas
- Queries lentas
- Tamanho do banco
- Uso de recursos

---

## ⚠️ Alertas Recomendados

### Configurar Alertas Para:
1. **API não está rodando**
   ```bash
   ! systemctl is-active blackhouse-api
   ```

2. **Alta taxa de erros**
   ```bash
   # Verificar últimos 100 requests
   sudo journalctl -u blackhouse-api -n 100 | grep -i error | wc -l
   ```

3. **Disco cheio**
   ```bash
   df -h /var/backups/postgresql
   ```

4. **Backup falhou**
   ```bash
   sudo tail -1 /var/log/backup-db.log | grep -i error
   ```

---

## 🔧 Ferramentas de Monitoramento (Opcional)

### Logwatch
```bash
sudo apt install logwatch
sudo logwatch --range today
```

### GoAccess (Análise de Logs Nginx)
```bash
sudo apt install goaccess
sudo goaccess /var/log/nginx/blackhouse-access.log --log-format=COMBINED
```

### Prometheus + Grafana (Avançado)
- Coletar métricas da API
- Coletar métricas do PostgreSQL
- Dashboards visuais
- Alertas automáticos

---

## 📝 Próximos Passos (Opcional)

1. ✅ Logs disponíveis e acessíveis
2. ⏳ Configurar rotação de logs (logrotate)
3. ⏳ Configurar alertas automáticos
4. ⏳ Implementar dashboard de monitoramento
5. ⏳ Configurar retenção de logs (quanto tempo manter)

---

**Última atualização**: 12 de Janeiro de 2026  
**Status**: ✅ Logs configurados e disponíveis
