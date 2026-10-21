-- ============================================================================
-- EXEMPLOS DE QUERIES ÚTEIS
-- ============================================================================
-- Queries comuns para o sistema de gestão de coaches
-- ============================================================================

-- ============================================================================
-- QUERIES PARA COACHES
-- ============================================================================

-- 1. Listar todos os alunos de um coach
SELECT 
    a.id,
    a.nome,
    a.email,
    a.telefone,
    a.peso,
    a.objetivo,
    a.plano,
    COUNT(DISTINCT at.treino_id) as total_treinos,
    COUNT(DISTINCT d.id) as total_dietas,
    MAX(wc.data_checkin) as ultimo_checkin
FROM alunos a
LEFT JOIN alunos_treinos at ON a.id = at.aluno_id AND at.ativo = true
LEFT JOIN dietas d ON a.id = d.aluno_id
LEFT JOIN weekly_checkins wc ON a.id = wc.aluno_id
WHERE a.coach_id = auth.uid()
GROUP BY a.id, a.nome, a.email, a.telefone, a.peso, a.objetivo, a.plano
ORDER BY a.nome;

-- 2. Alunos com check-ins pendentes (último check-in há mais de 7 dias)
SELECT 
    a.id,
    a.nome,
    a.email,
    MAX(wc.data_checkin) as ultimo_checkin,
    CURRENT_DATE - MAX(wc.data_checkin) as dias_sem_checkin
FROM alunos a
LEFT JOIN weekly_checkins wc ON a.id = wc.aluno_id
WHERE a.coach_id = auth.uid()
GROUP BY a.id, a.nome, a.email
HAVING MAX(wc.data_checkin) IS NULL 
    OR CURRENT_DATE - MAX(wc.data_checkin) > 7
ORDER BY dias_sem_checkin DESC NULLS FIRST;

-- 3. Treinos que estão próximos de expirar
SELECT 
    a.nome as aluno_nome,
    t.nome as treino_nome,
    at.data_expiracao,
    at.data_expiracao - CURRENT_DATE as dias_restantes
FROM alunos_treinos at
JOIN alunos a ON at.aluno_id = a.id
JOIN treinos t ON at.treino_id = t.id
WHERE a.coach_id = auth.uid()
    AND at.ativo = true
    AND at.data_expiracao IS NOT NULL
    AND at.data_expiracao - CURRENT_DATE BETWEEN 0 AND 7
ORDER BY at.data_expiracao;

-- 4. Resumo financeiro do coach
SELECT 
    COUNT(DISTINCT ap.id) as total_pagamentos,
    COUNT(DISTINCT CASE WHEN ap.status = 'RECEIVED' THEN ap.id END) as pagamentos_recebidos,
    COUNT(DISTINCT CASE WHEN ap.status = 'PENDING' THEN ap.id END) as pagamentos_pendentes,
    COUNT(DISTINCT CASE WHEN ap.status = 'OVERDUE' THEN ap.id END) as pagamentos_atrasados,
    SUM(CASE WHEN ap.status = 'RECEIVED' THEN ap.value ELSE 0 END) as total_recebido,
    SUM(CASE WHEN ap.status = 'PENDING' THEN ap.value ELSE 0 END) as total_pendente,
    SUM(CASE WHEN ap.status = 'OVERDUE' THEN ap.value ELSE 0 END) as total_atrasado
FROM asaas_payments ap
WHERE ap.coach_id = auth.uid();

-- 5. Alunos com pagamentos pendentes ou atrasados
SELECT 
    a.id,
    a.nome,
    a.email,
    ap.value as valor,
    ap.due_date as vencimento,
    ap.status,
    ap.due_date - CURRENT_DATE as dias_vencido
FROM alunos a
JOIN asaas_payments ap ON a.id = ap.aluno_id
WHERE a.coach_id = auth.uid()
    AND ap.status IN ('PENDING', 'OVERDUE')
ORDER BY ap.due_date;

-- 6. Eventos agendados para os próximos 7 dias
SELECT 
    e.id,
    e.titulo,
    e.data_inicio,
    e.hora_inicio,
    e.status,
    COUNT(DISTINCT ep.aluno_id) as total_participantes,
    t.nome as turma_nome
FROM eventos e
LEFT JOIN eventos_participantes ep ON e.id = ep.evento_id
LEFT JOIN turmas t ON e.turma_id = t.id
WHERE e.coach_id = auth.uid()
    AND e.data_inicio::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
GROUP BY e.id, e.titulo, e.data_inicio, e.hora_inicio, e.status, t.nome
ORDER BY e.data_inicio, e.hora_inicio;

