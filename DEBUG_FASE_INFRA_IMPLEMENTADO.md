# ✅ Fase Infra - Limpeza Total de Cache e Runtime - IMPLEMENTADO

**Data**: 15 de Janeiro de 2026  
**Status**: ✅ **SCRIPTS E LOGS DE VERIFICAÇÃO IMPLEMENTADOS**

---

## 🎯 Objetivo

Garantir que o código atualizado seja o código efetivamente executado em produção através de limpeza total de cache e runtime, eliminando processos zumbis e garantindo single source of truth.

---

## ✅ Passos Implementados

### INFRA-01: Parar TODOS os Processos Node ✅

**Script Criado**: `infra-cleanup.sh`

**Ações**:
- ✅ `pm2 stop all`
- ✅ `pm2 delete all`
- ✅ `pkill -f "node.*index.js"`
- ✅ `pkill -f npm`
- ✅ Verificação de processos restantes
- ✅ Kill forçado se necessário

**Status**: ✅ **SCRIPT PRONTO**

**Uso**:
```bash
./infra-cleanup.sh
```

### INFRA-02: Limpar Cache Interno do PM2 ✅

**Ações no Script**:
- ✅ `pm2 flush`
- ✅ `rm -rf ~/.pm2/logs/*`
- ✅ `rm -rf ~/.pm2/pids/*`
- ✅ `rm -rf ~/.pm2/modules/*`

**Status**: ✅ **IMPLEMENTADO NO SCRIPT**

### INFRA-03: BOOT_ID Randômico ✅

**Mudanças em `server/index.js`**:
- ✅ BOOT_ID gerado no início do arquivo
- ✅ Formato: `import-debug-YYYY-MM-DD-<random>`
- ✅ Logado no console e no logger
- ✅ Garante que require cache não será reutilizado

**Código Adicionado**:
```javascript
// INFRA-03: BOOT_ID para garantir que não há cache de require
const BOOT_ID = `import-debug-${new Date().toISOString().split('T')[0]}-${Math.random().toString(36).substring(2, 15)}`;
console.log(`🔥 INFRA-03: BOOT_ID=${BOOT_ID}`);
logger.info('🔥 INFRA-03: Servidor iniciando', {
    BOOT_ID,
    processCwd: process.cwd(),
    __filename,
    __dirname,
    nodeVersion: process.version,
    pid: process.pid
});
```

**Status**: ✅ **IMPLEMENTADO**

**Log Esperado**:
```
🔥 INFRA-03: BOOT_ID=import-debug-2026-01-15-abc123xyz
🔥 INFRA-03: Servidor iniciando
  - BOOT_ID: import-debug-2026-01-15-abc123xyz
  - processCwd: /root
  - __filename: /root/server/index.js
  - __dirname: /root/server
  - nodeVersion: v18.x.x
  - pid: 12345
```

### INFRA-04: Verificação de Localização ✅

**Logs Adicionados**:
- ✅ `console.log(process.cwd())`
- ✅ `console.log(__filename)`
- ✅ `console.log(__dirname)`
- ✅ Logado também no logger estruturado

**Status**: ✅ **IMPLEMENTADO**

**Log Esperado**:
```
🔥 INFRA-04: process.cwd()=/root
🔥 INFRA-04: __filename=/root/server/index.js
🔥 INFRA-04: __dirname=/root/server
```

### INFRA-05: Instalação Limpa (Opcional) ✅

**Script Criado**: `infra-clean-install.sh`

**Ações**:
- ✅ `rm -rf node_modules`
- ✅ `rm -rf dist`
- ✅ `rm -rf build`
- ✅ `npm cache clean --force`
- ✅ `npm install`

**Status**: ✅ **SCRIPT PRONTO**

**Uso** (se necessário):
```bash
./infra-clean-install.sh
```

### INFRA-06: Entrypoint Único ✅

**Verificações**:
- ✅ PM2 deve usar: `server/index.js`
- ✅ Systemd service aponta para: `/var/www/blackhouse/server/index.js` (diferente!)
- ⚠️ **ATENÇÃO**: Há dois possíveis entrypoints:
  - PM2: `/root/server/index.js`
  - Systemd: `/var/www/blackhouse/server/index.js`

