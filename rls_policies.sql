-- ============================================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ============================================================================
-- Políticas de segurança para garantir isolamento de dados por coach
-- ============================================================================

-- ============================================================================
-- HABILITAR RLS EM TODAS AS TABELAS
-- ============================================================================

ALTER TABLE agenda_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE alimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE alunos_treinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE asaas_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE asaas_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE asaas_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE avisos_destinatarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE dietas ENABLE ROW LEVEL SECURITY;
ALTER TABLE dieta_farmacos ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_dieta ENABLE ROW LEVEL SECURITY;
ALTER TABLE lembretes_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lives ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_charges_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE relatorio_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE relatorio_midias ENABLE ROW LEVEL SECURITY;
ALTER TABLE treinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE turmas_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_checkins ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLÍTICAS PARA COACHES
-- ============================================================================

-- Função auxiliar para verificar se é coach
CREATE OR REPLACE FUNCTION is_coach()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'coach'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função auxiliar para verificar se é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função auxiliar para verificar se é aluno
CREATE OR REPLACE FUNCTION is_student()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'student'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter coach_id do aluno via email
CREATE OR REPLACE FUNCTION get_coach_id_from_aluno(aluno_uuid UUID)
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT coach_id FROM alunos WHERE id = aluno_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- POLÍTICAS: ALUNOS
-- ============================================================================

-- Coaches podem ver apenas seus alunos
CREATE POLICY "coaches_select_alunos"
ON alunos FOR SELECT
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

-- Coaches podem inserir seus alunos
CREATE POLICY "coaches_insert_alunos"
ON alunos FOR INSERT
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

-- Coaches podem atualizar seus alunos
CREATE POLICY "coaches_update_alunos"
ON alunos FOR UPDATE
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
)
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

-- Coaches podem deletar seus alunos
CREATE POLICY "coaches_delete_alunos"
ON alunos FOR DELETE
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

-- Alunos podem ver apenas seus próprios dados
CREATE POLICY "alunos_select_self"
ON alunos FOR SELECT
USING (
    is_student() AND email = (auth.jwt() ->> 'email')
);

-- ============================================================================
-- POLÍTICAS: TREINOS
-- ============================================================================

CREATE POLICY "coaches_manage_treinos"
ON treinos FOR ALL
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
)
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

-- Alunos podem ver treinos atribuídos a eles
CREATE POLICY "alunos_select_treinos"
ON treinos FOR SELECT
USING (
    is_student() AND EXISTS (
        SELECT 1 FROM alunos_treinos at
        JOIN alunos a ON at.aluno_id = a.id
        WHERE at.treino_id = treinos.id
        AND a.email = (auth.jwt() ->> 'email')
    )
);

-- ============================================================================
-- POLÍTICAS: ALUNOS_TREINOS
-- ============================================================================

CREATE POLICY "coaches_manage_alunos_treinos"
ON alunos_treinos FOR ALL
USING (
    is_coach() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = alunos_treinos.aluno_id 
        AND coach_id = auth.uid()
    )
    OR is_admin()
)
WITH CHECK (
    is_coach() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = alunos_treinos.aluno_id 
        AND coach_id = auth.uid()
    )
    OR is_admin()
);

-- Alunos podem ver seus próprios treinos atribuídos
CREATE POLICY "alunos_select_alunos_treinos"
ON alunos_treinos FOR SELECT
USING (
    is_student() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = alunos_treinos.aluno_id 
        AND email = (auth.jwt() ->> 'email')
    )
);

-- ============================================================================
-- POLÍTICAS: DIETAS
-- ============================================================================

CREATE POLICY "coaches_manage_dietas"
ON dietas FOR ALL
USING (
    is_coach() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = dietas.aluno_id 
        AND coach_id = auth.uid()
    )
    OR is_admin()
)
WITH CHECK (
    is_coach() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = dietas.aluno_id 
        AND coach_id = auth.uid()
    )
    OR is_admin()
);

-- Alunos podem ver suas próprias dietas
CREATE POLICY "alunos_select_dietas"
ON dietas FOR SELECT
USING (
    is_student() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = dietas.aluno_id 
        AND email = (auth.jwt() ->> 'email')
    )
);

-- ============================================================================
-- POLÍTICAS: ITENS_DIETA
-- ============================================================================

