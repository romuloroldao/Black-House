-- SCHEMA-01: Adicionar coluna updated_at à tabela user_roles
-- Por padrão, toda tabela mutável DEVE ter updated_at para auditoria e observabilidade
-- Esta migração é idempotente e segura para produção

-- Adicionar coluna updated_at se não existir
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Comentar a coluna para documentação
COMMENT ON COLUMN public.user_roles.updated_at IS 'Timestamp da última atualização do registro. Atualizado automaticamente por trigger.';

-- Criar função genérica para auto-atualizar updated_at (se ainda não existir)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Comentar a função para documentação
COMMENT ON FUNCTION public.set_updated_at() IS 'Trigger function para auto-atualizar updated_at em tabelas mutáveis.';

-- Criar trigger para auto-atualizar updated_at em UPDATEs
DROP TRIGGER IF EXISTS trg_user_roles_updated_at ON public.user_roles;
CREATE TRIGGER trg_user_roles_updated_at
    BEFORE UPDATE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Atualizar registros existentes para ter updated_at = created_at (se created_at existir)
-- Isso garante que registros antigos tenham um valor válido
UPDATE public.user_roles 
SET updated_at = COALESCE(created_at, now())
WHERE updated_at IS NULL OR updated_at < created_at;
