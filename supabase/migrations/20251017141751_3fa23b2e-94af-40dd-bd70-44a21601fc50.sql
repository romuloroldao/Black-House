-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Create policies for coach access
CREATE POLICY "Coaches can view their own notifications"
ON public.notificacoes
FOR SELECT
USING (auth.uid() = coach_id);

CREATE POLICY "Coaches can update their own notifications"
ON public.notificacoes
FOR UPDATE
USING (auth.uid() = coach_id);

CREATE POLICY "Coaches can delete their own notifications"
ON public.notificacoes
FOR DELETE
USING (auth.uid() = coach_id);

CREATE POLICY "System can insert notifications"
ON public.notificacoes
FOR INSERT
WITH CHECK (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_notificacoes_coach_id ON public.notificacoes(coach_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON public.notificacoes(lida);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_notificacoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_notificacoes_updated_at
BEFORE UPDATE ON public.notificacoes
FOR EACH ROW
EXECUTE FUNCTION public.update_notificacoes_updated_at();