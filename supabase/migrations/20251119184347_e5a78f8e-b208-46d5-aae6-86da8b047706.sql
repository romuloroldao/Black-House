-- Criar tabela para configurações do Twilio
CREATE TABLE IF NOT EXISTS public.twilio_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL,
  account_sid TEXT,
  auth_token TEXT,
  whatsapp_from TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.twilio_config ENABLE ROW LEVEL SECURITY;

-- Policies para twilio_config
CREATE POLICY "Coaches can view their own twilio config"
  ON public.twilio_config FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches can insert their own twilio config"
  ON public.twilio_config FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update their own twilio config"
  ON public.twilio_config FOR UPDATE
  USING (coach_id = auth.uid());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_twilio_config_updated_at
  BEFORE UPDATE ON public.twilio_config
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();