export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      agenda_eventos: {
        Row: {
          aluno_id: string | null
          coach_id: string
          created_at: string | null
          data_evento: string
          descricao: string | null
          hora_evento: string | null
          id: string
          notificacao_enviada: boolean | null
          prioridade: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          aluno_id?: string | null
          coach_id: string
          created_at?: string | null
          data_evento: string
          descricao?: string | null
          hora_evento?: string | null
          id?: string
          notificacao_enviada?: boolean | null
          prioridade?: string | null
          status?: string
          tipo: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          aluno_id?: string | null
          coach_id?: string
          created_at?: string | null
          data_evento?: string
          descricao?: string | null
          hora_evento?: string | null
          id?: string
          notificacao_enviada?: boolean | null
          prioridade?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_eventos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      alimentos: {
        Row: {
          autor: string | null
          cho_por_referencia: number
          created_at: string | null
          id: string
          info_adicional: string | null
          kcal_por_referencia: number
          lip_por_referencia: number
          nome: string
          origem_ptn: string
          ptn_por_referencia: number
          quantidade_referencia_g: number
          tipo_id: string | null
        }
        Insert: {
          autor?: string | null
          cho_por_referencia: number
          created_at?: string | null
          id?: string
          info_adicional?: string | null
          kcal_por_referencia: number
          lip_por_referencia: number
          nome: string
          origem_ptn: string
          ptn_por_referencia: number
          quantidade_referencia_g?: number
          tipo_id?: string | null
        }
        Update: {
          autor?: string | null
          cho_por_referencia?: number
          created_at?: string | null
          id?: string
          info_adicional?: string | null
          kcal_por_referencia?: number
          lip_por_referencia?: number
          nome?: string
          origem_ptn?: string
          ptn_por_referencia?: number
          quantidade_referencia_g?: number
          tipo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alimentos_novo_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_alimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      alunos: {
        Row: {
          coach_id: string | null
          cpf_cnpj: string | null
          created_at: string
          data_nascimento: string | null
          email: string
          id: string
          nome: string | null
          objetivo: string | null
          peso: number | null
          plano: string | null
          telefone: string | null
        }
        Insert: {
          coach_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string
          id?: string
          nome?: string | null
          objetivo?: string | null
          peso?: number | null
          plano?: string | null
          telefone?: string | null
        }
        Update: {
          coach_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string
          id?: string
          nome?: string | null
          objetivo?: string | null
          peso?: number | null
          plano?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      alunos_treinos: {
        Row: {
          aluno_id: string
          ativo: boolean | null
          created_at: string | null
          data_inicio: string
          id: string
          treino_id: string
        }
        Insert: {
          aluno_id: string
          ativo?: boolean | null
          created_at?: string | null
          data_inicio?: string
          id?: string
          treino_id: string
        }
        Update: {
          aluno_id?: string
          ativo?: boolean | null
          created_at?: string | null
          data_inicio?: string
          id?: string
          treino_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alunos_treinos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alunos_treinos_treino_id_fkey"
            columns: ["treino_id"]
            isOneToOne: false
            referencedRelation: "treinos"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_config: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          is_sandbox: boolean
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          is_sandbox?: boolean
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          is_sandbox?: boolean
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      asaas_customers: {
        Row: {
          aluno_id: string
          asaas_customer_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          asaas_customer_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          asaas_customer_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asaas_customers_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_payments: {
        Row: {
          aluno_id: string
          asaas_customer_id: string
          asaas_payment_id: string
          bank_slip_url: string | null
          billing_type: string
          coach_id: string
          created_at: string
          description: string | null
          due_date: string
          id: string
          invoice_url: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          status: string
          updated_at: string
          value: number
        }
        Insert: {
          aluno_id: string
          asaas_customer_id: string
          asaas_payment_id: string
          bank_slip_url?: string | null
          billing_type: string
          coach_id: string
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          invoice_url?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          status?: string
          updated_at?: string
          value: number
        }
        Update: {
          aluno_id?: string
          asaas_customer_id?: string
          asaas_payment_id?: string
          bank_slip_url?: string | null
          billing_type?: string
          coach_id?: string
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          invoice_url?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "asaas_payments_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      conversas: {
        Row: {
          aluno_id: string
          coach_id: string
          created_at: string
          id: string
          ultima_mensagem: string | null
          ultima_mensagem_em: string | null
          updated_at: string
        }
        Insert: {
          aluno_id: string
          coach_id: string
          created_at?: string
          id?: string
          ultima_mensagem?: string | null
          ultima_mensagem_em?: string | null
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          ultima_mensagem?: string | null
          ultima_mensagem_em?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dietas: {
        Row: {
          aluno_id: string
          created_at: string
          data_criacao: string | null
          id: string
          nome: string
          objetivo: string | null
        }
        Insert: {
          aluno_id?: string
          created_at?: string
          data_criacao?: string | null
          id?: string
          nome: string
          objetivo?: string | null
        }
        Update: {
          aluno_id?: string
          created_at?: string
          data_criacao?: string | null
          id?: string
          nome?: string
          objetivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dietas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          categoria: string
          coach_id: string
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento: string | null
          frequencia_recorrencia: string | null
          id: string
          observacoes: string | null
          recorrente: boolean | null
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria: string
          coach_id: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento?: string | null
          frequencia_recorrencia?: string | null
          id?: string
          observacoes?: string | null
          recorrente?: boolean | null
          status?: string
          updated_at?: string
          valor: number
        }
        Update: {
          categoria?: string
          coach_id?: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          forma_pagamento?: string | null
          frequencia_recorrencia?: string | null
          id?: string
          observacoes?: string | null
          recorrente?: boolean | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      feedbacks_alunos: {
        Row: {
          aluno_id: string
          coach_id: string
          created_at: string | null
          feedback: string
          id: string
          updated_at: string | null
        }
        Insert: {
          aluno_id: string
          coach_id: string
          created_at?: string | null
          feedback: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          aluno_id?: string
          coach_id?: string
          created_at?: string | null
          feedback?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_alunos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_exceptions: {
        Row: {
          aluno_id: string
          ativo: boolean
          coach_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          id: string
          motivo: string
          observacoes: string | null
          percentual_desconto: number | null
          tipo: string
          updated_at: string
          valor_desconto: number | null
        }
        Insert: {
          aluno_id: string
          ativo?: boolean
          coach_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          id?: string
          motivo: string
          observacoes?: string | null
          percentual_desconto?: number | null
          tipo: string
          updated_at?: string
          valor_desconto?: number | null
        }
        Update: {
          aluno_id?: string
          ativo?: boolean
          coach_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          motivo?: string
          observacoes?: string | null
          percentual_desconto?: number | null
          tipo?: string
          updated_at?: string
          valor_desconto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_exceptions_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      fotos_alunos: {
        Row: {
          aluno_id: string
          created_at: string | null
          descricao: string | null
          id: string
          url: string
        }
        Insert: {
          aluno_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          url: string
        }
        Update: {
          aluno_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "fotos_alunos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_dieta: {
        Row: {
          alimento_id: string | null
          created_at: string
          dia_semana: string | null
          dieta_id: string | null
          id: string
          quantidade: number
          refeicao: string
        }
        Insert: {
          alimento_id?: string | null
          created_at?: string
          dia_semana?: string | null
          dieta_id?: string | null
          id?: string
          quantidade: number
          refeicao: string
        }
        Update: {
          alimento_id?: string | null
          created_at?: string
          dia_semana?: string | null
          dieta_id?: string | null
          id?: string
          quantidade?: number
          refeicao?: string
        }
        Relationships: [
          {
            foreignKeyName: "itens_dieta_alimento_id_fkey"
            columns: ["alimento_id"]
            isOneToOne: false
            referencedRelation: "alimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_dieta_dieta_id_fkey"
            columns: ["dieta_id"]
            isOneToOne: false
            referencedRelation: "dietas"
            referencedColumns: ["id"]
          },
        ]
      }
      lives: {
        Row: {
          auto_gravar: boolean | null
          coach_id: string | null
          created_at: string
          data_agendamento: string
          descricao: string | null
          duracao: number
          hora_agendamento: string
          id: string
          lembretes_ativados: boolean | null
          max_participantes: number | null
          num_inscricoes: number | null
          status: string
          tags: string[] | null
          titulo: string
          updated_at: string
          visibilidade: string
          youtube_stream_key: string | null
          youtube_url: string | null
        }
        Insert: {
          auto_gravar?: boolean | null
          coach_id?: string | null
          created_at?: string
          data_agendamento: string
          descricao?: string | null
          duracao?: number
          hora_agendamento: string
          id?: string
          lembretes_ativados?: boolean | null
          max_participantes?: number | null
          num_inscricoes?: number | null
          status: string
          tags?: string[] | null
          titulo: string
          updated_at?: string
          visibilidade: string
          youtube_stream_key?: string | null
          youtube_url?: string | null
        }
        Update: {
          auto_gravar?: boolean | null
          coach_id?: string | null
          created_at?: string
          data_agendamento?: string
          descricao?: string | null
          duracao?: number
          hora_agendamento?: string
          id?: string
          lembretes_ativados?: boolean | null
          max_participantes?: number | null
          num_inscricoes?: number | null
          status?: string
          tags?: string[] | null
          titulo?: string
          updated_at?: string
          visibilidade?: string
          youtube_stream_key?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      mensagens: {
        Row: {
          conteudo: string
          conversa_id: string
          created_at: string
          id: string
          lida: boolean | null
          remetente_id: string
        }
        Insert: {
          conteudo: string
          conversa_id: string
          created_at?: string
          id?: string
          lida?: boolean | null
          remetente_id: string
        }
        Update: {
          conteudo?: string
          conversa_id?: string
          created_at?: string
          id?: string
          lida?: boolean | null
          remetente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          aluno_id: string | null
          coach_id: string
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          aluno_id?: string | null
          coach_id: string
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem: string
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string | null
          coach_id?: string
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          ativo: boolean
          coach_id: string
          created_at: string
          descricao: string | null
          dia_vencimento: number
          frequencia: string
          id: string
          nome: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          coach_id: string
          created_at?: string
          descricao?: string | null
          dia_vencimento: number
          frequencia: string
          id?: string
          nome: string
          updated_at?: string
          valor: number
        }
        Update: {
          ativo?: boolean
          coach_id?: string
          created_at?: string
          descricao?: string | null
          dia_vencimento?: number
          frequencia?: string
          id?: string
          nome?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      planos_pagamento: {
        Row: {
          ativo: boolean
          coach_id: string
          created_at: string
          frequencia: string
          id: string
          nome: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          coach_id: string
          created_at?: string
          frequencia: string
          id?: string
          nome: string
          updated_at?: string
          valor: number
        }
        Update: {
          ativo?: boolean
          coach_id?: string
          created_at?: string
          frequencia?: string
          id?: string
          nome?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      recurring_charges_config: {
        Row: {
          aluno_id: string
          ativo: boolean
          coach_id: string
          created_at: string
          dia_vencimento_customizado: number | null
          dias_antecedencia_lembrete: number | null
          enviar_lembrete: boolean | null
          id: string
          payment_plan_id: string | null
          updated_at: string
          valor_customizado: number | null
        }
        Insert: {
          aluno_id: string
          ativo?: boolean
          coach_id: string
          created_at?: string
          dia_vencimento_customizado?: number | null
          dias_antecedencia_lembrete?: number | null
          enviar_lembrete?: boolean | null
          id?: string
          payment_plan_id?: string | null
          updated_at?: string
          valor_customizado?: number | null
        }
        Update: {
          aluno_id?: string
          ativo?: boolean
          coach_id?: string
          created_at?: string
          dia_vencimento_customizado?: number | null
          dias_antecedencia_lembrete?: number | null
          enviar_lembrete?: boolean | null
          id?: string
          payment_plan_id?: string | null
          updated_at?: string
          valor_customizado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_charges_config_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_charges_config_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorio_feedbacks: {
        Row: {
          aluno_id: string
          comentario: string
          created_at: string
          id: string
          relatorio_id: string
        }
        Insert: {
          aluno_id: string
          comentario: string
          created_at?: string
          id?: string
          relatorio_id: string
        }
        Update: {
          aluno_id?: string
          comentario?: string
          created_at?: string
          id?: string
          relatorio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_feedbacks_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_feedbacks_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorio_midias: {
        Row: {
          created_at: string
          id: string
          legenda: string | null
          ordem: number | null
          relatorio_id: string
          tipo: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          legenda?: string | null
          ordem?: number | null
          relatorio_id: string
          tipo: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          legenda?: string | null
          ordem?: number | null
          relatorio_id?: string
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_midias_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorio_templates: {
        Row: {
          ativo: boolean
          campos: Json
          coach_id: string
          created_at: string
          descricao: string | null
          id: string
          layout: Json
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          campos?: Json
          coach_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          layout?: Json
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          campos?: Json
          coach_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          layout?: Json
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      relatorios: {
        Row: {
          aluno_id: string
          coach_id: string
          created_at: string
          dados: Json
          enviado_em: string | null
          id: string
          metricas: Json | null
          observacoes: string | null
          periodo_fim: string
          periodo_inicio: string
          status: string
          template_id: string | null
          titulo: string
          updated_at: string
          visualizado_em: string | null
        }
        Insert: {
          aluno_id: string
          coach_id: string
          created_at?: string
          dados?: Json
          enviado_em?: string | null
          id?: string
          metricas?: Json | null
          observacoes?: string | null
          periodo_fim: string
          periodo_inicio: string
          status?: string
          template_id?: string | null
          titulo: string
          updated_at?: string
          visualizado_em?: string | null
        }
        Update: {
          aluno_id?: string
          coach_id?: string
          created_at?: string
          dados?: Json
          enviado_em?: string | null
          id?: string
          metricas?: Json | null
          observacoes?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          status?: string
          template_id?: string | null
          titulo?: string
          updated_at?: string
          visualizado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "relatorio_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_alimentos: {
        Row: {
          created_at: string | null
          id: string
          nome_tipo: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome_tipo: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome_tipo?: string
        }
        Relationships: []
      }
      treinos: {
        Row: {
          categoria: string
          coach_id: string | null
          created_at: string
          descricao: string | null
          dificuldade: string
          duracao: number
          exercicios: Json | null
          id: string
          is_template: boolean | null
          nome: string
          num_exercicios: number | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          categoria: string
          coach_id?: string | null
          created_at?: string
          descricao?: string | null
          dificuldade: string
          duracao?: number
          exercicios?: Json | null
          id?: string
          is_template?: boolean | null
          nome: string
          num_exercicios?: number | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          categoria?: string
          coach_id?: string | null
          created_at?: string
          descricao?: string | null
          dificuldade?: string
          duracao?: number
          exercicios?: Json | null
          id?: string
          is_template?: boolean | null
          nome?: string
          num_exercicios?: number | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          categoria: string
          coach_id: string | null
          created_at: string
          descricao: string | null
          duracao: string | null
          id: string
          instrutor: string | null
          likes: number | null
          tags: string[] | null
          titulo: string
          updated_at: string
          views: number | null
          visibilidade: string
          youtube_id: string
        }
        Insert: {
          categoria: string
          coach_id?: string | null
          created_at?: string
          descricao?: string | null
          duracao?: string | null
          id?: string
          instrutor?: string | null
          likes?: number | null
          tags?: string[] | null
          titulo: string
          updated_at?: string
          views?: number | null
          visibilidade: string
          youtube_id: string
        }
        Update: {
          categoria?: string
          coach_id?: string | null
          created_at?: string
          descricao?: string | null
          duracao?: string | null
          id?: string
          instrutor?: string | null
          likes?: number | null
          tags?: string[] | null
          titulo?: string
          updated_at?: string
          views?: number | null
          visibilidade?: string
          youtube_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_nutrientes: {
        Args: { alimento_id: string; quantidade_consumida_g: number }
        Returns: {
          cho: number
          kcal: number
          lip: number
          nome_alimento: string
          origem_ptn: string
          ptn: number
        }[]
      }
      get_aluno_id_by_email: { Args: { user_email?: string }; Returns: string }
      get_user_role: {
        Args: { user_uuid?: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_coach: { Args: { user_uuid?: string }; Returns: boolean }
    }
    Enums: {
      user_role: "coach" | "aluno"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["coach", "aluno"],
    },
  },
} as const
