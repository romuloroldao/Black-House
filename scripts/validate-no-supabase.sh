#!/bin/bash
# ============================================================================
# DESIGN-SUPABASE-PURGE-GLOBAL-003: Validação CI
# ============================================================================
# Script de validação para garantir que não há uso de Supabase ou PostgREST
# Falha o build/CI se detectar padrões proibidos
# ============================================================================

set -e

echo "🔍 DESIGN-SUPABASE-PURGE-GLOBAL-003: Guarda de regressão — o app NÃO usa Supabase;"
echo "   este script só falha se alguém tentar reintroduzir Supabase/PostgREST."
echo ""

ERRORS=0

# 1. Verificar imports de Supabase no código fonte
echo "1. Verificando imports de Supabase..."
if grep -r "import.*supabase\|require.*supabase\|from.*supabase" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null; then
    echo "❌ ERRO: Imports de Supabase encontrados no código!"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Nenhum import de Supabase encontrado"
fi

# 2. Verificar uso de apiClient.from() (exceto a definição e guards)
echo "2. Verificando uso de apiClient.from()..."
FROM_USAGE=$(grep -r "apiClient\.from(" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "api-client.ts" | grep -v "// NÃO USE" | grep -v "data-context-guard.ts" | grep -v "supabase.ts" | wc -l)
if [ "$FROM_USAGE" -gt 0 ]; then
    echo "❌ ERRO: Uso de apiClient.from() encontrado no código!"
    grep -r "apiClient\.from(" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "api-client.ts" | grep -v "// NÃO USE" | grep -v "data-context-guard.ts" | grep -v "supabase.ts"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Nenhum uso de apiClient.from() encontrado (exceto definição e guards)"
fi

# 3. Verificar sintaxe PostgREST em código fonte
# NOTA: .eq(), .neq(), etc. são métodos encadeados que dependem de apiClient.from()
# Como apiClient.from() agora lança erro, esses códigos vão falhar em runtime (comportamento desejado)
# Mas ainda precisamos detectar se há uso direto de apiClient.from() que não foi substituído
echo "3. Verificando sintaxe PostgREST (apenas uso direto de apiClient.from())..."
# Verificar apenas se há apiClient.from() sendo usado (já verificado acima)
# Os métodos .eq(), .neq() etc. são parte de código legado que vai falhar em runtime
FROM_WITH_METHODS=$(grep -r "apiClient\.from(" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "api-client.ts" | grep -v "// NÃO USE" | grep -v "data-context-guard.ts" | grep -v "supabase.ts" | wc -l)
if [ "$FROM_WITH_METHODS" -gt 0 ]; then
    echo "❌ ERRO: Uso de apiClient.from() com métodos encadeados encontrado!"
    echo "⚠️  NOTA: Esses códigos vão falhar em runtime (comportamento desejado)"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Nenhum uso direto de apiClient.from() encontrado"
    echo "⚠️  NOTA: Código legado com .eq(), .neq() etc. vai falhar em runtime (OK)"
fi

# 4. Verificar dependência @supabase/supabase-js no package.json
echo "4. Verificando dependências do Supabase..."
# Ignorar scripts de validação e comentários
if grep -i "@supabase/supabase-js" package.json 2>/dev/null | grep -v "validate:no-supabase" | grep -v "DESIGN-SUPABASE-PURGE" | grep -v "//"; then
    echo "❌ ERRO: Dependência @supabase/supabase-js encontrada no package.json!"
    grep -i "@supabase/supabase-js" package.json | grep -v "validate:no-supabase"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Nenhuma dependência @supabase/supabase-js encontrada"
fi

# 5. Verificar uso de createClient do Supabase
echo "5. Verificando createClient do Supabase..."
if grep -r "createClient.*supabase\|supabase.*createClient" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "supabase.ts"; then
    echo "❌ ERRO: createClient do Supabase encontrado!"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Nenhum createClient do Supabase encontrado"
fi

# 6. DESIGN-SUPABASE-KILL-SWITCH-DEFENSIVE-001: Verificar se kill switch existe
echo "6. Verificando kill switch defensivo..."
if [ ! -f "src/lib/supabase.ts" ]; then
    echo "❌ ERRO: Arquivo kill switch (src/lib/supabase.ts) não encontrado!"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Kill switch defensivo encontrado"
fi

# 7. Verificar se @supabase/supabase-js está em node_modules
echo "7. Verificando node_modules..."
if [ -d "node_modules/@supabase" ]; then
    echo "❌ ERRO: @supabase encontrado em node_modules!"
    echo "Execute: npm uninstall @supabase/supabase-js"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ @supabase não encontrado em node_modules"
fi

# Resultado final
echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ DESIGN-SUPABASE-PURGE-GLOBAL-003: Validação passou!"
    echo "✅ Nenhum uso de Supabase ou PostgREST encontrado"
    exit 0
else
    echo "❌ DESIGN-SUPABASE-PURGE-GLOBAL-003: Validação FALHOU!"
    echo "❌ $ERRORS erro(s) encontrado(s)"
    echo ""
    echo "Por favor, remova todos os usos de Supabase/PostgREST antes de fazer commit."
    exit 1
fi
