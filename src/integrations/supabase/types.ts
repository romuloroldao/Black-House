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
      alimentos: {
        Row: {
          carboidratos: number
          created_at: string
          grupo: string
          id: number
          kcal: number
          lipidios: number
          nome: string
          origem: string | null
          proteinas: number
          quantidade: number | null
        }
        Insert: {
          carboidratos: number
          created_at?: string
          grupo?: string
          id?: number
          kcal: number
          lipidios: number
          nome?: string
          origem?: string | null
          proteinas: number
          quantidade?: number | null
        }
        Update: {
          carboidratos?: number
          created_at?: string
          grupo?: string
          id?: number
          kcal?: number
          lipidios?: number
          nome?: string
          origem?: string | null
          proteinas?: number
          quantidade?: number | null
        }
        Relationships: []
      }
      alunos: {
        Row: {
          coach_id: string | null
          created_at: string
          data_nascimento: string | null
          email: string
          id: string
          nome: string | null
          objetivo: string | null
          peso: number | null
        }
        Insert: {
          coach_id?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string
          id?: string
          nome?: string | null
          objetivo?: string | null
          peso?: number | null
        }
        Update: {
          coach_id?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string
          id?: string
          nome?: string | null
          objetivo?: string | null
          peso?: number | null
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
          alimento_id: number | null
          created_at: string
          dia_semana: string | null
          dieta_id: string | null
          id: string
          quantidade: number
          refeicao: string
        }
        Insert: {
          alimento_id?: number | null
          created_at?: string
          dia_semana?: string | null
          dieta_id?: string | null
          id?: string
          quantidade: number
          refeicao: string
        }
        Update: {
          alimento_id?: number | null
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
      treinos: {
        Row: {
          categoria: string
          coach_id: string | null
          created_at: string
          descricao: string | null
          dificuldade: string
          duracao: number
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
      get_user_role: {
        Args: { user_uuid?: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_coach: {
        Args: { user_uuid?: string }
        Returns: boolean
      }
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