CREATE POLICY "coaches_manage_itens_dieta"
ON itens_dieta FOR ALL
USING (
    is_coach() AND EXISTS (
        SELECT 1 FROM dietas d
        JOIN alunos a ON d.aluno_id = a.id
        WHERE d.id = itens_dieta.dieta_id 
        AND a.coach_id = auth.uid()
    )
    OR is_admin()
)
WITH CHECK (
    is_coach() AND EXISTS (
        SELECT 1 FROM dietas d
        JOIN alunos a ON d.aluno_id = a.id
        WHERE d.id = itens_dieta.dieta_id 
        AND a.coach_id = auth.uid()
    )
    OR is_admin()
);

-- Alunos podem ver itens de suas dietas
CREATE POLICY "alunos_select_itens_dieta"
ON itens_dieta FOR SELECT
USING (
    is_student() AND EXISTS (
        SELECT 1 FROM dietas d
        JOIN alunos a ON d.aluno_id = a.id
        WHERE d.id = itens_dieta.dieta_id 
        AND a.email = (auth.jwt() ->> 'email')
    )
);

-- ============================================================================
-- POLÍTICAS: CONVERSAS E MENSAGENS
-- ============================================================================

CREATE POLICY "coaches_manage_conversas"
ON conversas FOR ALL
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
)
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

CREATE POLICY "alunos_select_conversas"
ON conversas FOR SELECT
USING (
    is_student() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = conversas.aluno_id 
        AND email = (auth.jwt() ->> 'email')
    )
);

CREATE POLICY "users_select_mensagens"
ON mensagens FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM conversas c
        WHERE c.id = mensagens.conversa_id
        AND (
            (is_coach() AND c.coach_id = auth.uid())
            OR (is_student() AND EXISTS (
                SELECT 1 FROM alunos a 
                WHERE a.id = c.aluno_id 
                AND a.email = (auth.jwt() ->> 'email')
            ))
            OR is_admin()
        )
    )
);

CREATE POLICY "users_insert_mensagens"
ON mensagens FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM conversas c
        WHERE c.id = mensagens.conversa_id
        AND (
            (is_coach() AND c.coach_id = auth.uid())
            OR (is_student() AND EXISTS (
                SELECT 1 FROM alunos a 
                WHERE a.id = c.aluno_id 
                AND a.email = (auth.jwt() ->> 'email')
            ))
        )
    )
);

-- ============================================================================
-- POLÍTICAS: WEEKLY_CHECKINS
-- ============================================================================

CREATE POLICY "coaches_manage_checkins"
ON weekly_checkins FOR ALL
USING (
    is_coach() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = weekly_checkins.aluno_id 
        AND coach_id = auth.uid()
    )
    OR is_admin()
)
WITH CHECK (
    is_coach() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = weekly_checkins.aluno_id 
        AND coach_id = auth.uid()
    )
    OR is_admin()
);

CREATE POLICY "alunos_select_checkins"
ON weekly_checkins FOR SELECT
USING (
    is_student() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = weekly_checkins.aluno_id 
        AND email = (auth.jwt() ->> 'email')
    )
);

CREATE POLICY "alunos_insert_checkins"
ON weekly_checkins FOR INSERT
WITH CHECK (
    is_student() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = weekly_checkins.aluno_id 
        AND email = (auth.jwt() ->> 'email')
    )
);

-- ============================================================================
-- POLÍTICAS: AVISOS
-- ============================================================================

CREATE POLICY "coaches_manage_avisos"
ON avisos FOR ALL
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
)
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

CREATE POLICY "alunos_select_avisos"
ON avisos FOR SELECT
USING (
    is_student() AND EXISTS (
        SELECT 1 FROM avisos_destinatarios ad
        JOIN alunos a ON ad.aluno_id = a.id
        WHERE ad.aviso_id = avisos.id
        AND a.email = (auth.jwt() ->> 'email')
    )
    OR EXISTS (
        SELECT 1 FROM avisos_destinatarios ad
        JOIN turmas_alunos ta ON ad.turma_id = ta.turma_id
        JOIN alunos a ON ta.aluno_id = a.id
        WHERE ad.aviso_id = avisos.id
        AND a.email = (auth.jwt() ->> 'email')
    )
);

-- ============================================================================
-- POLÍTICAS: NOTIFICAÇÕES
-- ============================================================================