-- 7. Mensagens não lidas para o coach
SELECT 
    c.id as conversa_id,
    a.nome as aluno_nome,
    m.conteudo as ultima_mensagem,
    m.created_at as data_mensagem,
    COUNT(CASE WHEN m.lida = false AND m.remetente_id != auth.uid() THEN 1 END) as mensagens_nao_lidas
FROM conversas c
JOIN alunos a ON c.aluno_id = a.id
LEFT JOIN mensagens m ON c.id = m.conversa_id
WHERE c.coach_id = auth.uid()
GROUP BY c.id, a.nome, m.conteudo, m.created_at
HAVING COUNT(CASE WHEN m.lida = false AND m.remetente_id != auth.uid() THEN 1 END) > 0
ORDER BY m.created_at DESC;

-- 8. Estatísticas de adesão dos alunos (últimos 30 dias)
SELECT 
    a.id,
    a.nome,
    AVG(wc.adesao_dieta) as media_adesao_dieta,
    AVG(wc.adesao_treino) as media_adesao_treino,
    AVG(wc.nivel_energia) as media_energia,
    COUNT(wc.id) as total_checkins
FROM alunos a
JOIN weekly_checkins wc ON a.id = wc.aluno_id
WHERE a.coach_id = auth.uid()
    AND wc.data_checkin >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY a.id, a.nome
ORDER BY media_adesao_dieta DESC, media_adesao_treino DESC;

-- ============================================================================
-- QUERIES PARA ALUNOS
-- ============================================================================

-- 9. Aluno: Ver seus próprios dados
SELECT 
    id,
    nome,
    email,
    telefone,
    peso,
    objetivo,
    plano
FROM alunos
WHERE email = (auth.jwt() ->> 'email');

-- 10. Aluno: Ver seus treinos ativos
SELECT 
    t.id,
    t.nome,
    t.descricao,
    t.exercicios,
    t.dias_semana,
    at.data_inicio,
    at.data_expiracao,
    at.ativo
FROM alunos_treinos at
JOIN treinos t ON at.treino_id = t.id
JOIN alunos a ON at.aluno_id = a.id
WHERE a.email = (auth.jwt() ->> 'email')
    AND at.ativo = true
ORDER BY at.data_inicio DESC;

-- 11. Aluno: Ver suas dietas
SELECT 
    d.id,
    d.nome,
    d.objetivo,
    d.data_criacao,
    COUNT(DISTINCT id_item.id) as total_itens
FROM dietas d
JOIN alunos a ON d.aluno_id = a.id
LEFT JOIN itens_dieta id_item ON d.id = id_item.dieta_id
WHERE a.email = (auth.jwt() ->> 'email')
GROUP BY d.id, d.nome, d.objetivo, d.data_criacao
ORDER BY d.data_criacao DESC;

-- 12. Aluno: Ver itens de uma dieta específica
SELECT 
    id_item.id,
    id_item.refeicao,
    id_item.quantidade,
    id_item.dia_semana,
    al.nome as alimento_nome,
    al.kcal_por_referencia,
    al.ptn_por_referencia,
    al.cho_por_referencia,
    al.lip_por_referencia
FROM itens_dieta id_item
JOIN dietas d ON id_item.dieta_id = d.id
JOIN alunos a ON d.aluno_id = a.id
LEFT JOIN alimentos al ON id_item.alimento_id = al.id
WHERE d.id = :dieta_id
    AND a.email = (auth.jwt() ->> 'email')
ORDER BY id_item.refeicao, id_item.dia_semana;

-- 13. Aluno: Ver seus check-ins
SELECT 
    id,
    peso,
    nivel_energia,
    qualidade_sono,
    nivel_estresse,
    adesao_dieta,
    adesao_treino,
    observacoes,
    data_checkin,
    created_at
FROM weekly_checkins
WHERE aluno_id = (
    SELECT id FROM alunos 
    WHERE email = (auth.jwt() ->> 'email')
)
ORDER BY data_checkin DESC;

-- 14. Aluno: Ver seus pagamentos
SELECT 
    id,
    value as valor,
    due_date as vencimento,
    billing_type as tipo_pagamento,
    status,
    invoice_url,
    bank_slip_url,
    pix_qr_code,
    pix_copy_paste,
    created_at
FROM asaas_payments
WHERE aluno_id = (
    SELECT id FROM alunos 
    WHERE email = (auth.jwt() ->> 'email')
)
ORDER BY due_date DESC;

-- 15. Aluno: Ver avisos não lidos
SELECT 
    av.id,
    av.titulo,
    av.mensagem,
    av.tipo,
    av.anexo_url,
    av.created_at,
    ad.lido,
    ad.lido_em
FROM avisos av
JOIN avisos_destinatarios ad ON av.id = ad.aviso_id
JOIN alunos a ON ad.aluno_id = a.id
WHERE a.email = (auth.jwt() ->> 'email')
    AND ad.lido = false
