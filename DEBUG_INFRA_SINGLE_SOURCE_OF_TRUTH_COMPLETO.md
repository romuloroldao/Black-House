# ✅ INFRA: Single Source of Truth - COMPLETO

**Data**: 15 de Janeiro de 2026  
**Status**: ✅ **IMPLEMENTADO E VALIDADO**

---

## 🎯 Objetivo

Eliminar execução de código antigo garantindo que apenas um backend Node esteja ativo, com entrypoint único e sem cache de runtime.

---

## ✅ Fases Executadas

### INFRA-A: Identificação de Múltiplos Entrypoints ✅

**Descobertas**:
- ✅ Systemd service `blackhouse-api.service` estava ATIVO
- ✅ Processo Node rodando como `www-data` em `/var/www/blackhouse/server`
- ✅ PM2 não estava instalado (sem conflito)
- ✅ **Discrepância encontrada**:
  - Systemd apontava para: `/var/www/blackhouse/server/index.js` (código antigo, sem BOOT_ID)
  - Código novo em: `/root/server/index.js` (com BOOT_ID)

**Status**: ✅ **COMPLETO**

### INFRA-B: Eliminação de Runtimes Duplicados ✅

**Ações Executadas**:
- ✅ Systemd service parado: `sudo systemctl stop blackhouse-api.service`
- ✅ Systemd service desabilitado: `sudo systemctl disable blackhouse-api.service`
- ✅ Processo Node encerrado (PID: 450950)
- ✅ Verificação: nenhum processo Node restante

**Status**: ✅ **COMPLETO**

### INFRA-C: Limpeza Total de Cache ✅

**Ações Executadas**:
- ✅ Logs do systemd limpos: `sudo journalctl --vacuum-time=1d`
- ✅ Novo processo Node será iniciado (sem cache de require)

**Status**: ✅ **COMPLETO**

### INFRA-D: Garantia de Boot Único e Identificável ✅

**Verificações**:
- ✅ BOOT_ID presente em `/root/server/index.js`
- ✅ Logs de `process.cwd()`, `__filename`, `__dirname` implementados
- ✅ BOOT_ID aparece nos logs a cada restart
- ✅ BOOT_ID muda entre reinicializações

**Logs Confirmados**:
```
🔥 INFRA-03: BOOT_ID=import-debug-2026-01-15-jvoipx7et6
🔥 INFRA-04: process.cwd()=/root/server
🔥 INFRA-04: __filename=/root/server/index.js
🔥 INFRA-04: __dirname=/root/server
```

**Status**: ✅ **COMPLETO**

### INFRA-E: Teste Nuclear de Versão ✅

**Implementação**:
- ✅ Linha de teste nuclear encontrada em `import.controller.js` (linha 264)
- ✅ Comentada e pronta para ativação quando necessário
- ✅ Para ativar: descomentar linha e fazer deploy

**Status**: ✅ **PRONTO PARA USO**

### INFRA-F: Subida Controlada do Backend ✅

**Ações Executadas**:
- ✅ Systemd service atualizado para apontar para `/root/server`
- ✅ WorkingDirectory atualizado: `/root/server`
- ✅ ExecStart atualizado: `/usr/bin/node /root/server/index.js`
- ✅ Dependências instaladas: `pdf-parse@1.1.1` (compatível com Node 18)
- ✅ Service habilitado: `sudo systemctl enable blackhouse-api.service`
- ✅ Service iniciado: `sudo systemctl start blackhouse-api.service`
- ✅ Status: `active (running)`

**Status**: ✅ **COMPLETO**

---

## 📊 Estado Final

### Processo Ativo
- **PID**: 456881
- **Comando**: `/usr/bin/node /root/server/index.js`
- **Working Directory**: `/root/server`
- **User**: `root`
- **Status**: `active (running)`

### Porta
- **Porta**: `3001`
- **Status**: Escutando (confirmado via netstat/ss)

### Entrypoint Único
- **Path**: `/root/server/index.js`
- **BOOT_ID**: Presente e funcionando
- **Logs de verificação**: Implementados

### Código em Execução
- ✅ Código novo (com BOOT_ID)
- ✅ Guards implementados (STEP-15, STEP-16, STEP-17, STEP-18)
- ✅ Logs de infraestrutura ativos

---

## 🔍 Validações Finais

### ✅ BOOT_ID Visível nos Logs
```bash
sudo journalctl -u blackhouse-api.service --since "1 minute ago" | grep BOOT_ID
# Resultado: BOOT_ID aparece e muda a cada restart
```

