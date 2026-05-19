# 📋 Instruções para Configurar DNS no Registro.br

## 🌐 Informações da VPS

- **IP Público**: `177.153.64.95`
- **Domínio**: `blackhouse.app.br`
- **Subdomínios necessários**:
  - `blackhouse.app.br` (principal)
  - `www.blackhouse.app.br`
  - `api.blackhouse.app.br`

---

## 📝 Passo a Passo Detalhado

### Passo 1: Acessar o Painel

1. Acesse: **https://registro.br**
2. Faça login com sua conta
3. No menu, clique em **"Meus Domínios"**
4. Procure e clique em **"blackhouse.app.br"**

### Passo 2: Acessar Gerenciamento DNS

1. Na página do domínio, procure por:
   - **"Gerenciar DNS"** ou
   - **"Zona DNS"** ou
   - **"DNS"** ou
   - **"Configurações DNS"**

2. Clique para abrir a configuração de DNS

### Passo 3: Configurar Registros A

Você precisa criar **3 registros do tipo A**:

#### Registro 1: Domínio Principal (@)
```
Tipo: A
Nome/Host: @ (ou deixe em branco, ou coloque apenas o ponto final)
Valor/Conteúdo: 177.153.64.95
TTL: 3600 (ou use o padrão)
Prioridade: (deixe em branco se não houver)
```

#### Registro 2: Subdomínio www
```
Tipo: A
Nome/Host: www
Valor/Conteúdo: 177.153.64.95
TTL: 3600 (ou use o padrão)
Prioridade: (deixe em branco se não houver)
```

#### Registro 3: Subdomínio api
```
Tipo: A
Nome/Host: api
Valor/Conteúdo: 177.153.64.95
TTL: 3600 (ou use o padrão)
Prioridade: (deixe em branco se não houver)
```

### Passo 4: Salvar Configurações

1. Após adicionar os 3 registros, clique em **"Salvar"** ou **"Aplicar"**
2. Aguarde a confirmação de que as alterações foram salvas

### Passo 5: Verificar Propagação

Aguarde **15-30 minutos** e depois verifique se o DNS propagou:

#### No Servidor (já configurado):
```bash
dig blackhouse.app.br +short
dig www.blackhouse.app.br +short
dig api.blackhouse.app.br +short
```

Todos devem retornar: **177.153.64.95**

#### Online (ferramentas):
- https://www.whatsmydns.net/#A/blackhouse.app.br
- https://dnschecker.org/#A/blackhouse.app.br

---

## ⚠️ Observações Importantes

### 1. Tempo de Propagação
- **Mínimo**: 5-15 minutos
- **Normal**: 30-60 minutos
- **Máximo**: Até 48 horas (raro)

### 2. Não Configure SSL Antes
- **NÃO** execute o Certbot antes do DNS propagar
- O Let's Encrypt precisa conseguir resolver o domínio
- Aguarde confirmação de que todos os subdomínios apontam para o IP correto

### 3. Verificação Local
Você pode verificar localmente no seu computador:
```bash
# Windows (PowerShell)
nslookup blackhouse.app.br
nslookup www.blackhouse.app.br
nslookup api.blackhouse.app.br

# Linux/Mac
dig blackhouse.app.br
dig www.blackhouse.app.br
dig api.blackhouse.app.br
```

### 4. Possíveis Problemas

**Se não propagar após 1 hora:**
- Verifique se os registros foram salvos corretamente
- Confirme que o IP está correto: `177.153.64.95`
- Verifique se não há conflitos com outros registros
- Entre em contato com o suporte do Registro.br se necessário

**Se retornar IP diferente:**
- Verifique se não há cache DNS no seu computador
- Tente em outro dispositivo/rede
- Use ferramentas online de verificação DNS

---

## ✅ Checklist de Configuração

- [ ] Acessou o painel do Registro.br
- [ ] Encontrou a opção "Gerenciar DNS" ou "Zona DNS"
- [ ] Adicionou registro A para @ (raiz) → 177.153.64.95
- [ ] Adicionou registro A para www → 177.153.64.95
- [ ] Adicionou registro A para api → 177.153.64.95
- [ ] Salvou todas as alterações
- [ ] Aguardou 15-30 minutos
- [ ] Verificou propagação com `dig` ou ferramentas online
- [ ] Confirmou que todos retornam 177.153.64.95
- [ ] Pronto para configurar Nginx e SSL

---

## 🚀 Após Confirmar Propagação DNS

Quando todos os domínios estiverem apontando corretamente:

1. **Execute no servidor:**
   ```bash
   # Configurar Nginx
   sudo cp /root/deployment/nginx-blackhouse.conf /etc/nginx/sites-available/blackhouse
   sudo ln -sf /etc/nginx/sites-available/blackhouse /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   
   # Configurar SSL
   sudo certbot --nginx -d blackhouse.app.br -d www.blackhouse.app.br -d api.blackhouse.app.br
   ```

2. **Teste os domínios:**
   - https://blackhouse.app.br
   - https://www.blackhouse.app.br
   - https://api.blackhouse.app.br/health

---

## 📞 Suporte

Se tiver dúvidas sobre a configuração no Registro.br:
- **Suporte Registro.br**: https://registro.br/atendimento/
- **Documentação**: https://registro.br/manual/

---

**IMPORTANTE**: Não prossiga com SSL até confirmar que o DNS propagou completamente!
