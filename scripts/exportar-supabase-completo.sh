#!/bin/bash
# Script completo para exportar dados do Supabase
# Usa credenciais fornecidas e tenta diferentes métodos

set -e

PROJECT_REF="cghzttbggklhuyqxzabq"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
BACKUP_DIR="${BACKUP_DIR:-./backup}"

mkdir -p $BACKUP_DIR

echo "=== Exportação Completa do Supabase ==="
echo "Project Ref: $PROJECT_REF"
echo "Backup Dir: $BACKUP_DIR"
echo ""

# Método 1: pg_dump (Recomendado - requer senha do PostgreSQL)
if [ ! -z "$SUPABASE_PASSWORD" ]; then
    echo "📤 Método 1: Exportando via pg_dump (método recomendado)..."
    echo ""
    
    # Exportar schema
    echo "1. Exportando schema (estrutura)..."
    pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres" \
      --schema-only \
      --no-owner \
      --no-privileges \
      --exclude-schema=auth \
      --exclude-schema=storage \
      --exclude-schema=supabase_functions \
      --exclude-schema=realtime \
      --exclude-schema=vault \
      > ${BACKUP_DIR}/schema_public.sql 2>&1
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Schema exportado: ${BACKUP_DIR}/schema_public.sql"
    else
        echo "   ❌ Erro ao exportar schema"
    fi
    
    # Exportar dados
    echo ""
    echo "2. Exportando dados..."
    pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres" \
      --data-only \
      --no-owner \
      --no-privileges \
      --exclude-schema=auth \
      --exclude-schema=storage \
      > ${BACKUP_DIR}/data.sql 2>&1
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Dados exportados: ${BACKUP_DIR}/data.sql"
        echo ""
        echo "=== Exportação Completa Concluída! ==="
        exit 0
    else
        echo "   ❌ Erro ao exportar dados"
    fi
else
    echo "⚠️  Senha do PostgreSQL não fornecida."
    echo ""
    echo "📋 Para exportação completa, você precisa da SENHA DO POSTGRESQL (não a Service Role Key)."
    echo ""
    echo "Como obter a senha:"
    echo "  1. Acesse: https://supabase.com/dashboard"
    echo "  2. Selecione projeto: $PROJECT_REF"
    echo "  3. Vá em: Settings → Database"
    echo "  4. Procure por 'Connection string' ou 'Connection pooling'"
    echo "  5. A senha está na string de conexão PostgreSQL"
    echo "     Exemplo: postgresql://postgres:[SENHA_AQUI]@db.${PROJECT_REF}.supabase.co:5432/postgres"
    echo ""
    echo "   OU"
    echo ""
    echo "  6. Vá em: Settings → Database → Connection string"
    echo "  7. Clique em 'Reset database password' se necessário"
    echo ""
    echo "Uso:"
    echo "  export SUPABASE_PASSWORD='sua_senha_postgresql'"
    echo "  ./scripts/exportar-supabase-completo.sh"
    echo ""
    
    # Método 2: Tentar usar Supabase CLI se disponível
    if command -v supabase &> /dev/null || command -v npx &> /dev/null; then
        echo "🔄 Tentando método alternativo com Supabase CLI..."
        echo ""
        
        if command -v npx &> /dev/null; then
            echo "Usando npx supabase..."
            npx supabase db dump --project-ref $PROJECT_REF > ${BACKUP_DIR}/schema_supabase_cli.sql 2>&1 || {
                echo "   ⚠️  Supabase CLI requer autenticação"
                echo "   Execute: npx supabase login"
            }
        fi
    fi
    
    echo ""
    echo "📝 Criando arquivo de referência com informações do projeto..."
    cat > ${BACKUP_DIR}/supabase_info.txt << EOF
Informações do Projeto Supabase
================================

PROJECT_REF: $PROJECT_REF
SUPABASE_URL: $SUPABASE_URL
SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnaHp0dGJnZ2tsaHV5cXh6YWJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1OTU4MjksImV4cCI6MjA3MDE3MTgyOX0.h64J00FCvjOX86vhpdI3sTXXVRkoWfpYLS6jQWkuUx8

Para exportação completa:
1. Obtenha a senha do PostgreSQL em Settings → Database
2. Execute: export SUPABASE_PASSWORD='senha'
3. Execute: ./scripts/exportar-supabase-completo.sh

Connection String Template:
postgresql://postgres:[SENHA]@db.${PROJECT_REF}.supabase.co:5432/postgres
EOF
    
    echo "   ✅ Arquivo de referência criado: ${BACKUP_DIR}/supabase_info.txt"
    echo ""
    echo "⚠️  Exportação completa requer senha do PostgreSQL."
    echo "   Siga as instruções acima para obter a senha."
    exit 1
fi