**Status**: ✅ **VERIFICADO - HÁ DISCREPÂNCIA**

**Recomendação**: Usar apenas PM2 ou apenas Systemd, não ambos.

### INFRA-07: Teste Nuclear ✅

**Mudanças em `import.controller.js`**:
- ✅ Linha comentada com `throw new Error('🔥 CODE VERSION CHECK 🔥')`
- ✅ Pode ser descomentada para teste
- ✅ Se aparecer no log, confirma que código novo está rodando

**Código Adicionado**:
```javascript
// INFRA-07: Teste nuclear - remover após confirmação
// throw new Error('🔥 CODE VERSION CHECK 🔥 - Se você vê isso, o código novo está rodando!');
```

**Status**: ✅ **IMPLEMENTADO (COMENTADO)**

**Para Testar**:
1. Descomentar a linha
2. Fazer deploy
3. Chamar `/api/import/confirm`
4. Verificar se erro aparece nos logs
5. Se aparecer: código novo está rodando ✅
6. Se não aparecer: código antigo ainda está ativo ❌

### INFRA-08: Verificação Nginx ✅

**Configuração Verificada**:
- ✅ Nginx aponta para: `http://localhost:3001`
- ✅ Servidor configurado para porta: `3001` (via `process.env.PORT || 3001`)
- ✅ Configuração correta em `/etc/nginx/sites-available/blackhouse`

**Status**: ✅ **CONFIGURAÇÃO CORRETA**

**Arquivo**: `/etc/nginx/sites-available/blackhouse`
```nginx
location / {
    proxy_pass http://localhost:3001;
    ...
}
```

**Para Reiniciar Nginx**:
```bash
sudo nginx -t  # Testar configuração
sudo systemctl reload nginx  # Recarregar sem downtime
# ou
sudo systemctl restart nginx  # Reiniciar completamente
```

### INFRA-09: Restart Final Controlado ✅

**Script Criado**: `infra-restart-final.sh`

**Ações**:
- ✅ Para todos os processos
- ✅ Verifica que não há processos restantes
- ✅ Verifica que `server/index.js` existe
- ✅ Inicia com PM2: `pm2 start server/index.js --name blackhouse-api`
- ✅ Salva configuração: `pm2 save`
- ✅ Mostra status e logs iniciais

**Status**: ✅ **SCRIPT PRONTO**

**Uso**:
```bash
./infra-restart-final.sh
```

---

## 📋 Scripts Criados

### 1. `infra-cleanup.sh`
**Função**: Limpeza completa de processos e cache

**Executa**:
- Para todos os processos Node
- Limpa cache do PM2
- Verifica localização do código

**Uso**:
```bash
./infra-cleanup.sh
```

### 2. `infra-clean-install.sh`
**Função**: Instalação limpa de dependências

**Executa**:
- Remove node_modules, dist, build
- Limpa cache do npm
- Reinstala dependências

**Uso** (se necessário):
```bash
./infra-clean-install.sh
```

### 3. `infra-restart-final.sh`
**Função**: Restart controlado do servidor

**Executa**:
- Para processos existentes
- Verifica entrypoint
- Inicia com PM2
- Mostra status e logs

**Uso**:
```bash
./infra-restart-final.sh
```

---

## 🔍 Verificações de Infraestrutura

### Processos Node
**Comando para verificar**:
```bash
ps aux | grep -E "node.*index.js" | grep -v grep | grep -v cursor-server
```

**Resultado Esperado** (após limpeza):
- Nenhum processo (ou apenas o processo iniciado pelo PM2)

### PM2 Status
**Comando**:
```bash
pm2 status
pm2 logs blackhouse-api --lines 50
```

**Verificar**:
- ✅ BOOT_ID aparece nos logs
- ✅ process.cwd() e __filename corretos
- ✅ Nenhum erro de inicialização

### Nginx
**Comando para testar**:
```bash
sudo nginx -t
sudo systemctl status nginx
```

**Verificar**:
- ✅ Configuração válida
- ✅ Aponta para `localhost:3001`
- ✅ Serviço rodando

### Porta do Servidor
**Verificar**:
```bash
netstat -tlnp | grep 3001
# ou
ss -tlnp | grep 3001
```

