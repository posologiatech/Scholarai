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
      ai_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          provider: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          provider: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      alert_results: {
        Row: {
          alert_id: string
          found_at: string
          id: string
          is_read: boolean
          paper_abstract: string | null
          paper_authors: Json | null
          paper_doi: string | null
          paper_source: string | null
          paper_title: string
          paper_url: string | null
          paper_year: number | null
          user_id: string
        }
        Insert: {
          alert_id: string
          found_at?: string
          id?: string
          is_read?: boolean
          paper_abstract?: string | null
          paper_authors?: Json | null
          paper_doi?: string | null
          paper_source?: string | null
          paper_title: string
          paper_url?: string | null
          paper_year?: number | null
          user_id: string
        }
        Update: {
          alert_id?: string
          found_at?: string
          id?: string
          is_read?: boolean
          paper_abstract?: string | null
          paper_authors?: Json | null
          paper_doi?: string | null
          paper_source?: string | null
          paper_title?: string
          paper_url?: string | null
          paper_year?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_results_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "literature_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
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
      datamind_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      datamind_dashboard_items: {
        Row: {
          content: Json
          created_at: string
          dashboard_id: string
          id: string
          item_type: string
          position: Json
          source_message_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          dashboard_id: string
          id?: string
          item_type?: string
          position?: Json
          source_message_id?: string | null
          title?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          dashboard_id?: string
          id?: string
          item_type?: string
          position?: Json
          source_message_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "datamind_dashboard_items_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "datamind_dashboards"
            referencedColumns: ["id"]
          },
        ]
      }
      datamind_dashboards: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          layout: Json
          share_token: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          layout?: Json
          share_token?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          layout?: Json
          share_token?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      datamind_files: {
        Row: {
          conversation_id: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          preview_data: Json | null
          schema_info: Json | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          preview_data?: Json | null
          schema_info?: Json | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          preview_data?: Json | null
          schema_info?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "datamind_files_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "datamind_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      datamind_messages: {
        Row: {
          code_block: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          output_content: string | null
          output_type: string | null
          role: string
        }
        Insert: {
          code_block?: string | null
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          output_content?: string | null
          output_type?: string | null
          role?: string
        }
        Update: {
          code_block?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          output_content?: string | null
          output_type?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "datamind_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "datamind_conversations"
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
      illustrations: {
        Row: {
          created_at: string
          id: string
          image_url: string
          prompt: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          prompt: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          prompt?: string
          user_id?: string
        }
        Relationships: []
      }
      literature_alerts: {
        Row: {
          created_at: string
          filters: Json
          frequency: string
          id: string
          is_active: boolean
          last_checked_at: string | null
          query: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          frequency?: string
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          query: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          frequency?: string
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          query?: string
          updated_at?: string
          user_id?: string
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
      reports: {
        Row: {
          content: string
          created_at: string
          id: string
          search_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          search_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          search_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "saved_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      retraction_watches: {
        Row: {
          created_at: string
          id: string
          last_checked_at: string | null
          paper_authors: Json | null
          paper_doi: string
          paper_title: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_checked_at?: string | null
          paper_authors?: Json | null
          paper_doi: string
          paper_title: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_checked_at?: string | null
          paper_authors?: Json | null
          paper_doi?: string
          paper_title?: string
          status?: string
          user_id?: string
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
      systematic_reviews: {
        Row: {
          auto_suggestions: boolean
          created_at: string
          extraction_columns: Json
          extraction_results: Json
          id: string
          included_paper_ids: string[]
          papers: Json
          report_content: string | null
          research_question: string
          screening_criteria: Json
          screening_results: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_suggestions?: boolean
          created_at?: string
          extraction_columns?: Json
          extraction_results?: Json
          id?: string
          included_paper_ids?: string[]
          papers?: Json
          report_content?: string | null
          research_question: string
          screening_criteria?: Json
          screening_results?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_suggestions?: boolean
          created_at?: string
          extraction_columns?: Json
          extraction_results?: Json
          id?: string
          included_paper_ids?: string[]
          papers?: Json
          report_content?: string | null
          research_question?: string
          screening_criteria?: Json
          screening_results?: Json
          status?: string
          updated_at?: string
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
      workspace_activity: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          paper_id: string | null
          paper_title: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          paper_id?: string | null
          paper_title?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          paper_id?: string | null
          paper_title?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_activity_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_annotations: {
        Row: {
          annotation_type: string
          content: string
          created_at: string
          id: string
          paper_id: string
          paper_title: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          annotation_type?: string
          content: string
          created_at?: string
          id?: string
          paper_id: string
          paper_title?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          annotation_type?: string
          content?: string
          created_at?: string
          id?: string
          paper_id?: string
          paper_title?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_annotations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          accepted: boolean
          created_at: string
          email: string | null
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          accepted?: boolean
          created_at?: string
          email?: string | null
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          accepted?: boolean
          created_at?: string
          email?: string | null
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_workspace: {
        Args: { _description?: string; _name: string }
        Returns: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "workspaces"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_workspace_role: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
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
      workspace_role: "owner" | "advisor" | "coauthor" | "reviewer"
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
      workspace_role: ["owner", "advisor", "coauthor", "reviewer"],
    },
  },
} as const
