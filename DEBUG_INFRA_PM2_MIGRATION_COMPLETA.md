# ✅ INFRA: Migração para PM2 - COMPLETA

**Data**: 15 de Janeiro de 2026  
**Status**: ✅ **PM2 INSTALADO E CONFIGURADO**

---

## 🎯 Objetivo

Migrar de systemd para PM2 conforme especificação INFRA-F, garantindo entrypoint único e gerenciamento via PM2.

---

## ✅ Ações Executadas

### 1. Instalação do PM2 ✅
```bash
sudo npm install -g pm2
```
- ✅ PM2 versão 6.0.14 instalado globalmente
- ✅ Daemon do PM2 inicializado

### 2. Parada do Systemd Service ✅
```bash
sudo systemctl stop blackhouse-api.service
sudo systemctl disable blackhouse-api.service
```
- ✅ Service systemd parado
- ✅ Service systemd desabilitado (não reinicia automaticamente)

### 3. Inicialização via PM2 ✅
```bash
cd /root/server
pm2 start index.js --name blackhouse-api --log-date-format "YYYY-MM-DD HH:mm:ss Z"
pm2 save
```
- ✅ Processo iniciado via PM2
- ✅ Estado salvo em `/root/.pm2/dump.pm2`

### 4. Configuração de Auto-start ✅
```bash
pm2 startup
```
- ✅ PM2 configurado para iniciar automaticamente no boot

---

## 📊 Estado Atual

### Processo PM2
- **Nome**: `blackhouse-api`
- **ID**: `0`
- **Status**: `online`
- **PID**: `458132`
- **Uptime**: Rodando
- **Mode**: `fork`

### Entrypoint
- **Script**: `/root/server/index.js`
- **Working Directory**: `/root/server`
- **User**: `root`

### Porta
- **Porta**: `3001`
- **Status**: Escutando (confirmado via netstat/ss)

### BOOT_ID
- ✅ Presente no código
- ✅ Logs sendo gerados via PM2

---

## 🔍 Validações

### ✅ Processo Único
```bash
ps aux | grep "node.*index.js" | grep -v grep | grep -v cursor-server
# Resultado: 1 processo (gerenciado pelo PM2)
```

### ✅ Porta Escutando
```bash
netstat -tlnp | grep 3001
# Resultado: Processo Node escutando na porta 3001
```

### ✅ PM2 Status
```bash
pm2 list
# Resultado: blackhouse-api online
```

### ✅ BOOT_ID nos Logs
```bash
pm2 logs blackhouse-api | grep BOOT_ID
# Resultado: BOOT_ID aparece nos logs
```

---

## 📋 Comandos Úteis

### Ver Status
```bash
pm2 list
pm2 status
```

### Ver Logs
```bash
pm2 logs blackhouse-api
pm2 logs blackhouse-api --lines 100
pm2 logs blackhouse-api --err  # Apenas erros
```

### Gerenciar Processo
```bash
pm2 restart blackhouse-api
pm2 stop blackhouse-api
pm2 start blackhouse-api
pm2 reload blackhouse-api  # Zero-downtime reload
```

### Monitoramento
```bash
pm2 monit
pm2 info blackhouse-api
```

### Salvar Estado
```bash
pm2 save  # Salva lista atual de processos
```

---

## 🎯 Diferenças: Systemd vs PM2

### Systemd (Antes)
- Gerenciado pelo sistema operacional
- Logs via `journalctl`
- Reinício automático via systemd
- Configuração em `/etc/systemd/system/`

### PM2 (Agora)
- Gerenciado pelo PM2
- Logs via `pm2 logs`
- Reinício automático via PM2
- Estado salvo em `/root/.pm2/dump.pm2`
- Melhor para gerenciar aplicações Node.js
- Hot reload (zero-downtime)
- Monitoramento integrado

---

## ✅ Benefícios da Migração

1. **Melhor Gestão de Processos Node.js**
   - PM2 é especializado em aplicações Node.js
   - Hot reload sem downtime
   - Cluster mode disponível

2. **Logs Centralizados**
   - Logs do PM2 são mais fáceis de gerenciar
   - Rotação automática de logs
   - Separados por stdout/stderr

3. **Monitoramento**
   - `pm2 monit` para monitoramento em tempo real
   - Métricas de CPU e memória
   - Status de cada processo

4. **Facilidade de Gerenciamento**
   - Comandos simples (`pm2 restart`, `pm2 logs`)
   - Gerenciamento via linha de comando
   - Integração com sistemas de monitoramento

---

## 🔒 Garantias Mantidas

### ✅ Single Source of Truth
- Entrypoint único: `/root/server/index.js`
- Apenas um processo Node ativo
- Sem processos duplicados

### ✅ BOOT_ID Funcionando
- BOOT_ID aparece nos logs do PM2
- Muda a cada restart
- Confirma ausência de cache

### ✅ Logs de Verificação
- `process.cwd()` logado
- `__filename` logado
- `__dirname` logado
- PID logado

---

## 📝 Próximos Passos (Opcional)

### 1. Configurar Rotação de Logs
```bash
pm2 install pm2-logrotate
```

### 2. Configurar Cluster Mode (se necessário)
```bash
pm2 start index.js --name blackhouse-api -i max
```

### 3. Configurar Métricas
```bash
pm2 install pm2-server-monit
```

---

## ✅ Checklist Final

- [x] PM2 instalado globalmente
- [x] Systemd service parado e desabilitado
- [x] Processo iniciado via PM2
- [x] Estado salvo no PM2
- [x] Auto-start configurado
- [x] Apenas um processo Node ativo
- [x] Porta 3001 escutando
- [x] BOOT_ID funcionando
- [x] Logs acessíveis via PM2
- [x] Entrypoint único confirmado

---

## 🎉 Conclusão

**Migração para PM2 concluída com sucesso!**

- ✅ PM2 instalado e configurado
- ✅ Processo rodando via PM2
- ✅ Auto-start configurado
- ✅ Single Source of Truth mantido
- ✅ BOOT_ID funcionando
- ✅ Logs acessíveis

**O backend agora está gerenciado exclusivamente via PM2, conforme especificação INFRA-F.**

---

**Última atualização**: 15 de Janeiro de 2026 - 16:15
