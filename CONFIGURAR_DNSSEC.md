# 🔐 Como Configurar DNSSEC no Registro.br

## O que é DNSSEC?

**DNSSEC** (Domain Name System Security Extensions) é uma extensão de segurança do DNS que:
- ✅ Protege contra ataques de **envenenamento de cache DNS**
- ✅ Garante **autenticidade** das respostas DNS
- ✅ Valida a **integridade** dos dados DNS
- ✅ Melhora a **segurança** do domínio

---

## ✅ Vantagens de Configurar DNSSEC

1. **Maior Segurança:** Proteção contra manipulação de respostas DNS
2. **Confiabilidade:** Garante que os usuários acessem o site correto
3. **Boa Prática:** Padrão de segurança recomendado para domínios
4. **Gratuito:** Quando usando DNS do Registro.br

---

## 📋 Pré-requisitos

- ✅ Domínio `blackhouse.app.br` ativo
- ✅ Servidores DNS do Registro.br configurados:
  - `a.auto.dns.br`
  - `b.auto.dns.br`

---

## 🚀 Como Configurar DNSSEC no Registro.br

### Passo 1: Acessar o Painel do Registro.br

1. Acesse: https://registro.br
2. Faça login com sua conta
3. Vá em **"Meus Domínios"**
4. Selecione **`blackhouse.app.br`**

### Passo 2: Encontrar a Opção DNSSEC

Procure por uma das seguintes opções na página do domínio:

#### Opção A: Na Seção DNS

1. Na seção **"DNS"** (onde mostra os servidores)
2. Clique em **"Alterar servidores DNS"**
3. **Dentro do modal:**
   - Procure por um botão **"+ DNSSEC"** ou **"Adicionar DNSSEC"**
   - OU uma aba/guia chamada **"DNSSEC"**
   - OU um link **"Configurar DNSSEC"**

#### Opção B: Menu Separado

1. Procure por uma seção específica **"DNSSEC"** na página do domínio
2. OU um link no menu lateral/superior chamado **"DNSSEC"**
3. OU uma aba chamada **"Segurança"** ou **"DNS"** com opção DNSSEC

#### Opção C: Dentro da Configuração DNS

1. Se você encontrar a opção de **"Gerenciar DNS"** ou **"Zona DNS"**
2. Dentro dessa seção, procure por **"DNSSEC"** ou **"Segurança"**

### Passo 3: Ativar DNSSEC

**Quando encontrar a opção DNSSEC:**

1. Clique em **"Ativar DNSSEC"**, **"Configurar DNSSEC"** ou **"+ DNSSEC"**

2. O Registro.br pode oferecer duas opções:

   **Opção A: Ativação Automática (Recomendado)**
   - Se houver um botão **"Ativar DNSSEC"** ou **"Habilitar DNSSEC"**
   - Clique e o Registro.br configura automaticamente
   - Não é necessário fornecer registros DS manualmente

   **Opção B: Configuração Manual (Se necessário)**
   - Se pedir registros DS, mas como você usa DNS do Registro.br, geralmente não é necessário
   - Se realmente pedir, será necessário gerar as chaves (veja seção abaixo)

3. Confirme a ativação

4. Aguarde alguns minutos para a ativação ser aplicada (pode levar até 1 hora)

---

## 🔍 Verificar se DNSSEC está Ativo

Após configurar, aguarde alguns minutos e verifique:

### Verificação 1: Consulta DS

```bash
dig DS blackhouse.app.br +short
```

Se DNSSEC estiver ativo, deve retornar registros DS (um ou mais registros com números).

### Verificação 2: Consulta DNSKEY

```bash
dig DNSKEY blackhouse.app.br +dnssec
```

Deve retornar registros DNSKEY se DNSSEC estiver ativo.

### Verificação 3: Validação DNSSEC

```bash
dig blackhouse.app.br +dnssec +cd
```

O flag `+dnssec` deve mostrar registros RRSIG (assinaturas).

---

## ⚙️ Configuração Manual (Se Necessário)

