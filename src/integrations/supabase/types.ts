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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      citation_classifications: {
        Row: {
          citation_context: string | null
          cited_paper_db_id: string | null
          cited_paper_id: string
          classification: string
          confidence: number | null
          created_at: string
          id: string
          paper_db_id: string | null
          paper_id: string
          section: string | null
        }
        Insert: {
          citation_context?: string | null
          cited_paper_db_id?: string | null
          cited_paper_id: string
          classification: string
          confidence?: number | null
          created_at?: string
          id?: string
          paper_db_id?: string | null
          paper_id: string
          section?: string | null
        }
        Update: {
          citation_context?: string | null
          cited_paper_db_id?: string | null
          cited_paper_id?: string
          classification?: string
          confidence?: number | null
          created_at?: string
          id?: string
          paper_db_id?: string | null
          paper_id?: string
          section?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "citation_classifications_cited_paper_db_id_fkey"
            columns: ["cited_paper_db_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citation_classifications_paper_db_id_fkey"
            columns: ["paper_db_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_cache: {
        Row: {
          citation_context: string | null
          column_name: string
          column_prompt: string | null
          created_at: string | null
          extracted_value: string
          id: string
          paper_id: string
        }
        Insert: {
          citation_context?: string | null
          column_name: string
          column_prompt?: string | null
          created_at?: string | null
          extracted_value: string
          id?: string
          paper_id: string
        }
        Update: {
          citation_context?: string | null
          column_name?: string
          column_prompt?: string | null
          created_at?: string | null
          extracted_value?: string
          id?: string
          paper_id?: string
        }
        Relationships: []
      }
      paper_chunks: {
        Row: {
          chunk_index: number
          chunk_text: string
          created_at: string | null
          embedding: string | null
          id: string
          paper_id: string
          paper_title: string
          source: string | null
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          paper_id: string
          paper_title: string
          source?: string | null
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          paper_id?: string
          paper_title?: string
          source?: string | null
        }
        Relationships: []
      }
      papers: {
        Row: {
          abstract: string | null
          authors: Json | null
          created_at: string
          doi: string | null
          external_id: string | null
          id: string
          journal: string | null
          open_access: boolean | null
          source: string | null
          title: string
          total_citations_received: number
          total_contrasting: number
          total_mentioning: number
          total_supporting: number
          updated_at: string
          url: string | null
          year: number | null
        }
        Insert: {
          abstract?: string | null
          authors?: Json | null
          created_at?: string
          doi?: string | null
          external_id?: string | null
          id?: string
          journal?: string | null
          open_access?: boolean | null
          source?: string | null
          title: string
          total_citations_received?: number
          total_contrasting?: number
          total_mentioning?: number
          total_supporting?: number
          updated_at?: string
          url?: string | null
          year?: number | null
        }
        Update: {
          abstract?: string | null
          authors?: Json | null
          created_at?: string
          doi?: string | null
          external_id?: string | null
          id?: string
          journal?: string | null
          open_access?: boolean | null
          source?: string | null
          title?: string
          total_citations_received?: number
          total_contrasting?: number
          total_mentioning?: number
          total_supporting?: number
          updated_at?: string
          url?: string | null
          year?: number | null
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          column_data: Json
          columns: Json
          created_at: string
          id: string
          papers: Json
          query: string
          user_id: string
        }
        Insert: {
          column_data?: Json
          columns?: Json
          created_at?: string
          id?: string
          papers?: Json
          query: string
          user_id: string
        }
        Update: {
          column_data?: Json
          columns?: Json
          created_at?: string
          id?: string
          papers?: Json
          query?: string
          user_id?: string
        }
        Relationships: []
      }
      uploaded_papers: {
        Row: {
          created_at: string | null
          extracted_text: string | null
          extraction_data: Json | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          status: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          extracted_text?: string | null
          extraction_data?: Json | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          extracted_text?: string | null
          extraction_data?: Json | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_approvals: {
        Row: {
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_paper_chunks: {
        Args: {
          filter_paper_id?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          chunk_text: string
          id: string
          paper_id: string
          paper_title: string
          similarity: number
          source: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
