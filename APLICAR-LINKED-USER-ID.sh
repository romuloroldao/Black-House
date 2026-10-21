#!/bin/bash
# Script para aplicar migração linked_user_id
# Executa como postgres/superuser

echo "🔄 Aplicando migração linked_user_id..."
echo ""

# Tentar encontrar usuário postgres
if command -v psql &> /dev/null; then
    echo "📋 Tentando aplicar migração como postgres..."
    
    # Método 1: Via psql direto (requer senha)
    if [ -f "/root/APLICAR-LINKED-USER-ID.sql" ]; then
        echo "📄 Arquivo SQL encontrado: /root/APLICAR-LINKED-USER-ID.sql"
        echo ""
        echo "💡 Execute manualmente:"
        echo "   psql -h localhost -p 5432 -U postgres -d blackhouse_db -f /root/APLICAR-LINKED-USER-ID.sql"
        echo ""
        echo "Ou conecte e execute:"
        echo "   psql -h localhost -p 5432 -U postgres -d blackhouse_db"
        echo "   \\i /root/APLICAR-LINKED-USER-ID.sql"
    else
        echo "❌ Arquivo SQL não encontrado: /root/APLICAR-LINKED-USER-ID.sql"
    fi
else
    echo "⚠️  psql não encontrado no PATH"
fi

echo ""
echo "📋 ARQUIVO SQL PRONTO PARA APLICAÇÃO:"
echo "   /root/APLICAR-LINKED-USER-ID.sql"
echo ""
echo "📋 INSTRUÇÕES:"
echo "   1. Execute como superuser/owner da tabela alunos"
echo "   2. Via Supabase Dashboard: SQL Editor → copiar conteúdo do arquivo"
echo "   3. Via psql: psql -h localhost -p 5432 -U postgres -d blackhouse_db -f /root/APLICAR-LINKED-USER-ID.sql"