CREATE POLICY "coaches_manage_notificacoes"
ON notificacoes FOR ALL
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
)
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

CREATE POLICY "alunos_select_notificacoes"
ON notificacoes FOR SELECT
USING (
    is_student() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = notificacoes.aluno_id 
        AND email = (auth.jwt() ->> 'email')
    )
);

-- ============================================================================
-- POLÍTICAS: PAGAMENTOS (ASAAS)
-- ============================================================================

CREATE POLICY "coaches_manage_asaas_payments"
ON asaas_payments FOR ALL
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
)
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

CREATE POLICY "alunos_select_asaas_payments"
ON asaas_payments FOR SELECT
USING (
    is_student() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = asaas_payments.aluno_id 
        AND email = (auth.jwt() ->> 'email')
    )
);

-- ============================================================================
-- POLÍTICAS: TURMAS
-- ============================================================================

CREATE POLICY "coaches_manage_turmas"
ON turmas FOR ALL
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
)
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

CREATE POLICY "alunos_select_turmas"
ON turmas FOR SELECT
USING (
    is_student() AND EXISTS (
        SELECT 1 FROM turmas_alunos ta
        JOIN alunos a ON ta.aluno_id = a.id
        WHERE ta.turma_id = turmas.id
        AND a.email = (auth.jwt() ->> 'email')
    )
);

-- ============================================================================
-- POLÍTICAS: EVENTOS E LIVES
-- ============================================================================

CREATE POLICY "coaches_manage_eventos"
ON eventos FOR ALL
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
)
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

CREATE POLICY "alunos_select_eventos"
ON eventos FOR SELECT
USING (
    is_student() AND (
        EXISTS (
            SELECT 1 FROM eventos_participantes ep
            JOIN alunos a ON ep.aluno_id = a.id
            WHERE ep.evento_id = eventos.id
            AND a.email = (auth.jwt() ->> 'email')
        )
        OR EXISTS (
            SELECT 1 FROM eventos e
            JOIN turmas_alunos ta ON e.turma_id = ta.turma_id
            JOIN alunos a ON ta.aluno_id = a.id
            WHERE e.id = eventos.id
            AND a.email = (auth.jwt() ->> 'email')
        )
    )
);

CREATE POLICY "coaches_manage_lives"
ON lives FOR ALL
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
)
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

-- ============================================================================
-- POLÍTICAS: VÍDEOS
-- ============================================================================

CREATE POLICY "coaches_manage_videos"
ON videos FOR ALL
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
)
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

-- Alunos podem ver vídeos públicos ou de suas turmas
CREATE POLICY "alunos_select_videos"
ON videos FOR SELECT
USING (
    is_student() AND (
        visibilidade = 'publico'
        OR (visibilidade = 'turma' AND EXISTS (
            SELECT 1 FROM turmas_alunos ta
            JOIN alunos a ON ta.aluno_id = a.id
            JOIN turmas t ON ta.turma_id = t.id
            WHERE a.email = (auth.jwt() ->> 'email')
            -- Assumindo que há uma relação entre videos e turmas
            -- Ajuste conforme sua estrutura real
        ))
    )
);

-- ============================================================================
-- POLÍTICAS: PROFILES
-- ============================================================================

CREATE POLICY "users_select_own_profile"
ON profiles FOR SELECT
USING (id = auth.uid());

CREATE POLICY "users_update_own_profile"
ON profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "users_insert_own_profile"
ON profiles FOR INSERT
WITH CHECK (id = auth.uid());

-- ============================================================================
-- POLÍTICAS: COACH_PROFILES
-- ============================================================================

CREATE POLICY "coaches_manage_own_profile"
ON coach_profiles FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "public_select_coach_profiles"
ON coach_profiles FOR SELECT
USING (true); -- Perfis de coach podem ser públicos

-- ============================================================================
-- POLÍTICAS: USER_ROLES
-- ============================================================================

CREATE POLICY "users_select_own_role"
ON user_roles FOR SELECT
USING (user_id = auth.uid() OR is_admin());

-- Apenas admins podem gerenciar roles
CREATE POLICY "admins_manage_roles"
ON user_roles FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- ============================================================================
-- POLÍTICAS: ALIMENTOS (geralmente compartilhados entre coaches)
-- ============================================================================

