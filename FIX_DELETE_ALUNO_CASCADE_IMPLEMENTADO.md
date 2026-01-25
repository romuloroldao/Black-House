# ✅ Fix Delete Aluno com Cascade - IMPLEMENTADO

**Data**: 15 de Janeiro de 2026  
**Status**: ✅ **CORRIGIDO**

---

## 🎯 Problema

**Erro ao deletar aluno**:
```
Error: update or delete on table "alunos" violates foreign key constraint "dietas_aluno_id_fkey" on table "dietas"
```

O erro ocorria ao tentar deletar um aluno que tinha dietas associadas. A foreign key `dietas_aluno_id_fkey` estava impedindo a deleção.

---

## 🔍 Causa Raiz

**Arquivo**: `/root/server/index.js` (linha 639)

**Problema**:
```javascript
// Delete genérico sem tratamento de dependências
app.delete('/rest/v1/:table', authenticate, async (req, res) => {
    // ...
    await pool.query(`DELETE FROM public.${table} WHERE id = $1`, [id]);
    // ❌ Falha se houver dietas associadas ao aluno
});
```

A foreign key `dietas_aluno_id_fkey` não tinha `ON DELETE CASCADE`, então ao tentar deletar um aluno com dietas, o PostgreSQL bloqueava a operação.

---

## ✅ Correção Implementada

### 1. Endpoint DELETE Melhorado

**Arquivo**: `/root/server/index.js` (linhas 634-700)

**Mudanças**:
- ✅ Tratamento especial para tabela `alunos`
- ✅ Deleta dietas e `itens_dieta` em cascata antes de deletar o aluno
- ✅ Usa transação para garantir atomicidade
- ✅ Erros de foreign key tratados de forma amigável
- ✅ Logs detalhados para debugging

**Código**:
```javascript
app.delete('/rest/v1/:table', authenticate, async (req, res) => {
    const { table } = req.params;
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({ error: 'ID é obrigatório para deletar' });
    }
    
    try {
        // Para tabela 'alunos', verificar dependências e deletar em cascata
        if (table === 'alunos') {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                // Verificar se há dietas associadas
                const dietasCount = await client.query(
                    'SELECT COUNT(*) as count FROM dietas WHERE aluno_id = $1',
                    [id]
                );
                
                if (dietasCount.rows[0].count > 0) {
                    // Deletar dietas e itens_dieta em cascata
                    await client.query('DELETE FROM itens_dieta WHERE dieta_id IN (SELECT id FROM dietas WHERE aluno_id = $1)', [id]);
                    await client.query('DELETE FROM dietas WHERE aluno_id = $1', [id]);
                    logger.info('Dietas deletadas em cascata para aluno', { alunoId: id });
                }
                
                // Deletar o aluno
                await client.query('DELETE FROM public.alunos WHERE id = $1', [id]);
                
                await client.query('COMMIT');
                res.json({ message: 'Deletado com sucesso' });
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } else {
            // Para outras tabelas, deletar diretamente
            await pool.query(`DELETE FROM public.${table} WHERE id = $1`, [id]);
            res.json({ message: 'Deletado com sucesso' });
        }
    } catch (error) {
        // Tratar erros de foreign key de forma amigável
        if (error.code === '23503') { // Foreign key violation
            res.status(400).json({ 
                error: `Não é possível deletar porque existem registros relacionados.`,
                detail: error.detail || error.message
            });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});
```

### 2. Constraint CASCADE no Banco

**Migrações existentes**:
- `/root/supabase/migrations/20251016131551_8501ad75-3b86-40f2-89f7-f5b8ab128c6f.sql`: Define `ON DELETE CASCADE`
- `/root/supabase/migrations/20251016175333_057fa953-6e2e-4f2b-a044-192efd7ba7ef.sql`: Garante CASCADE para todas as dependências

**Status**: ✅ Constraint CASCADE já está nas migrações

---

## ✅ Validações

### 1. Código
- ✅ Endpoint DELETE atualizado com tratamento de dependências
- ✅ Transação atômica para garantir consistência
- ✅ Logs detalhados para debugging
- ✅ Erros tratados de forma amigável

### 2. Banco de Dados
- ✅ Constraint CASCADE já existe nas migrações
- ✅ Verificação pode ser aplicada se necessário

### 3. Servidor
- ✅ Servidor reiniciado e funcionando
- ✅ Código sem erros de sintaxe

---

## 📋 Fluxo de Deleção

### Antes (Problemático)

```
1. DELETE FROM alunos WHERE id = 'xxx'
2. ❌ PostgreSQL bloqueia: violação de foreign key
3. Erro 500 retornado ao frontend
```

### Depois (Correto)

```
1. DELETE /rest/v1/alunos?id=xxx
2. BEGIN TRANSACTION
3. Verificar se há dietas associadas
4. Se sim:
   a. DELETE FROM itens_dieta WHERE dieta_id IN (...)
   b. DELETE FROM dietas WHERE aluno_id = 'xxx'
5. DELETE FROM alunos WHERE id = 'xxx'
6. COMMIT
7. ✅ Sucesso (dietas deletadas em cascata)
```

---

## 📋 Checklist

- [x] Endpoint DELETE atualizado com tratamento de dependências
- [x] Transação atômica implementada
- [x] Logs detalhados adicionados
- [x] Erros de foreign key tratados de forma amigável
- [x] Validação de ID obrigatório
- [x] Servidor reiniciado
- [x] Código validado

---

## 🎉 Resultado

**Deleção de aluno corrigida!**

- ✅ Alunos com dietas podem ser deletados
- ✅ Dietas e itens_dieta são deletados em cascata
- ✅ Transação atômica garante consistência
- ✅ Erros tratados de forma amigável
- ✅ Logs detalhados para debugging

---

**Última atualização**: 15 de Janeiro de 2026 - 18:20
