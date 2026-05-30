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
          research_project_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          research_project_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          research_project_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "datamind_conversations_research_project_id_fkey"
            columns: ["research_project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
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
      funding_call_subscriptions: {
        Row: {
          call_id: string
          created_at: string
          id: string
          notified_at: string | null
          notify_days_before: number
          user_id: string
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          notified_at?: string | null
          notify_days_before?: number
          user_id: string
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          notified_at?: string | null
          notify_days_before?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_call_subscriptions_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "funding_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_calls: {
        Row: {
          agency: string
          amount_brl: number | null
          areas: string[]
          confidence: number | null
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          eligibility: string | null
          external_id: string | null
          id: string
          is_manual: boolean
          published_at: string | null
          source_id: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          agency: string
          amount_brl?: number | null
          areas?: string[]
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          eligibility?: string | null
          external_id?: string | null
          id?: string
          is_manual?: boolean
          published_at?: string | null
          source_id?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          agency?: string
          amount_brl?: number | null
          areas?: string[]
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          eligibility?: string | null
          external_id?: string | null
          id?: string
          is_manual?: boolean
          published_at?: string | null
          source_id?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funding_calls_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "funding_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_sources: {
        Row: {
          agency: string
          created_at: string
          feed_type: string
          feed_url: string | null
          id: string
          is_active: boolean
          last_synced_at: string | null
          name: string
        }
        Insert: {
          agency: string
          created_at?: string
          feed_type?: string
          feed_url?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name: string
        }
        Update: {
          agency?: string
          created_at?: string
          feed_type?: string
          feed_url?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name?: string
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
      orcid_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          name: string | null
          orcid_id: string
          refresh_token: string | null
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          name?: string | null
          orcid_id: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          name?: string | null
          orcid_id?: string
          refresh_token?: string | null
          scope?: string | null
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
      reference_manager_connections: {
        Row: {
          api_key: string
          created_at: string
          id: string
          last_synced_at: string | null
          provider: string
          sync_config: Json
          sync_status: string
          updated_at: string
          user_id: string
          user_library_id: string | null
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          provider: string
          sync_config?: Json
          sync_status?: string
          updated_at?: string
          user_id: string
          user_library_id?: string | null
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          provider?: string
          sync_config?: Json
          sync_status?: string
          updated_at?: string
          user_id?: string
          user_library_id?: string | null
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
      research_advisee_milestones: {
        Row: {
          advisee_id: string
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          position: number
          status: Database["public"]["Enums"]["research_milestone_status"]
          title: string
        }
        Insert: {
          advisee_id: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          position?: number
          status?: Database["public"]["Enums"]["research_milestone_status"]
          title: string
        }
        Update: {
          advisee_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          position?: number
          status?: Database["public"]["Enums"]["research_milestone_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_advisee_milestones_advisee_id_fkey"
            columns: ["advisee_id"]
            isOneToOne: false
            referencedRelation: "research_advisees"
            referencedColumns: ["id"]
          },
        ]
      }
      research_advisees: {
        Row: {
          advisor_id: string
          created_at: string
          email: string | null
          expected_defense_date: string | null
          full_name: string
          id: string
          level: Database["public"]["Enums"]["research_advisee_level"]
          notes: string | null
          project_id: string
          start_date: string | null
          thesis_title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          advisor_id: string
          created_at?: string
          email?: string | null
          expected_defense_date?: string | null
          full_name: string
          id?: string
          level?: Database["public"]["Enums"]["research_advisee_level"]
          notes?: string | null
          project_id: string
          start_date?: string | null
          thesis_title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          advisor_id?: string
          created_at?: string
          email?: string | null
          expected_defense_date?: string | null
          full_name?: string
          id?: string
          level?: Database["public"]["Enums"]["research_advisee_level"]
          notes?: string | null
          project_id?: string
          start_date?: string | null
          thesis_title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_advisees_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_budget_items: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          description: string
          funder: string | null
          id: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          planned_amount: number
          project_id: string
          rubrica: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          description: string
          funder?: string | null
          id?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          planned_amount?: number
          project_id: string
          rubrica: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          description?: string
          funder?: string | null
          id?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          planned_amount?: number
          project_id?: string
          rubrica?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_budget_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          mentions: string[]
          parent_id: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          mentions?: string[]
          parent_id?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          mentions?: string[]
          parent_id?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "research_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_compliance_items: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_compliance_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_copilot_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_copilot_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_credit_contributions: {
        Row: {
          author_order: number | null
          created_at: string
          id: string
          is_corresponding: boolean
          member_id: string
          notes: string | null
          project_id: string
          roles: string[]
          updated_at: string
        }
        Insert: {
          author_order?: number | null
          created_at?: string
          id?: string
          is_corresponding?: boolean
          member_id: string
          notes?: string | null
          project_id: string
          roles?: string[]
          updated_at?: string
        }
        Update: {
          author_order?: number | null
          created_at?: string
          id?: string
          is_corresponding?: boolean
          member_id?: string
          notes?: string | null
          project_id?: string
          roles?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_credit_contributions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "research_project_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_credit_contributions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_defense: {
        Row: {
          abstract: string | null
          created_at: string
          created_by: string | null
          defense_date: string | null
          defense_type: string | null
          grade: string | null
          id: string
          location: string | null
          meeting_link: string | null
          modality: string | null
          notes: string | null
          project_id: string
          result: string | null
          status: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          abstract?: string | null
          created_at?: string
          created_by?: string | null
          defense_date?: string | null
          defense_type?: string | null
          grade?: string | null
          id?: string
          location?: string | null
          meeting_link?: string | null
          modality?: string | null
          notes?: string | null
          project_id: string
          result?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          abstract?: string | null
          created_at?: string
          created_by?: string | null
          defense_date?: string | null
          defense_type?: string | null
          grade?: string | null
          id?: string
          location?: string | null
          meeting_link?: string | null
          modality?: string | null
          notes?: string | null
          project_id?: string
          result?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_defense_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_defense_members: {
        Row: {
          created_at: string
          email: string | null
          id: string
          institution: string | null
          lattes_url: string | null
          name: string
          notes: string | null
          position: number | null
          project_id: string
          role: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          institution?: string | null
          lattes_url?: string | null
          name: string
          notes?: string | null
          position?: number | null
          project_id: string
          role?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          institution?: string | null
          lattes_url?: string | null
          name?: string
          notes?: string | null
          position?: number | null
          project_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_defense_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_documents: {
        Row: {
          content: string | null
          created_at: string
          created_by: string
          doc_type: string
          file_url: string | null
          generated_by_ai: boolean
          id: string
          metadata: Json
          project_id: string
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by: string
          doc_type: string
          file_url?: string | null
          generated_by_ai?: boolean
          id?: string
          metadata?: Json
          project_id: string
          status?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string
          doc_type?: string
          file_url?: string | null
          generated_by_ai?: boolean
          id?: string
          metadata?: Json
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "research_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_ethics_attachments: {
        Row: {
          created_at: string
          file_url: string
          id: string
          name: string
          project_id: string
          submission_id: string
          uploaded_by: string
          version: number
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          name: string
          project_id: string
          submission_id: string
          uploaded_by: string
          version?: number
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          name?: string
          project_id?: string
          submission_id?: string
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "research_ethics_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_ethics_attachments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "research_ethics_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      research_ethics_submissions: {
        Row: {
          caae: string | null
          created_at: string
          created_by: string
          decision_date: string | null
          id: string
          notes: string | null
          project_id: string
          protocol_number: string | null
          reviewer_notes: string | null
          status: string
          submission_type: string
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          caae?: string | null
          created_at?: string
          created_by: string
          decision_date?: string | null
          id?: string
          notes?: string | null
          project_id: string
          protocol_number?: string | null
          reviewer_notes?: string | null
          status?: string
          submission_type: string
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          caae?: string | null
          created_at?: string
          created_by?: string
          decision_date?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          protocol_number?: string | null
          reviewer_notes?: string | null
          status?: string
          submission_type?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_ethics_submissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_examiners: {
        Row: {
          created_at: string
          email: string | null
          id: string
          institution: string | null
          lattes_url: string | null
          name: string
          notes: string | null
          owner_id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          institution?: string | null
          lattes_url?: string | null
          name: string
          notes?: string | null
          owner_id?: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          institution?: string | null
          lattes_url?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      research_expenses: {
        Row: {
          amount: number
          budget_item_id: string | null
          created_at: string
          created_by: string
          currency: string
          description: string
          expense_date: string
          id: string
          invoice_number: string | null
          invoice_url: string | null
          ocr_data: Json | null
          ocr_text: string | null
          project_id: string
          status: string
          suggested_rubrica: string | null
          supplier: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          budget_item_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          description: string
          expense_date: string
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          ocr_data?: Json | null
          ocr_text?: string | null
          project_id: string
          status?: string
          suggested_rubrica?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          budget_item_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          description?: string
          expense_date?: string
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          ocr_data?: Json | null
          ocr_text?: string | null
          project_id?: string
          status?: string
          suggested_rubrica?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_expenses_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "research_budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_favorites: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          position: number | null
          project_id: string
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          position?: number | null
          project_id: string
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          position?: number | null
          project_id?: string
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_favorites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_idea_edges: {
        Row: {
          created_at: string
          id: string
          label: string | null
          project_id: string
          source_node_id: string
          target_node_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          project_id: string
          source_node_id: string
          target_node_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          project_id?: string
          source_node_id?: string
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_idea_edges_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_idea_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "research_idea_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_idea_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "research_idea_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      research_idea_nodes: {
        Row: {
          created_at: string
          data: Json
          id: string
          label: string
          node_type: string
          position_x: number
          position_y: number
          project_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          label: string
          node_type?: string
          position_x?: number
          position_y?: number
          project_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          label?: string
          node_type?: string
          position_x?: number
          position_y?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_idea_nodes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_ideas: {
        Row: {
          ai_generated: boolean
          created_at: string
          created_by: string
          description: string | null
          hypothesis: string | null
          id: string
          method: string | null
          project_id: string
          status: string
          title: string
        }
        Insert: {
          ai_generated?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          hypothesis?: string | null
          id?: string
          method?: string | null
          project_id: string
          status?: string
          title: string
        }
        Update: {
          ai_generated?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          hypothesis?: string | null
          id?: string
          method?: string | null
          project_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_ideas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_integrations: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          external_id: string | null
          external_url: string | null
          id: string
          label: string | null
          project_id: string
          provider: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          label?: string | null
          project_id: string
          provider: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          label?: string | null
          project_id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_logbook_entries: {
        Row: {
          attachments: Json
          author_id: string
          content: string
          countersigned_at: string | null
          countersigned_by: string | null
          created_at: string
          entry_date: string
          entry_type: string
          id: string
          project_id: string
          signature_hash: string | null
          signed_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          author_id: string
          content: string
          countersigned_at?: string | null
          countersigned_by?: string | null
          created_at?: string
          entry_date?: string
          entry_type: string
          id?: string
          project_id: string
          signature_hash?: string | null
          signed_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          author_id?: string
          content?: string
          countersigned_at?: string | null
          countersigned_by?: string | null
          created_at?: string
          entry_date?: string
          entry_type?: string
          id?: string
          project_id?: string
          signature_hash?: string | null
          signed_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_logbook_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_meeting_agenda_items: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          meeting_id: string
          notes: string | null
          position: number
          source_schedule_item_id: string | null
          source_task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          meeting_id: string
          notes?: string | null
          position?: number
          source_schedule_item_id?: string | null
          source_task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          meeting_id?: string
          notes?: string | null
          position?: number
          source_schedule_item_id?: string | null
          source_task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_meeting_agenda_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "research_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_meeting_agenda_items_source_schedule_fkey"
            columns: ["source_schedule_item_id"]
            isOneToOne: false
            referencedRelation: "research_schedule_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_meeting_agenda_items_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "research_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      research_meeting_attachments: {
        Row: {
          agenda_item_id: string | null
          created_at: string
          created_by: string | null
          file_name: string | null
          file_path: string | null
          id: string
          kind: string
          meeting_id: string
          mime_type: string | null
          url: string | null
        }
        Insert: {
          agenda_item_id?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind: string
          meeting_id: string
          mime_type?: string | null
          url?: string | null
        }
        Update: {
          agenda_item_id?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          meeting_id?: string
          mime_type?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_meeting_attachments_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "research_meeting_agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_meeting_attachments_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "research_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      research_meetings: {
        Row: {
          action_items: Json
          agenda: string | null
          ata: string | null
          audio_path: string | null
          created_at: string
          created_by: string
          duration_minutes: number
          id: string
          meeting_link: string | null
          notes: string | null
          parent_meeting_id: string | null
          participants: Json
          project_id: string
          recurrence_freq: string
          recurrence_interval: number
          recurrence_until: string | null
          recurrence_weekdays: number[]
          reminder_sent_at: string | null
          scheduled_at: string
          title: string
          transcript: string | null
          updated_at: string
        }
        Insert: {
          action_items?: Json
          agenda?: string | null
          ata?: string | null
          audio_path?: string | null
          created_at?: string
          created_by: string
          duration_minutes?: number
          id?: string
          meeting_link?: string | null
          notes?: string | null
          parent_meeting_id?: string | null
          participants?: Json
          project_id: string
          recurrence_freq?: string
          recurrence_interval?: number
          recurrence_until?: string | null
          recurrence_weekdays?: number[]
          reminder_sent_at?: string | null
          scheduled_at: string
          title: string
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          action_items?: Json
          agenda?: string | null
          ata?: string | null
          audio_path?: string | null
          created_at?: string
          created_by?: string
          duration_minutes?: number
          id?: string
          meeting_link?: string | null
          notes?: string | null
          parent_meeting_id?: string | null
          participants?: Json
          project_id?: string
          recurrence_freq?: string
          recurrence_interval?: number
          recurrence_until?: string | null
          recurrence_weekdays?: number[]
          reminder_sent_at?: string | null
          scheduled_at?: string
          title?: string
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_meetings_parent_meeting_id_fkey"
            columns: ["parent_meeting_id"]
            isOneToOne: false
            referencedRelation: "research_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_milestone_evaluations: {
        Row: {
          advisee_id: string | null
          comments: string | null
          created_at: string
          evaluated_at: string
          evaluatee_id: string | null
          evaluator_id: string
          id: string
          project_id: string
          schedule_item_id: string | null
          score: number | null
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          advisee_id?: string | null
          comments?: string | null
          created_at?: string
          evaluated_at?: string
          evaluatee_id?: string | null
          evaluator_id: string
          id?: string
          project_id: string
          schedule_item_id?: string | null
          score?: number | null
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          advisee_id?: string | null
          comments?: string | null
          created_at?: string
          evaluated_at?: string
          evaluatee_id?: string | null
          evaluator_id?: string
          id?: string
          project_id?: string
          schedule_item_id?: string | null
          score?: number | null
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_milestone_evaluations_advisee_id_fkey"
            columns: ["advisee_id"]
            isOneToOne: false
            referencedRelation: "research_advisees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_milestone_evaluations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_milestone_evaluations_schedule_item_id_fkey"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "research_schedule_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_milestone_evaluations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "research_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      research_notification_prefs: {
        Row: {
          created_at: string
          digest_frequency: string
          email_digest: boolean
          id: string
          notify_comments: boolean
          notify_meetings: boolean
          notify_mentions: boolean
          notify_risks: boolean
          notify_tasks: boolean
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_frequency?: string
          email_digest?: boolean
          id?: string
          notify_comments?: boolean
          notify_meetings?: boolean
          notify_mentions?: boolean
          notify_risks?: boolean
          notify_tasks?: boolean
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_frequency?: string
          email_digest?: boolean
          id?: string
          notify_comments?: boolean
          notify_meetings?: boolean
          notify_mentions?: boolean
          notify_risks?: boolean
          notify_tasks?: boolean
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_notification_prefs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_notifications: {
        Row: {
          body: string | null
          created_at: string
          digest_sent: boolean
          id: string
          link: string | null
          project_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          digest_sent?: boolean
          id?: string
          link?: string | null
          project_id?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          digest_sent?: boolean
          id?: string
          link?: string | null
          project_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_outputs: {
        Row: {
          authors: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          doi: string | null
          id: string
          is_public: boolean
          license: string | null
          metrics: Json | null
          project_id: string
          release_date: string | null
          repository: string | null
          tags: string[] | null
          title: string
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          authors?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          doi?: string | null
          id?: string
          is_public?: boolean
          license?: string | null
          metrics?: Json | null
          project_id: string
          release_date?: string | null
          repository?: string | null
          tags?: string[] | null
          title: string
          type?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          authors?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          doi?: string | null
          id?: string
          is_public?: boolean
          license?: string | null
          metrics?: Json | null
          project_id?: string
          release_date?: string | null
          repository?: string | null
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_outputs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_overview_versions: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          project_id: string
          summary: string | null
        }
        Insert: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          project_id: string
          summary?: string | null
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_overview_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_project_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          metadata: Json
          project_id: string
          resource_id: string | null
          resource_type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          metadata?: Json
          project_id: string
          resource_id?: string | null
          resource_type: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          metadata?: Json
          project_id?: string
          resource_id?: string | null
          resource_type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_project_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_project_members: {
        Row: {
          accepted: boolean
          created_at: string
          full_name: string | null
          id: string
          invited_email: string | null
          project_id: string
          role: Database["public"]["Enums"]["research_member_role"]
          user_id: string | null
        }
        Insert: {
          accepted?: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          invited_email?: string | null
          project_id: string
          role?: Database["public"]["Enums"]["research_member_role"]
          user_id?: string | null
        }
        Update: {
          accepted?: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          invited_email?: string | null
          project_id?: string
          role?: Database["public"]["Enums"]["research_member_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_project_references: {
        Row: {
          added_by: string
          authors: Json
          created_at: string
          doi: string | null
          external_paper_id: string | null
          id: string
          notes: string | null
          paper_db_id: string | null
          project_id: string
          title: string
          year: number | null
        }
        Insert: {
          added_by: string
          authors?: Json
          created_at?: string
          doi?: string | null
          external_paper_id?: string | null
          id?: string
          notes?: string | null
          paper_db_id?: string | null
          project_id: string
          title: string
          year?: number | null
        }
        Update: {
          added_by?: string
          authors?: Json
          created_at?: string
          doi?: string | null
          external_paper_id?: string | null
          id?: string
          notes?: string | null
          paper_db_id?: string | null
          project_id?: string
          title?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "research_project_references_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_projects: {
        Row: {
          cnpq_area: string | null
          created_at: string
          description: string | null
          end_date: string | null
          folha_rosto_url: string | null
          full_content: string | null
          funder_template: string | null
          funding_call_id: string | null
          id: string
          is_public: boolean
          keywords: string[]
          objectives: string | null
          owner_id: string | null
          plataforma_brasil_caae: string | null
          plataforma_brasil_url: string | null
          public_slug: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["research_project_status"]
          termo_sigilo_url: string | null
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          cnpq_area?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          folha_rosto_url?: string | null
          full_content?: string | null
          funder_template?: string | null
          funding_call_id?: string | null
          id?: string
          is_public?: boolean
          keywords?: string[]
          objectives?: string | null
          owner_id?: string | null
          plataforma_brasil_caae?: string | null
          plataforma_brasil_url?: string | null
          public_slug?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["research_project_status"]
          termo_sigilo_url?: string | null
          title: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          cnpq_area?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          folha_rosto_url?: string | null
          full_content?: string | null
          funder_template?: string | null
          funding_call_id?: string | null
          id?: string
          is_public?: boolean
          keywords?: string[]
          objectives?: string | null
          owner_id?: string | null
          plataforma_brasil_caae?: string | null
          plataforma_brasil_url?: string | null
          public_slug?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["research_project_status"]
          termo_sigilo_url?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_projects_funding_call_id_fkey"
            columns: ["funding_call_id"]
            isOneToOne: false
            referencedRelation: "funding_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      research_publication_authors: {
        Row: {
          affiliation: string | null
          author_order: number
          credit_roles: string[]
          email: string | null
          full_name: string
          id: string
          is_corresponding: boolean
          publication_id: string
          user_id: string | null
        }
        Insert: {
          affiliation?: string | null
          author_order?: number
          credit_roles?: string[]
          email?: string | null
          full_name: string
          id?: string
          is_corresponding?: boolean
          publication_id: string
          user_id?: string | null
        }
        Update: {
          affiliation?: string | null
          author_order?: number
          credit_roles?: string[]
          email?: string | null
          full_name?: string
          id?: string
          is_corresponding?: boolean
          publication_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_publication_authors_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "research_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      research_publications: {
        Row: {
          abstract: string | null
          acceptance_date: string | null
          altmetric_score: number | null
          altmetric_url: string | null
          authors: string[] | null
          citations_count: number | null
          created_at: string
          created_by: string
          doi: string | null
          enriched_at: string | null
          id: string
          notes: string | null
          openalex_id: string | null
          orcid_put_code: string | null
          position: number
          project_id: string
          publication_date: string | null
          status: Database["public"]["Enums"]["research_publication_status"]
          submission_date: string | null
          target_journal: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          abstract?: string | null
          acceptance_date?: string | null
          altmetric_score?: number | null
          altmetric_url?: string | null
          authors?: string[] | null
          citations_count?: number | null
          created_at?: string
          created_by: string
          doi?: string | null
          enriched_at?: string | null
          id?: string
          notes?: string | null
          openalex_id?: string | null
          orcid_put_code?: string | null
          position?: number
          project_id: string
          publication_date?: string | null
          status?: Database["public"]["Enums"]["research_publication_status"]
          submission_date?: string | null
          target_journal?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          abstract?: string | null
          acceptance_date?: string | null
          altmetric_score?: number | null
          altmetric_url?: string | null
          authors?: string[] | null
          citations_count?: number | null
          created_at?: string
          created_by?: string
          doi?: string | null
          enriched_at?: string | null
          id?: string
          notes?: string | null
          openalex_id?: string | null
          orcid_put_code?: string | null
          position?: number
          project_id?: string
          publication_date?: string | null
          status?: Database["public"]["Enums"]["research_publication_status"]
          submission_date?: string | null
          target_journal?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_publications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_risk_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          message: string | null
          project_id: string
          related_entity_id: string | null
          related_entity_type: string | null
          resolved: boolean
          resolved_at: string | null
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          message?: string | null
          project_id: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string | null
          project_id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_risk_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_schedule_items: {
        Row: {
          assignee_id: string | null
          color: string | null
          created_at: string
          created_by: string | null
          dependency_type: string
          description: string | null
          end_date: string | null
          id: string
          is_milestone: boolean
          linked_meeting_id: string | null
          notes: string | null
          phase: string | null
          position: number
          predecessor_id: string | null
          progress: number
          progress_mode: string
          project_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["research_schedule_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          dependency_type?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_milestone?: boolean
          linked_meeting_id?: string | null
          notes?: string | null
          phase?: string | null
          position?: number
          predecessor_id?: string | null
          progress?: number
          progress_mode?: string
          project_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["research_schedule_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          dependency_type?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_milestone?: boolean
          linked_meeting_id?: string | null
          notes?: string | null
          phase?: string | null
          position?: number
          predecessor_id?: string | null
          progress?: number
          progress_mode?: string
          project_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["research_schedule_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_schedule_items_linked_meeting_id_fkey"
            columns: ["linked_meeting_id"]
            isOneToOne: false
            referencedRelation: "research_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_schedule_items_predecessor_id_fkey"
            columns: ["predecessor_id"]
            isOneToOne: false
            referencedRelation: "research_schedule_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_schedule_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_tasks: {
        Row: {
          assignee_id: string | null
          checklist: Json
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          parent_task_id: string | null
          position: number
          priority: Database["public"]["Enums"]["research_task_priority"]
          project_id: string
          schedule_item_id: string | null
          source_meeting_id: string | null
          status: Database["public"]["Enums"]["research_task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          checklist?: Json
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["research_task_priority"]
          project_id: string
          schedule_item_id?: string | null
          source_meeting_id?: string | null
          status?: Database["public"]["Enums"]["research_task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          checklist?: Json
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["research_task_priority"]
          project_id?: string
          schedule_item_id?: string | null
          source_meeting_id?: string | null
          status?: Database["public"]["Enums"]["research_task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "research_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_tasks_schedule_item_id_fkey"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "research_schedule_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_tasks_source_meeting_id_fkey"
            columns: ["source_meeting_id"]
            isOneToOne: false
            referencedRelation: "research_meetings"
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
          research_project_id: string | null
          user_id: string
        }
        Insert: {
          column_data?: Json
          columns?: Json
          created_at?: string
          id?: string
          papers?: Json
          query: string
          research_project_id?: string | null
          user_id: string
        }
        Update: {
          column_data?: Json
          columns?: Json
          created_at?: string
          id?: string
          papers?: Json
          query?: string
          research_project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_research_project_id_fkey"
            columns: ["research_project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
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
          research_project_id: string | null
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
          research_project_id?: string | null
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
          research_project_id?: string | null
          settings?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_research_project_id_fkey"
            columns: ["research_project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
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
          research_project_id: string | null
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
          research_project_id?: string | null
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
          research_project_id?: string | null
          research_question?: string
          screening_criteria?: Json
          screening_results?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "systematic_reviews_research_project_id_fkey"
            columns: ["research_project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
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
      writing_documents: {
        Row: {
          citation_style: string | null
          content: string
          created_at: string
          id: string
          metadata: Json | null
          research_project_id: string | null
          section: string | null
          selected_paper_ids: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          citation_style?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          research_project_id?: string | null
          section?: string | null
          selected_paper_ids?: Json | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          citation_style?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          research_project_id?: string | null
          section?: string | null
          selected_paper_ids?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "writing_documents_research_project_id_fkey"
            columns: ["research_project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_research_project: {
        Args: {
          _cnpq_area?: string
          _description?: string
          _end_date?: string
          _keywords?: string[]
          _objectives?: string
          _start_date?: string
          _status?: Database["public"]["Enums"]["research_project_status"]
          _title: string
        }
        Returns: {
          cnpq_area: string | null
          created_at: string
          description: string | null
          end_date: string | null
          folha_rosto_url: string | null
          full_content: string | null
          funder_template: string | null
          funding_call_id: string | null
          id: string
          is_public: boolean
          keywords: string[]
          objectives: string | null
          owner_id: string | null
          plataforma_brasil_caae: string | null
          plataforma_brasil_url: string | null
          public_slug: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["research_project_status"]
          termo_sigilo_url: string | null
          title: string
          updated_at: string
          workspace_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "research_projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      get_distribution_by_token: {
        Args: { _token: string }
        Returns: {
          anonymous_token: string
          id: string
          survey_id: string
          type: string
        }[]
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
      is_research_project_manager: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_research_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_survey_owner: {
        Args: { _survey_id: string; _user_id: string }
        Returns: boolean
      }
      is_survey_team_member: {
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
      match_project_paper_chunks: {
        Args: {
          _project_id: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_text: string
          paper_id: string
          paper_title: string
          similarity: number
          source: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      research_advisee_level:
        | "ic"
        | "mestrado"
        | "doutorado"
        | "posdoc"
        | "tcc"
        | "especializacao"
      research_member_role:
        | "pi"
        | "co_pi"
        | "orientando_ic"
        | "orientando_mestrado"
        | "orientando_doutorado"
        | "posdoc"
        | "colaborador"
      research_milestone_status: "pending" | "done" | "overdue"
      research_project_status:
        | "planejamento"
        | "em_andamento"
        | "pausado"
        | "concluido"
        | "arquivado"
        | "cancelado"
      research_publication_status:
        | "ideia"
        | "escrevendo"
        | "submetido"
        | "em_revisao"
        | "aceito"
        | "publicado"
        | "rejeitado"
      research_schedule_status:
        | "planejado"
        | "em_andamento"
        | "concluido"
        | "atrasado"
      research_task_priority: "low" | "medium" | "high" | "urgent"
      research_task_status: "backlog" | "doing" | "review" | "done"
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
      research_advisee_level: [
        "ic",
        "mestrado",
        "doutorado",
        "posdoc",
        "tcc",
        "especializacao",
      ],
      research_member_role: [
        "pi",
        "co_pi",
        "orientando_ic",
        "orientando_mestrado",
        "orientando_doutorado",
        "posdoc",
        "colaborador",
      ],
      research_milestone_status: ["pending", "done", "overdue"],
      research_project_status: [
        "planejamento",
        "em_andamento",
        "pausado",
        "concluido",
        "arquivado",
        "cancelado",
      ],
      research_publication_status: [
        "ideia",
        "escrevendo",
        "submetido",
        "em_revisao",
        "aceito",
        "publicado",
        "rejeitado",
      ],
      research_schedule_status: [
        "planejado",
        "em_andamento",
        "concluido",
        "atrasado",
      ],
      research_task_priority: ["low", "medium", "high", "urgent"],
      research_task_status: ["backlog", "doing", "review", "done"],
      workspace_role: ["owner", "advisor", "coauthor", "reviewer"],
    },
  },
} as const
