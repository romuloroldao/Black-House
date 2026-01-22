# ✅ Checklist de Backup COMPLETO do Supabase

## 🎯 Objetivo: Ter TUDO do projeto para migrar para seu servidor

---

## 📋 Passo 1: Backup do Banco de Dados (via Assistente)

### Respostas ao Assistente:

1. **Schema:** `Todos os schemas do projeto`
2. **Sequences:** `Usar last_value (preservar próximo valor atual)`
3. **RLS/Funções/Dados:** `DDL + dados (INSERTs para cada tabela)`
4. **Formato:** `Um único arquivo SQL (.sql)`

### ✅ Inclui:
- [x] Estrutura completa (tabelas, views, índices)
- [x] Todos os dados (INSERTs de todas as tabelas)
- [x] RLS Policies (Row Level Security)
- [x] Funções e triggers
- [x] Sequences com valores atuais
- [x] Todos os schemas (public, auth, storage, etc)

### 📥 Resultado:
- Arquivo: `backup_completo.sql` (ou nome que você escolher)
- Tamanho: Pode ser grande (depende dos dados)
- Formato: SQL puro, importável em qualquer PostgreSQL

---

## 📋 Passo 2: Backup dos Arquivos do Storage (Fotos/Documentos)

### ⚠️ IMPORTANTE: O export SQL NÃO inclui arquivos!

Você precisa fazer backup separado dos arquivos.

### Opção 1: Download pelo Painel (Recomendado)

1. Acesse: https://app.supabase.com/project/cghzttbggklhuyqxzabq
2. Vá em **Storage**
3. Para cada bucket:
   - **Bucket `avatars`** (fotos de perfil):
     - Abra o bucket
     - Selecione todos os arquivos
     - Baixe (ou baixe arquivo por arquivo)
   
   - **Bucket `progress-photos`** (fotos de progresso):
     - Abra o bucket
     - Selecione todos os arquivos
     - Baixe
   
   - **Outros buckets** que você criou:
     - Repita o processo

### Opção 2: Supabase CLI (se tiver acesso)

```bash
# Instalar CLI
npm install -g supabase

# Login
supabase login

# Listar buckets
supabase storage list --project-ref cghzttbggklhuyqxzabq

# Download de cada bucket
supabase storage download avatars --project-ref cghzttbggklhuyqxzabq --output ./backup/storage/avatars
supabase storage download progress-photos --project-ref cghzttbggklhuyqxzabq --output ./backup/storage/progress-photos
```

### Estrutura de Diretórios para Backup:

```
/root/backup-supabase/
├── backup_completo.sql          (export do banco)
└── storage/                     (arquivos do storage)
    ├── avatars/                 (fotos de perfil)
    │   ├── foto1.jpg
    │   ├── foto2.png
    │   └── ...
    ├── progress-photos/         (fotos de progresso)
    │   ├── progress1.jpg
    │   └── ...
    └── outros-buckets/          (se tiver mais)
```

---

## 📋 Passo 3: Verificar Buckets no Projeto

### Como descobrir quais buckets existem:

1. **Via Painel:**
   - Acesse: https://app.supabase.com/project/cghzttbggklhuyqxzabq
   - Vá em **Storage**
   - Veja a lista de buckets disponíveis

2. **Via API (se tiver service_role key):**
   ```bash
   curl -X GET \
     "https://cghzttbggklhuyqxzabq.supabase.co/storage/v1/bucket" \
     -H "apikey: YOUR_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
   ```

### Buckets Comuns em Projetos Supabase:

- `avatars` - Fotos de perfil de usuários
- `progress-photos` - Fotos de progresso/acompanhamento
- `documents` - Documentos diversos
- `public` - Arquivos públicos

---

## 📋 Passo 4: Configurações Adicionais (Opcional)

### Auth Providers (se configurado):
- [ ] Google OAuth
- [ ] GitHub OAuth
- [ ] Email/Password settings
- [ ] Templates de email

### Edge Functions (se tiver):
- [ ] Listar e baixar functions
- [ ] Configurações de deploy

### Webhooks (se configurado):
- [ ] URLs e configurações
- [ ] Eventos monitorados

### Variáveis de Ambiente:
- [ ] Anotar variáveis importantes
- [ ] Secrets (não exportáveis, mas documentar)

---

## ✅ Checklist Final Completo

### Banco de Dados:
- [ ] Export SQL baixado e salvo
- [ ] Testado importação local (opcional, mas recomendado)
- [ ] Verificado tamanho do arquivo

### Storage/Arquivos:
- [ ] Listados todos os buckets existentes
- [ ] Bucket `avatars` - Baixado
- [ ] Bucket `progress-photos` - Baixado
- [ ] Outros buckets - Baixados
- [ ] Arquivos organizados em pastas

### Documentação:
- [ ] Anotada lista de buckets
- [ ] Anotadas configurações importantes
- [ ] Backup organizado e rotulado

### Verificação:
- [ ] Backup SQL está completo
- [ ] Arquivos do Storage estão completos
- [ ] Estrutura de diretórios organizada
- [ ] Backup está em local seguro

---

## 🚀 Próximos Passos Após Backup

Depois de ter o backup completo:

1. **Importar banco de dados no PostgreSQL local:**
   ```bash
   psql -h localhost -p 5433 -U app_user -d blackhouse_db -f backup_completo.sql
   ```

2. **Migrar arquivos do Storage:**
   - Copiar arquivos para `/var/www/blackhouse/storage/` (ou onde configurar)
   - Atualizar paths no banco se necessário
   - Configurar serviço de armazenamento local

3. **Configurar aplicação:**
   - Atualizar variáveis de ambiente
   - Configurar novos caminhos de arquivos
   - Testar importação completa

---

## 📄 Arquivos de Referência

- `/root/backup-supabase/RESPOSTAS_ASSISTENTE_SUPABASE.md` - Respostas detalhadas
- `/root/backup-supabase/GUIA_FINAL_COMPLETO.md` - Guia completo de backup
- `/root/backup-supabase/backup-storage-fotos.sh` - Script de ajuda (requer configuração)

---

**Data:** $(date)
**Status:** ✅ Checklist completo para backup total