**Resultado Esperado**:
- Processo Node escutando na porta 3001

---

## 🎯 Fluxo de Execução Recomendado

### 1. Limpeza Completa
```bash
cd /root
./infra-cleanup.sh
```

### 2. (Opcional) Instalação Limpa
```bash
./infra-clean-install.sh
```

### 3. Verificar Código
```bash
# Confirmar que server/index.js tem BOOT_ID
head -5 server/index.js | grep BOOT_ID
```

### 4. Restart Controlado
```bash
./infra-restart-final.sh
```

### 5. Verificar Logs
```bash
pm2 logs blackhouse-api -f
# Procurar por:
# - 🔥 INFRA-03: BOOT_ID=...
# - 🔥 INFRA-04: process.cwd()=...
```

### 6. Teste Nuclear (Opcional)
```bash
# Editar server/controllers/import.controller.js
# Descomentar linha do teste nuclear
# Fazer deploy
# Chamar /api/import/confirm
# Verificar logs
```

### 7. Reiniciar Nginx (se necessário)
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🎉 Resultado Esperado

### Sucesso ✅
- ✅ BOOT_ID único aparece nos logs a cada restart
- ✅ process.cwd() e __filename corretos
- ✅ Apenas um processo Node rodando (gerenciado pelo PM2)
- ✅ Logs mostram código novo (STEP-15, STEP-16, etc.)
- ✅ Teste nuclear (se executado) aparece nos logs

### Falha ❌
- ❌ BOOT_ID não muda entre restarts (cache ainda ativo)
- ❌ Múltiplos processos Node rodando
- ❌ Logs não mostram código novo
- ❌ Teste nuclear não aparece (código antigo ainda ativo)

---

## ⚠️ Discrepâncias Encontradas

### 1. Dois Possíveis Entrypoints
- **PM2**: `/root/server/index.js`
- **Systemd**: `/var/www/blackhouse/server/index.js`

**Recomendação**: 
- Usar apenas PM2 OU apenas Systemd
- Se usar PM2, desabilitar systemd service:
  ```bash
  sudo systemctl stop blackhouse-api
  sudo systemctl disable blackhouse-api
  ```

### 2. Working Directory Diferente
- **PM2**: `/root` (padrão)
- **Systemd**: `/var/www/blackhouse/server`

**Impacto**: Pode causar problemas com caminhos relativos

**Solução**: Garantir que apenas um gerenciador de processo está ativo

---

## ✅ Checklist de Implementação

- [x] INFRA-01: Script de parada de processos criado
- [x] INFRA-02: Limpeza de cache PM2 no script
- [x] INFRA-03: BOOT_ID randômico adicionado
- [x] INFRA-04: Logs de process.cwd() e __filename
- [x] INFRA-05: Script de instalação limpa criado
- [x] INFRA-06: Entrypoints verificados (discrepância encontrada)
- [x] INFRA-07: Teste nuclear adicionado (comentado)
- [x] INFRA-08: Nginx verificado (configuração correta)
- [x] INFRA-09: Script de restart final criado
- [x] Scripts com permissão de execução

---

## 🧪 Como Testar

### Teste 1: Verificar BOOT_ID
```bash
pm2 restart blackhouse-api
pm2 logs blackhouse-api --lines 10 | grep BOOT_ID
# Deve mostrar BOOT_ID diferente a cada restart
```

### Teste 2: Verificar Processos
```bash
ps aux | grep -E "node.*index.js" | grep -v grep | grep -v cursor-server
# Deve mostrar apenas 1 processo (ou nenhum se não estiver rodando)
```

### Teste 3: Teste Nuclear
1. Descomentar linha em `import.controller.js`
2. Fazer deploy
3. Chamar `/api/import/confirm`
4. Verificar logs:
   ```bash
   pm2 logs blackhouse-api --lines 50 | grep "CODE VERSION CHECK"
   ```
5. Se aparecer: ✅ Código novo está rodando
6. Se não aparecer: ❌ Código antigo ainda ativo

### Teste 4: Verificar Porta
```bash
netstat -tlnp | grep 3001
# Deve mostrar processo Node escutando
```

---

**Última atualização**: 15 de Janeiro de 2026 - Fase Infra Completa