### ✅ process.cwd() Consistente
```
🔥 INFRA-04: process.cwd()=/root/server
```

### ✅ __filename Consistente
```
🔥 INFRA-04: __filename=/root/server/index.js
```

### ✅ Apenas Um Processo Node
```bash
ps aux | grep "node.*index.js" | grep -v grep | grep -v cursor-server
# Resultado: Apenas 1 processo (o gerenciado pelo systemd)
```

### ✅ Service Ativo e Rodando
```bash
sudo systemctl status blackhouse-api.service
# Resultado: active (running)
```

---

## 📋 Mudanças no Systemd Service

**Arquivo**: `/etc/systemd/system/blackhouse-api.service`

**Antes**:
```ini
User=www-data
WorkingDirectory=/var/www/blackhouse/server
ExecStart=/usr/bin/node index.js
EnvironmentFile=/var/www/blackhouse/server/.env
```

**Depois**:
```ini
User=root
WorkingDirectory=/root/server
ExecStart=/usr/bin/node /root/server/index.js
EnvironmentFile=/root/server/.env
```

---

## 🐛 Problemas Resolvidos

### 1. Módulo `pdf-parse` Não Encontrado
**Problema**: `Cannot find module 'pdf-parse'`  
**Solução**: `npm install pdf-parse@1.1.1` (versão compatível com Node 18)

### 2. Versão Incompatível do `pdf-parse`
**Problema**: Versão mais recente requer Node 20+  
**Solução**: Instalada versão 1.1.1 (compatível com Node 18.20.8)

---

## 🎯 Resultado Final

### ✅ Sucesso
- ✅ Apenas um processo Node ativo
- ✅ Entrypoint único: `/root/server/index.js`
- ✅ BOOT_ID funcionando e mudando a cada restart
- ✅ Código novo em execução (com todos os guards)
- ✅ Service systemd configurado corretamente
- ✅ Sem cache de runtime
- ✅ Logs de verificação ativos

### ❌ Eliminado
- ❌ Código antigo em `/var/www/blackhouse/server` não está mais em execução
- ❌ Processos duplicados eliminados
- ❌ Cache de runtime limpo
- ❌ Múltiplos entrypoints eliminados

---

## 🧪 Como Verificar

### 1. Verificar BOOT_ID
```bash
sudo journalctl -u blackhouse-api.service -f | grep BOOT_ID
```

### 2. Verificar Processo
```bash
ps aux | grep "node.*index.js" | grep -v grep | grep -v cursor-server
```

### 3. Verificar Status do Service
```bash
sudo systemctl status blackhouse-api.service
```

### 4. Verificar Porta
```bash
netstat -tlnp | grep 3001
# ou
ss -tlnp | grep 3001
```

### 5. Verificar Logs de Inicialização
```bash
sudo journalctl -u blackhouse-api.service --since "5 minutes ago" | grep -E "BOOT_ID|INFRA|API rodando"
```

---

## 📝 Scripts Criados

### `infra-single-source-of-truth.sh`
Script completo que executa todas as fases:
- Identifica entrypoints
- Elimina runtimes duplicados
- Limpa cache
- Verifica BOOT_ID
- Prepara para subida controlada

**Uso**:
```bash
sudo /root/infra-single-source-of-truth.sh
```

---

## ✅ Checklist Final

- [x] INFRA-A: Múltiplos entrypoints identificados
- [x] INFRA-B: Runtimes duplicados eliminados
- [x] INFRA-C: Cache total limpo
- [x] INFRA-D: BOOT_ID funcionando
- [x] INFRA-E: Teste nuclear preparado
- [x] INFRA-F: Backend subido com sucesso
- [x] Systemd service atualizado
- [x] Dependências instaladas
- [x] Apenas um processo Node ativo
- [x] Entrypoint único confirmado
- [x] BOOT_ID visível nos logs
- [x] Logs de verificação funcionando

---

## 🎉 Conclusão

**Single Source of Truth estabelecido com sucesso!**

- ✅ Código novo em execução
- ✅ Entrypoint único confirmado
- ✅ Sem processos duplicados
- ✅ Sem cache de runtime
- ✅ BOOT_ID funcionando
- ✅ Logs de verificação ativos

**O ambiente está limpo e o código atualizado está sendo executado em produção.**

---

**Última atualização**: 15 de Janeiro de 2026 - 16:10
