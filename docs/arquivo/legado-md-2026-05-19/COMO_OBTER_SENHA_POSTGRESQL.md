# 🔑 Como Obter a Senha do PostgreSQL do Supabase

Para exportar os dados completos usando `pg_dump`, você precisa da **senha do PostgreSQL**, não das chaves de API.

## 📋 Método 1: Via Dashboard do Supabase

### Passo a Passo:

1. **Acesse o Dashboard**
   - Vá para: https://supabase.com/dashboard
   - Faça login na sua conta

2. **Selecione o Projeto**
   - Clique no projeto: `cghzttbggklhuyqxzabq`

3. **Acesse Settings → Database**
   - No menu lateral, clique em **"Settings"** (ícone de engrenagem)
   - Clique em **"Database"** no submenu

4. **Encontre a Connection String**
   - Procure por **"Connection string"** ou **"Connection pooling"**
   - Você verá algo como:
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.cghzttbggklhuyqxzabq.supabase.co:5432/postgres
     ```
   - A senha está no lugar de `[YOUR-PASSWORD]`

5. **Se não encontrar a senha:**
   - Procure por **"Database password"** ou **"Reset database password"**
   - Clique em **"Reset database password"** se necessário
   - Uma nova senha será gerada e exibida

## 📋 Método 2: Via Connection String

1. No Dashboard, vá em **Settings → Database**
2. Procure por **"Connection string"**
3. Selecione **"URI"** ou **"Connection pooling"**
4. A senha estará na string de conexão

Exemplo de string:
```
postgresql://postgres:SUA_SENHA_AQUI@db.cghzttbggklhuyqxzabq.supabase.co:5432/postgres
```

## 📋 Método 3: Resetar Senha

Se você não conseguir encontrar a senha:

1. Vá em **Settings → Database**
2. Procure por **"Database password"** ou **"Reset password"**
3. Clique em **"Reset database password"**
4. **IMPORTANTE**: Copie a senha imediatamente, ela só será mostrada uma vez!
5. Salve a senha em local seguro

## ⚠️ Diferença Importante

- **SUPABASE_ANON_KEY**: Chave pública para API (já fornecida)
- **SUPABASE_SERVICE_ROLE_KEY**: Chave privada para API (não funciona com pg_dump)
- **Senha do PostgreSQL**: Senha do banco de dados PostgreSQL (necessária para pg_dump)

## 🚀 Após Obter a Senha

```bash
# Definir senha como variável de ambiente
export SUPABASE_PASSWORD='sua_senha_aqui'

# Executar exportação
cd /root
./scripts/exportar-supabase-completo.sh
```

## 🔐 Segurança

- **NÃO** compartilhe a senha do PostgreSQL publicamente
- **NÃO** commite a senha no Git
- Use variáveis de ambiente ou arquivos `.env` (não versionados)
- Após a migração, você pode resetar a senha no Supabase

## 📞 Alternativas

Se não conseguir obter a senha:

1. **Usar Supabase CLI** (requer login):
   ```bash
   npx supabase login
   npx supabase db dump --project-ref cghzttbggklhuyqxzabq
   ```

2. **Exportar via Dashboard**:
   - Vá em **Database → Backups**
   - Crie um backup manual
   - Baixe o arquivo SQL

3. **Usar Service Role Key via API** (limitado):
   - Pode exportar dados via API REST
   - Mas não é completo como pg_dump
   - Requer implementação customizada

## ✅ Verificação

Após obter a senha, teste a conexão:

```bash
export SUPABASE_PASSWORD='sua_senha'
psql "postgresql://postgres:${SUPABASE_PASSWORD}@db.cghzttbggklhuyqxzabq.supabase.co:5432/postgres" -c "SELECT version();"
```

Se funcionar, você verá a versão do PostgreSQL. Se não funcionar, verifique se a senha está correta.
