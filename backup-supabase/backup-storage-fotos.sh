#!/bin/bash
# Script para backup dos arquivos do Storage (fotos, documentos, etc)
# ⚠️ IMPORTANTE: Este backup é complementar ao export SQL do banco

set -e

BACKUP_DIR="/root/backup-supabase/storage"
SUPABASE_URL="https://cghzttbggklhuyqxzabq.supabase.co"
SUPABASE_KEY="${SUPABASE_KEY:-}"

echo "=========================================="
echo "  BACKUP STORAGE/ARQUIVOS DO SUPABASE"
echo "=========================================="
echo ""

# Verificar se SUPABASE_KEY está configurada
if [ -z "$SUPABASE_KEY" ]; then
    echo "❌ ERRO: SUPABASE_KEY não configurada!"
    echo ""
    echo "Configure a variável:"
    echo "  export SUPABASE_KEY='sua-service-role-key'"
    echo ""
    echo "Para obter a chave:"
    echo "  1. Acesse: https://app.supabase.com/project/cghzttbggklhuyqxzabq"
    echo "  2. Vá em Settings → API"
    echo "  3. Copie 'service_role key' (precisa ser service_role para acessar storage)"
    exit 1
fi

# Criar diretório de backup
mkdir -p "$BACKUP_DIR"

echo "✅ Backup do Storage requer:"
echo "   1. service_role key (não anon key)"
echo "   2. Acesso via API REST ou painel"
echo ""
echo "⚠️  RECOMENDAÇÃO: Use o Painel do Supabase para backup de arquivos"
echo ""
echo "Passo a passo no painel:"
echo "1. Acesse: https://app.supabase.com/project/cghzttbggklhuyqxzabq"
echo "2. Vá em Storage"
echo "3. Para cada bucket:"
echo "   - Clique no bucket (ex: avatars, progress-photos)"
echo "   - Selecione todos os arquivos"
echo "   - Clique em Download (se disponível)"
echo "   - Ou baixe arquivo por arquivo"
echo ""
echo "Buckets comuns do Supabase:"
echo "  - avatars (fotos de perfil)"
echo "  - progress-photos (fotos de progresso)"
echo "  - outros buckets que você criou"
echo ""
echo "💡 Alternativa: Use Supabase CLI:"
echo "   npm install -g supabase"
echo "   supabase login"
echo "   supabase storage download [bucket-name] --project-ref cghzttbggklhuyqxzabq"
echo ""
echo "📄 Backup completo requer:"
echo "  1. ✅ Export SQL do banco (via assistente)"
echo "  2. ⚠️  Download manual dos arquivos do Storage"
echo ""