**⚠️ Nota:** Geralmente NÃO é necessário quando usando DNS do Registro.br, mas caso o Registro.br peça os registros DS manualmente:

### Gerar Chaves DNSSEC (Servidor)

Se o Registro.br exigir registros DS e você precisar gerá-los manualmente (geralmente só necessário se estivesse usando servidores DNS próprios):

```bash
# Instalar BIND se não estiver instalado
sudo apt update
sudo apt install bind9 bind9utils bind9-doc

# Gerar chaves DNSSEC
sudo dnssec-keygen -a RSASHA256 -b 2048 -n ZONE blackhouse.app.br
sudo dnssec-keygen -f KSK -a RSASHA256 -b 4096 -n ZONE blackhouse.app.br
```

Mas como você está usando DNS do Registro.br (`a.auto.dns.br` e `b.auto.dns.br`), o Registro.br geralmente gerencia isso automaticamente.

---

## 📋 Ordem de Configuração Recomendada

1. ✅ **Configurar Servidores DNS do Registro.br** (já feito)
   - `a.auto.dns.br`
   - `b.auto.dns.br`

2. ✅ **Configurar Registros A** (próximo passo)
   - @ → 177.153.64.95
   - www → 177.153.64.95
   - api → 177.153.64.95

3. ✅ **Ativar DNSSEC** (pode fazer agora ou depois)
   - Ativar no painel do Registro.br

4. ✅ **Configurar SSL** (depois que DNS propagar)
   - `sudo bash /root/deploy-completo.sh`

---

## ⚠️ Observações Importantes

### 1. DNS do Registro.br

Quando você usa os servidores DNS do Registro.br (`a.auto.dns.br` e `b.auto.dns.br`), o DNSSEC geralmente é **ativado diretamente no painel**, sem necessidade de configuração manual no servidor.

### 2. Não é Obrigatório

O DNSSEC **não é obrigatório** para o funcionamento do site. É uma camada adicional de segurança. Você pode:
- ✅ Configurar os registros A primeiro
- ✅ Depois ativar DNSSEC quando quiser

### 3. Tempo de Propagação

Após ativar DNSSEC, pode levar **até 24 horas** para os registros DS serem propagados na zona pai (.br).

### 4. Compatibilidade

DNSSEC é compatível com todos os navegadores modernos e não afeta o funcionamento normal do site.

---

## 🆘 Troubleshooting

### Se não encontrar a opção DNSSEC:

1. **Aguarde:** Às vezes a opção só aparece após os DNS estarem totalmente propagados (1-2 horas)
2. **Procure em outras seções:** Pode estar em "Configurações", "Segurança" ou "Avançado"
3. **Contate Suporte:** Se não encontrar após 24 horas, contate suporte@registro.br

### Se DNSSEC não validar:

1. Aguarde propagação (até 24 horas)
2. Verifique se DNS do Registro.br está ativo:
   ```bash
   dig NS blackhouse.app.br +short
   ```
3. Verifique registros DS:
   ```bash
   dig DS blackhouse.app.br
   ```

### Se houver erro ao ativar:

1. Verifique se está usando DNS do Registro.br
2. Aguarde alguns minutos e tente novamente
3. Contate suporte do Registro.br se persistir

---

## ✅ Checklist

- [ ] Servidores DNS do Registro.br configurados
- [ ] Encontrou opção DNSSEC no painel
- [ ] Ativou DNSSEC
- [ ] Aguardou propagação (até 1 hora)
- [ ] Verificou com `dig DS blackhouse.app.br` que está ativo

---

## 📚 Recursos Adicionais

- **Documentação Oficial Registro.br:**
  - https://registro.br/suporte/faq/
  - Tutorial: https://ftp.registro.br/pub/doc/configuracao_dnssec_dominio.pdf

- **Ferramentas de Verificação:**
  - https://dnssec-analyzer.verisignlabs.com/
  - https://dnschecker.org/

---

**Última atualização:** 08/01/2026