ORDER BY av.created_at DESC;

-- 16. Aluno: Ver eventos/lives disponíveis
SELECT 
    e.id,
    e.titulo,
    e.descricao,
    e.data_inicio,
    e.hora_inicio,
    e.duracao_minutos,
    e.status,
    e.link_online,
    ep.confirmado
FROM eventos e
LEFT JOIN eventos_participantes ep ON e.id = ep.evento_id 
    AND ep.aluno_id = (
        SELECT id FROM alunos 
        WHERE email = (auth.jwt() ->> 'email')
    )
WHERE e.status = 'agendado'
    AND e.data_inicio >= NOW()
ORDER BY e.data_inicio;

-- ============================================================================
-- QUERIES DE RELATÓRIOS E ESTATÍSTICAS
-- ============================================================================

-- 17. Evolução de peso de um aluno
SELECT 
    data_checkin,
    peso,
    peso - LAG(peso) OVER (ORDER BY data_checkin) as variacao_peso,
    peso - FIRST_VALUE(peso) OVER (ORDER BY data_checkin ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as variacao_total
FROM weekly_checkins
WHERE aluno_id = :aluno_id
ORDER BY data_checkin;

-- 18. Taxa de adesão média por turma
SELECT 
    t.id,
    t.nome as turma_nome,
    COUNT(DISTINCT a.id) as total_alunos,
    AVG(wc.adesao_dieta) as media_adesao_dieta,
    AVG(wc.adesao_treino) as media_adesao_treino,
    COUNT(DISTINCT wc.id) as total_checkins
FROM turmas t
JOIN turmas_alunos ta ON t.id = ta.turma_id
JOIN alunos a ON ta.aluno_id = a.id
LEFT JOIN weekly_checkins wc ON a.id = wc.aluno_id
    AND wc.data_checkin >= CURRENT_DATE - INTERVAL '30 days'
WHERE t.coach_id = auth.uid()
GROUP BY t.id, t.nome
ORDER BY media_adesao_dieta DESC;

-- 19. Receita mensal do coach
SELECT 
    DATE_TRUNC('month', ap.created_at) as mes,
    COUNT(DISTINCT ap.id) as total_pagamentos,
    SUM(CASE WHEN ap.status = 'RECEIVED' THEN ap.value ELSE 0 END) as receita_total,
    SUM(CASE WHEN ap.status = 'PENDING' THEN ap.value ELSE 0 END) as receita_pendente
FROM asaas_payments ap
WHERE ap.coach_id = auth.uid()
    AND ap.created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', ap.created_at)
ORDER BY mes DESC;

-- 20. Top 5 exercícios mais prescritos
SELECT 
    exercicio->>'nome' as exercicio_nome,
    COUNT(*) as vezes_prescrito
FROM treinos t
CROSS JOIN LATERAL jsonb_array_elements(t.exercicios) as exercicio
WHERE t.coach_id = auth.uid()
GROUP BY exercicio->>'nome'
ORDER BY vezes_prescrito DESC
LIMIT 5;

-- ============================================================================
-- QUERIES DE MANUTENÇÃO E VALIDAÇÃO
-- ============================================================================

-- 21. Verificar integridade: alunos sem coach_id
SELECT 
    id,
    nome,
    email,
    created_at
FROM alunos
WHERE coach_id IS NULL;

-- 22. Verificar integridade: treinos órfãos (sem alunos atribuídos)
SELECT 
    t.id,
    t.nome,
    t.created_at
FROM treinos t
LEFT JOIN alunos_treinos at ON t.id = at.treino_id
WHERE t.coach_id = auth.uid()
    AND at.id IS NULL;

-- 23. Verificar integridade: dietas sem itens
SELECT 
    d.id,
    d.nome,
    d.aluno_id,
    a.nome as aluno_nome
FROM dietas d
JOIN alunos a ON d.aluno_id = a.id
LEFT JOIN itens_dieta id_item ON d.id = id_item.dieta_id
WHERE a.coach_id = auth.uid()
    AND id_item.id IS NULL;

-- 24. Limpar check-ins antigos (manter apenas últimos 6 meses)
-- DELETE FROM weekly_checkins 
-- WHERE data_checkin < CURRENT_DATE - INTERVAL '6 months';

-- 25. Atualizar status de pagamentos vencidos
-- UPDATE asaas_payments
-- SET status = 'OVERDUE'
-- WHERE status = 'PENDING'
--     AND due_date < CURRENT_DATE
--     AND coach_id = auth.uid();

-- ============================================================================
-- FIM DOS EXEMPLOS DE QUERIES
-- ============================================================================
