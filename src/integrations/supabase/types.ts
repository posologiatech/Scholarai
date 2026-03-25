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
      ai_usage_log: {
        Row: {
          created_at: string
          estimated_cost_usd: number | null
          id: string
          model: string | null
          prompt_type: string | null
          provider: string
          tokens_input: number | null
          tokens_output: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_cost_usd?: number | null
          id?: string
          model?: string | null
          prompt_type?: string | null
          provider: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_cost_usd?: number | null
          id?: string
          model?: string | null
          prompt_type?: string | null
          provider?: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string
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
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          metadata: Json | null
          page_path: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      consent_signatures: {
        Row: {
          consent_id: string
          consent_version: number | null
          id: string
          ip_address: string | null
          pdf_path: string | null
          researcher_ip: string | null
          researcher_name: string | null
          researcher_signed_at: string | null
          respondent_email: string | null
          respondent_name: string
          revocation_reason: string | null
          revoked_at: string | null
          section_confirmations: Json
          signature_data: string | null
          signed_at: string
          user_agent: string | null
        }
        Insert: {
          consent_id: string
          consent_version?: number | null
          id?: string
          ip_address?: string | null
          pdf_path?: string | null
          researcher_ip?: string | null
          researcher_name?: string | null
          researcher_signed_at?: string | null
          respondent_email?: string | null
          respondent_name: string
          revocation_reason?: string | null
          revoked_at?: string | null
          section_confirmations?: Json
          signature_data?: string | null
          signed_at?: string
          user_agent?: string | null
        }
        Update: {
          consent_id?: string
          consent_version?: number | null
          id?: string
          ip_address?: string | null
          pdf_path?: string | null
          researcher_ip?: string | null
          researcher_name?: string | null
          researcher_signed_at?: string | null
          respondent_email?: string | null
          respondent_name?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          section_confirmations?: Json
          signature_data?: string | null
          signed_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_signatures_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "study_consents"
            referencedColumns: ["id"]
          },
        ]
      }
      datamind_checkpoints: {
        Row: {
          branch_name: string | null
          conversation_id: string
          created_at: string
          description: string | null
          files_snapshot: Json
          id: string
          label: string
          messages_snapshot: Json
          parent_checkpoint_id: string | null
          spreadsheet_snapshot: Json | null
          user_id: string
        }
        Insert: {
          branch_name?: string | null
          conversation_id: string
          created_at?: string
          description?: string | null
          files_snapshot?: Json
          id?: string
          label?: string
          messages_snapshot?: Json
          parent_checkpoint_id?: string | null
          spreadsheet_snapshot?: Json | null
          user_id: string
        }
        Update: {
          branch_name?: string | null
          conversation_id?: string
          created_at?: string
          description?: string | null
          files_snapshot?: Json
          id?: string
          label?: string
          messages_snapshot?: Json
          parent_checkpoint_id?: string | null
          spreadsheet_snapshot?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "datamind_checkpoints_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "datamind_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "datamind_checkpoints_parent_checkpoint_id_fkey"
            columns: ["parent_checkpoint_id"]
            isOneToOne: false
            referencedRelation: "datamind_checkpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      datamind_cleaning_profiles: {
        Row: {
          conversation_id: string | null
          created_at: string
          file_id: string | null
          id: string
          issues: Json
          status: string
          title: string
          transformations: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          file_id?: string | null
          id?: string
          issues?: Json
          status?: string
          title?: string
          transformations?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          file_id?: string | null
          id?: string
          issues?: Json
          status?: string
          title?: string
          transformations?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "datamind_cleaning_profiles_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "datamind_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "datamind_cleaning_profiles_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "datamind_files"
            referencedColumns: ["id"]
          },
        ]
      }
      datamind_comments: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_id: string
          updated_at: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          message_id: string
          updated_at?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_id?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "datamind_comments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "datamind_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      datamind_conversation_shares: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          owner_id: string
          permission: string
          shared_with_email: string
          shared_with_user_id: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          owner_id: string
          permission?: string
          shared_with_email: string
          shared_with_user_id?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          owner_id?: string
          permission?: string
          shared_with_email?: string
          shared_with_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "datamind_conversation_shares_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "datamind_conversations"
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
      datamind_db_connections: {
        Row: {
          created_at: string
          database_name: string
          db_type: string
          host: string
          id: string
          is_active: boolean
          last_connected_at: string | null
          name: string
          password_encrypted: string
          port: number
          schema_cache: Json | null
          ssl_mode: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          database_name: string
          db_type?: string
          host: string
          id?: string
          is_active?: boolean
          last_connected_at?: string | null
          name: string
          password_encrypted: string
          port?: number
          schema_cache?: Json | null
          ssl_mode?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          database_name?: string
          db_type?: string
          host?: string
          id?: string
          is_active?: boolean
          last_connected_at?: string | null
          name?: string
          password_encrypted?: string
          port?: number
          schema_cache?: Json | null
          ssl_mode?: string
          updated_at?: string
          user_id?: string
          username?: string
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
      datamind_pipeline_steps: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          pipeline_id: string
          prompt: string
          step_order: number
        }
        Insert: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          pipeline_id: string
          prompt?: string
          step_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          pipeline_id?: string
          prompt?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "datamind_pipeline_steps_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "datamind_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      datamind_pipelines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          tags: string[]
          title: string
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          tags?: string[]
          title?: string
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          tags?: string[]
          title?: string
          updated_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: []
      }
      datasus_alert_results: {
        Row: {
          alert_id: string
          alert_level: string
          current_value: number | null
          description: string | null
          detected_at: string
          disease: string | null
          historical_mean: number | null
          id: string
          is_read: boolean
          location: string | null
          period: string | null
          std_deviation: number | null
          title: string
          user_id: string
          z_score: number | null
        }
        Insert: {
          alert_id: string
          alert_level?: string
          current_value?: number | null
          description?: string | null
          detected_at?: string
          disease?: string | null
          historical_mean?: number | null
          id?: string
          is_read?: boolean
          location?: string | null
          period?: string | null
          std_deviation?: number | null
          title: string
          user_id: string
          z_score?: number | null
        }
        Update: {
          alert_id?: string
          alert_level?: string
          current_value?: number | null
          description?: string | null
          detected_at?: string
          disease?: string | null
          historical_mean?: number | null
          id?: string
          is_read?: boolean
          location?: string | null
          period?: string | null
          std_deviation?: number | null
          title?: string
          user_id?: string
          z_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "datasus_alert_results_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "datasus_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      datasus_alerts: {
        Row: {
          created_at: string
          disease: string
          frequency: string
          id: string
          is_active: boolean
          last_checked_at: string | null
          location: string
          state_codes: string[]
          threshold_std_dev: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disease: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          location: string
          state_codes?: string[]
          threshold_std_dev?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disease?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          location?: string
          state_codes?: string[]
          threshold_std_dev?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      datasus_conversations: {
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
      datasus_messages: {
        Row: {
          code: string | null
          content: string
          conversation_id: string
          created_at: string
          data_source: string | null
          disease: string | null
          error: string | null
          explanation: string | null
          id: string
          images: Json | null
          location: string | null
          period: string | null
          role: string
          stdout: string | null
          tables_data: Json | null
        }
        Insert: {
          code?: string | null
          content?: string
          conversation_id: string
          created_at?: string
          data_source?: string | null
          disease?: string | null
          error?: string | null
          explanation?: string | null
          id?: string
          images?: Json | null
          location?: string | null
          period?: string | null
          role?: string
          stdout?: string | null
          tables_data?: Json | null
        }
        Update: {
          code?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          data_source?: string | null
          disease?: string | null
          error?: string | null
          explanation?: string | null
          id?: string
          images?: Json | null
          location?: string | null
          period?: string | null
          role?: string
          stdout?: string | null
          tables_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "datasus_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "datasus_conversations"
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
          category: string | null
          created_at: string
          id: string
          image_url: string
          is_public: boolean
          prompt: string
          style: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_public?: boolean
          prompt: string
          style?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_public?: boolean
          prompt?: string
          style?: string | null
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
      participant_documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_type: string | null
          id: string
          participant_id: string
          user_id: string
          visit_id: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_type?: string | null
          id?: string
          participant_id: string
          user_id: string
          visit_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_type?: string | null
          id?: string
          participant_id?: string
          user_id?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_documents_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "study_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_documents_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "study_visits"
            referencedColumns: ["id"]
          },
        ]
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
      screening_decisions: {
        Row: {
          created_at: string
          criteria_results: Json
          decision: string
          id: string
          inclusion_score: number | null
          notes: string | null
          paper_id: string
          review_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          criteria_results?: Json
          decision?: string
          id?: string
          inclusion_score?: number | null
          notes?: string | null
          paper_id: string
          review_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          criteria_results?: Json
          decision?: string
          id?: string
          inclusion_score?: number | null
          notes?: string | null
          paper_id?: string
          review_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_decisions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "systematic_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      study_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          participant_id: string | null
          survey_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          participant_id?: string | null
          survey_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          participant_id?: string | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_audit_log_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "study_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_audit_log_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      study_consents: {
        Row: {
          audio_url: string | null
          contact_hours: string | null
          created_at: string
          id: string
          paper_access_info: string | null
          require_signature: boolean
          researcher_email: string | null
          researcher_name: string | null
          researcher_phone: string | null
          sections: Json
          survey_id: string
          title: string
          updated_at: string
          user_id: string
          version: number
          video_url: string | null
        }
        Insert: {
          audio_url?: string | null
          contact_hours?: string | null
          created_at?: string
          id?: string
          paper_access_info?: string | null
          require_signature?: boolean
          researcher_email?: string | null
          researcher_name?: string | null
          researcher_phone?: string | null
          sections?: Json
          survey_id: string
          title?: string
          updated_at?: string
          user_id: string
          version?: number
          video_url?: string | null
        }
        Update: {
          audio_url?: string | null
          contact_hours?: string | null
          created_at?: string
          id?: string
          paper_access_info?: string | null
          require_signature?: boolean
          researcher_email?: string | null
          researcher_name?: string | null
          researcher_phone?: string | null
          sections?: Json
          survey_id?: string
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_consents_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      study_participants: {
        Row: {
          consent_signature_id: string | null
          created_at: string
          id: string
          metadata: Json
          participant_code: string
          status: string
          survey_id: string
          user_id: string
        }
        Insert: {
          consent_signature_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          participant_code: string
          status?: string
          survey_id: string
          user_id: string
        }
        Update: {
          consent_signature_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          participant_code?: string
          status?: string
          survey_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_participants_consent_signature_id_fkey"
            columns: ["consent_signature_id"]
            isOneToOne: false
            referencedRelation: "consent_signatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_participants_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      study_visits: {
        Row: {
          created_at: string
          id: string
          label: string
          survey_id: string
          target_days: number | null
          user_id: string
          visit_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          survey_id: string
          target_days?: number | null
          user_id: string
          visit_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          survey_id?: string
          target_days?: number | null
          user_id?: string
          visit_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "study_visits_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      survey_answer_audit: {
        Row: {
          answer_id: string
          change_reason: string
          changed_by: string
          created_at: string
          id: string
          ip_address: string | null
          new_hash: string | null
          new_value: Json
          previous_hash: string | null
          previous_value: Json
        }
        Insert: {
          answer_id: string
          change_reason: string
          changed_by: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_hash?: string | null
          new_value?: Json
          previous_hash?: string | null
          previous_value?: Json
        }
        Update: {
          answer_id?: string
          change_reason?: string
          changed_by?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_hash?: string | null
          new_value?: Json
          previous_hash?: string | null
          previous_value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "survey_answer_audit_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "survey_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_answers: {
        Row: {
          answer_choices: Json
          answer_numeric: number | null
          answer_text: string | null
          id: string
          integrity_hash: string | null
          last_modified_at: string | null
          last_modified_by: string | null
          matrix_answers: Json
          question_id: string
          response_id: string
          version: number
        }
        Insert: {
          answer_choices?: Json
          answer_numeric?: number | null
          answer_text?: string | null
          id?: string
          integrity_hash?: string | null
          last_modified_at?: string | null
          last_modified_by?: string | null
          matrix_answers?: Json
          question_id: string
          response_id: string
          version?: number
        }
        Update: {
          answer_choices?: Json
          answer_numeric?: number | null
          answer_text?: string | null
          id?: string
          integrity_hash?: string | null
          last_modified_at?: string | null
          last_modified_by?: string | null
          matrix_answers?: Json
          question_id?: string
          response_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "survey_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_blocks: {
        Row: {
          block_order: number
          description: string | null
          id: string
          randomize_questions: boolean
          settings: Json
          survey_id: string
          title: string
        }
        Insert: {
          block_order?: number
          description?: string | null
          id?: string
          randomize_questions?: boolean
          settings?: Json
          survey_id: string
          title?: string
        }
        Update: {
          block_order?: number
          description?: string | null
          id?: string
          randomize_questions?: boolean
          settings?: Json
          survey_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_blocks_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_contacts: {
        Row: {
          created_at: string
          custom_fields: Json
          email: string
          first_name: string | null
          id: string
          institution: string | null
          last_name: string | null
          status: string
          survey_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_fields?: Json
          email: string
          first_name?: string | null
          id?: string
          institution?: string | null
          last_name?: string | null
          status?: string
          survey_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_fields?: Json
          email?: string
          first_name?: string | null
          id?: string
          institution?: string | null
          last_name?: string | null
          status?: string
          survey_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_contacts_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_distributions: {
        Row: {
          anonymous_token: string | null
          created_at: string
          email_body: string | null
          email_subject: string | null
          id: string
          scheduled_at: string | null
          sent_at: string | null
          survey_id: string
          type: string
          user_id: string
        }
        Insert: {
          anonymous_token?: string | null
          created_at?: string
          email_body?: string | null
          email_subject?: string | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          survey_id: string
          type?: string
          user_id: string
        }
        Update: {
          anonymous_token?: string | null
          created_at?: string
          email_body?: string | null
          email_subject?: string | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          survey_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_distributions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_logic_rules: {
        Row: {
          action: string
          condition: Json
          id: string
          rule_order: number
          source_block_id: string | null
          source_question_id: string | null
          survey_id: string
          target_id: string | null
        }
        Insert: {
          action?: string
          condition?: Json
          id?: string
          rule_order?: number
          source_block_id?: string | null
          source_question_id?: string | null
          survey_id: string
          target_id?: string | null
        }
        Update: {
          action?: string
          condition?: Json
          id?: string
          rule_order?: number
          source_block_id?: string | null
          source_question_id?: string | null
          survey_id?: string
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_logic_rules_source_block_id_fkey"
            columns: ["source_block_id"]
            isOneToOne: false
            referencedRelation: "survey_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_logic_rules_source_question_id_fkey"
            columns: ["source_question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_logic_rules_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_questions: {
        Row: {
          block_id: string
          choices: Json
          description: string | null
          id: string
          is_required: boolean
          matrix_columns: Json
          matrix_rows: Json
          question_order: number
          question_text: string
          question_type: string
          settings: Json
          survey_id: string
          validation_rules: Json
        }
        Insert: {
          block_id: string
          choices?: Json
          description?: string | null
          id?: string
          is_required?: boolean
          matrix_columns?: Json
          matrix_rows?: Json
          question_order?: number
          question_text?: string
          question_type?: string
          settings?: Json
          survey_id: string
          validation_rules?: Json
        }
        Update: {
          block_id?: string
          choices?: Json
          description?: string | null
          id?: string
          is_required?: boolean
          matrix_columns?: Json
          matrix_rows?: Json
          question_order?: number
          question_text?: string
          question_type?: string
          settings?: Json
          survey_id?: string
          validation_rules?: Json
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "survey_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          completed_at: string | null
          contact_id: string | null
          duration_seconds: number | null
          id: string
          ip_address: string | null
          metadata: Json
          respondent_id: string | null
          response_hash: string | null
          started_at: string
          status: string
          survey_id: string
          user_agent: string | null
        }
        Insert: {
          completed_at?: string | null
          contact_id?: string | null
          duration_seconds?: number | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          respondent_id?: string | null
          response_hash?: string | null
          started_at?: string
          status?: string
          survey_id: string
          user_agent?: string | null
        }
        Update: {
          completed_at?: string | null
          contact_id?: string | null
          duration_seconds?: number | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          respondent_id?: string | null
          response_hash?: string | null
          started_at?: string
          status?: string
          survey_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "survey_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_team_members: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          role: string
          survey_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          role?: string
          survey_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          role?: string
          survey_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_team_members_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          closed_at: string | null
          created_at: string
          description: string | null
          id: string
          published_at: string | null
          settings: Json
          status: string
          title: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          published_at?: string | null
          settings?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          published_at?: string | null
          settings?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      system_changelog: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          module: string | null
          priority: string | null
          released_at: string | null
          status: string
          title: string
          updated_at: string
          version: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          module?: string | null
          priority?: string | null
          released_at?: string | null
          status?: string
          title: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          module?: string | null
          priority?: string | null
          released_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          version?: string | null
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
      usage_tracking: {
        Row: {
          count: number
          created_at: string
          feature: string
          id: string
          period: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          feature: string
          id?: string
          period: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          feature?: string
          id?: string
          period?: string
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
      is_survey_owner: {
        Args: { _survey_id: string; _user_id: string }
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