-- Alimentos podem ser compartilhados ou privados por coach
-- Ajuste conforme sua necessidade de negócio
CREATE POLICY "coaches_select_alimentos"
ON alimentos FOR SELECT
USING (
    is_coach() 
    OR is_student() 
    OR is_admin()
);

CREATE POLICY "coaches_manage_alimentos"
ON alimentos FOR ALL
USING (
    is_coach() 
    OR is_admin()
)
WITH CHECK (
    is_coach() 
    OR is_admin()
);

-- ============================================================================
-- POLÍTICAS: EXPENSES (apenas coaches)
-- ============================================================================

CREATE POLICY "coaches_manage_expenses"
ON expenses FOR ALL
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
)
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

-- ============================================================================
-- POLÍTICAS: FEEDBACKS
-- ============================================================================

CREATE POLICY "coaches_manage_feedbacks"
ON feedbacks_alunos FOR ALL
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
)
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

CREATE POLICY "alunos_select_feedbacks"
ON feedbacks_alunos FOR SELECT
USING (
    is_student() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = feedbacks_alunos.aluno_id 
        AND email = (auth.jwt() ->> 'email')
    )
);

-- ============================================================================
-- POLÍTICAS: FOTOS_ALUNOS
-- ============================================================================

CREATE POLICY "coaches_manage_fotos"
ON fotos_alunos FOR ALL
USING (
    is_coach() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = fotos_alunos.aluno_id 
        AND coach_id = auth.uid()
    )
    OR is_admin()
)
WITH CHECK (
    is_coach() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = fotos_alunos.aluno_id 
        AND coach_id = auth.uid()
    )
    OR is_admin()
);

CREATE POLICY "alunos_select_fotos"
ON fotos_alunos FOR SELECT
USING (
    is_student() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = fotos_alunos.aluno_id 
        AND email = (auth.jwt() ->> 'email')
    )
);

-- ============================================================================
-- POLÍTICAS: PAYMENT_PLANS E RECURRING_CHARGES
-- ============================================================================

CREATE POLICY "coaches_manage_payment_plans"
ON payment_plans FOR ALL
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
)
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

CREATE POLICY "coaches_manage_recurring_charges"
ON recurring_charges_config FOR ALL
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
)
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

CREATE POLICY "alunos_select_recurring_charges"
ON recurring_charges_config FOR SELECT
USING (
    is_student() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = recurring_charges_config.aluno_id 
        AND email = (auth.jwt() ->> 'email')
    )
);

-- ============================================================================
-- POLÍTICAS: FINANCIAL_EXCEPTIONS
-- ============================================================================

CREATE POLICY "coaches_manage_financial_exceptions"
ON financial_exceptions FOR ALL
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
)
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

-- ============================================================================
-- POLÍTICAS: AGENDA_EVENTOS
-- ============================================================================

CREATE POLICY "coaches_manage_agenda_eventos"
ON agenda_eventos FOR ALL
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
)
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

-- ============================================================================
-- POLÍTICAS: CHECKIN_REMINDERS
-- ============================================================================

CREATE POLICY "coaches_manage_checkin_reminders"
ON checkin_reminders FOR ALL
USING (
    is_coach() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = checkin_reminders.aluno_id 
        AND coach_id = auth.uid()
    )
    OR is_admin()
)
WITH CHECK (
    is_coach() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = checkin_reminders.aluno_id 
        AND coach_id = auth.uid()
    )
    OR is_admin()
);

-- ============================================================================
-- POLÍTICAS: ASAAS_CONFIG E ASAAS_CUSTOMERS
-- ============================================================================

CREATE POLICY "coaches_manage_asaas_config"
ON asaas_config FOR ALL
USING (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
)
WITH CHECK (
    is_coach() AND coach_id = auth.uid()
    OR is_admin()
);

CREATE POLICY "coaches_manage_asaas_customers"
ON asaas_customers FOR ALL
USING (
    is_coach() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = asaas_customers.aluno_id 
        AND coach_id = auth.uid()
    )
    OR is_admin()
)
WITH CHECK (
    is_coach() AND EXISTS (
        SELECT 1 FROM alunos 
        WHERE id = asaas_customers.aluno_id 
        AND coach_id = auth.uid()
    )
    OR is_admin()
);

-- ============================================================================
-- FIM DAS POLÍTICAS RLS
-- ============================================================================
