# 🔴 Erro "DS: Chave não encontrada" - Explicação e Solução

## ❌ Problema Atual

O erro **"DS: Chave não encontrada"** aparece quando você tenta preencher manualmente os campos de DNSSEC no Registro.br, mas as chaves DNSKEY correspondentes não estão publicadas na zona DNS.

## 🔍 Por que isso acontece?

1. **Você gerou chaves DNSSEC localmente** (no servidor)
2. **As chaves foram geradas corretamente** (Keytag: 34441, Digest válido)
3. **MAS as chaves NÃO estão publicadas** na zona DNS do domínio
4. **O Registro.br valida** o DS record verificando se existe uma chave DNSKEY correspondente
5. **Como a chave não existe na zona**, o erro é retornado

## ⚠️ Por que não funciona com DNS do Registro.br?

Quando você usa servidores DNS do Registro.br (`a.auto.dns.br` e `b.auto.dns.br`):
- ❌ Você **NÃO tem acesso** para publicar chaves DNSKEY na zona DNS
- ❌ Você **NÃO pode** configurar BIND ou outro servidor DNS para assinar a zona
- ✅ O Registro.br **gerencia tudo automaticamente**
- ✅ O Registro.br **gera e publica** as chaves DNSKEY quando você ativa DNSSEC

## ✅ SOLUÇÃO CORRETA

### Opção 1: Usar DNS do Registro.br com DNSSEC Automático (RECOMENDADO)

**Como fazer:**

1. **No formulário atual:**
   - Clique em **"UTILIZAR DNS DO REGISTRO.BR"** (botão cinza escuro)
   - Isso vai preencher automaticamente:
     - Servidor 1: `a.auto.dns.br`
     - Servidor 2: `b.auto.dns.br`

2. **Salvar configuração DNS:**
   - Clique em **"SALVAR ALTERAÇÕES"**
   - Aguarde alguns minutos

3. **Ativar DNSSEC automaticamente:**
   - Após salvar os DNS, procure uma opção **"Ativar DNSSEC"** ou **"+ DNSSEC"**
   - Se houver botão **"Ativar DNSSEC automaticamente"**, clique nele
   - O Registro.br vai:
     - ✅ Gerar as chaves DNSKEY automaticamente
     - ✅ Publicar as chaves na zona DNS
     - ✅ Criar os registros DS automaticamente
     - ✅ Configurar tudo sem você precisar preencher manualmente

4. **NÃO preencha os campos Keytag/Digest manualmente** quando usar DNS do Registro.br

### Opção 2: Usar Servidores DNS Próprios (APENAS se necessário)

Se você realmente precisa usar chaves DNSSEC específicas (geralmente NÃO é necessário):

1. **Configure seus próprios servidores DNS:**
   - Configure BIND ou outro servidor DNS no seu servidor
   - Publique as chaves DNSKEY na zona DNS
   - Configure os registros DS

2. **Configure os servidores DNS no Registro.br:**
   - Mude de `a.auto.dns.br` / `b.auto.dns.br` para seus próprios servidores DNS
   - Exemplo: `ns1.blackhouse.app.br` / `ns2.blackhouse.app.br`

3. **Preencha os registros DS:**
   - Agora sim, você pode preencher Keytag e Digest manualmente

**⚠️ ATENÇÃO:** Esta opção é muito mais complexa e geralmente NÃO é necessária!

## 📋 Resumo das Soluções

| Situação | Solução |
|----------|---------|
| **Usando DNS do Registro.br** | ✅ Usar ativação automática de DNSSEC no painel |
| **Preenchendo DS manualmente** | ❌ NÃO funciona (chave não publicada) |
| **Servidores DNS próprios** | ✅ Funciona (mas é complexo e desnecessário) |

## 🎯 Recomendação Final

**Para o seu caso (usando DNS do Registro.br):**

1. ❌ **NÃO preencha** os campos Keytag/Digest manualmente
2. ✅ Clique em **"UTILIZAR DNS DO REGISTRO.BR"**
3. ✅ Procure opção **"Ativar DNSSEC"** no painel (pode estar em outra seção)
4. ✅ Use a ativação **automática** do Registro.br
5. ✅ O Registro.br vai gerar e configurar tudo automaticamente

## 🔍 Como Verificar se DNSSEC está Ativo (Depois de Ativar)

Após ativar DNSSEC no Registro.br, aguarde alguns minutos e verifique:

```bash
# Verificar registros DS
dig DS blackhouse.app.br +short

# Verificar chaves DNSKEY
dig DNSKEY blackhouse.app.br +short

# Verificar validação DNSSEC
dig blackhouse.app.br +dnssec
```

Se DNSSEC estiver ativo, você verá registros DS e DNSKEY.

## ❓ FAQ

**P: Por que os campos Keytag/Digest aparecem então?**
R: Eles aparecem para casos onde você usa servidores DNS próprios. Quando usa DNS do Registro.br, geralmente há uma opção de "Ativar DNSSEC automaticamente" que não requer preencher esses campos.

**P: Preciso usar as chaves que gerei?**
R: Não! Se você está usando DNS do Registro.br, o Registro.br vai gerar novas chaves automaticamente. As chaves que você gerou localmente podem ser deletadas ou guardadas apenas para referência.

**P: Como encontrar a opção de ativar DNSSEC automaticamente?**
R: Procure no painel do Registro.br por:
- "Ativar DNSSEC"
- "Configurar DNSSEC"
- "Segurança" → "DNSSEC"
- Pode estar na mesma página dos servidores DNS
- Ou em uma seção separada de "Segurança" ou "Configurações Avançadas"

---

**Data:** $(date)
**Domínio:** blackhouse.app.br
**DNS Atual:** a.auto.dns.br, b.auto.dns.br
