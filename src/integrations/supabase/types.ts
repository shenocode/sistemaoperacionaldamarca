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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          actor_id: string | null
          client_id: string | null
          content_id: string | null
          created_at: string
          i18n: Json
          id: string
          project_id: string | null
          summary: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          actor_id?: string | null
          client_id?: string | null
          content_id?: string | null
          created_at?: string
          i18n?: Json
          id?: string
          project_id?: string | null
          summary: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          actor_id?: string | null
          client_id?: string | null
          content_id?: string | null
          created_at?: string
          i18n?: Json
          id?: string
          project_id?: string | null
          summary?: string
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_ai_credentials: {
        Row: {
          claude_key_ciphertext: string | null
          claude_key_last4: string | null
          created_at: string
          gemini_key_ciphertext: string | null
          gemini_key_last4: string | null
          openai_key_ciphertext: string | null
          openai_key_last4: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          claude_key_ciphertext?: string | null
          claude_key_last4?: string | null
          created_at?: string
          gemini_key_ciphertext?: string | null
          gemini_key_last4?: string | null
          openai_key_ciphertext?: string | null
          openai_key_last4?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          claude_key_ciphertext?: string | null
          claude_key_last4?: string | null
          created_at?: string
          gemini_key_ciphertext?: string | null
          gemini_key_last4?: string | null
          openai_key_ciphertext?: string | null
          openai_key_last4?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_daily: {
        Row: {
          platform_units: number
          usage_date: string
          user_id: string
        }
        Insert: {
          platform_units?: number
          usage_date?: string
          user_id: string
        }
        Update: {
          platform_units?: number
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      brand_briefings: {
        Row: {
          answers: Json
          client_id: string
          completed_at: string | null
          created_at: string
          guide: Json | null
          guide_markdown: string | null
          i18n: Json
          id: string
          status: Database["public"]["Enums"]["brand_briefing_status"]
          template: Json
          updated_at: string
        }
        Insert: {
          answers?: Json
          client_id: string
          completed_at?: string | null
          created_at?: string
          guide?: Json | null
          guide_markdown?: string | null
          i18n?: Json
          id?: string
          status?: Database["public"]["Enums"]["brand_briefing_status"]
          template?: Json
          updated_at?: string
        }
        Update: {
          answers?: Json
          client_id?: string
          completed_at?: string | null
          created_at?: string
          guide?: Json | null
          guide_markdown?: string | null
          i18n?: Json
          id?: string
          status?: Database["public"]["Enums"]["brand_briefing_status"]
          template?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_briefings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_reference_creators: {
        Row: {
          client_id: string
          created_at: string
          id: string
          name: string
          notes: string
          pattern_summary: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          name?: string
          notes?: string
          pattern_summary?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string
          pattern_summary?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_reference_creators_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_blocks: {
        Row: {
          content_mix: Json
          created_at: string
          i18n: Json
          id: string
          project_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content_mix?: Json
          created_at?: string
          i18n?: Json
          id?: string
          project_id: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Update: {
          content_mix?: Json
          created_at?: string
          i18n?: Json
          id?: string
          project_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_blocks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_members: {
        Row: {
          client_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["client_member_role"]
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["client_member_role"]
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["client_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          access_token: string
          brand_colors: Json
          brand_fonts: Json
          brand_guidance: string | null
          created_at: string
          created_by: string | null
          email: string | null
          i18n: Json
          id: string
          instagram: string | null
          logo_url: string | null
          monthly_fee: number | null
          name: string
          notes: string | null
          payment_day: number | null
          phone: string | null
          pix_holder: string | null
          pix_key: string | null
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          access_token?: string
          brand_colors?: Json
          brand_fonts?: Json
          brand_guidance?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          i18n?: Json
          id?: string
          instagram?: string | null
          logo_url?: string | null
          monthly_fee?: number | null
          name: string
          notes?: string | null
          payment_day?: number | null
          phone?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          access_token?: string
          brand_colors?: Json
          brand_fonts?: Json
          brand_guidance?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          i18n?: Json
          id?: string
          instagram?: string | null
          logo_url?: string | null
          monthly_fee?: number | null
          name?: string
          notes?: string | null
          payment_day?: number | null
          phone?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      commercial_proposals: {
        Row: {
          client_id: string
          commercial_terms: Json
          cover_image_url: string | null
          created_at: string
          created_by: string
          id: string
          investment_items: Json
          proposal_month: string
          scope_summary: string
          sections: Json
          status: Database["public"]["Enums"]["commercial_proposal_status"]
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          commercial_terms?: Json
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          id?: string
          investment_items?: Json
          proposal_month?: string
          scope_summary?: string
          sections?: Json
          status?: Database["public"]["Enums"]["commercial_proposal_status"]
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          commercial_terms?: Json
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          id?: string
          investment_items?: Json
          proposal_month?: string
          scope_summary?: string
          sections?: Json
          status?: Database["public"]["Enums"]["commercial_proposal_status"]
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_leads: {
        Row: {
          created_at: string
          email: string
          id: string
          intent: Database["public"]["Enums"]["contact_lead_intent"]
          locale: string | null
          name: string
          niche: Database["public"]["Enums"]["contact_lead_niche"]
          source: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          intent: Database["public"]["Enums"]["contact_lead_intent"]
          locale?: string | null
          name: string
          niche?: Database["public"]["Enums"]["contact_lead_niche"]
          source?: string
          whatsapp: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          intent?: Database["public"]["Enums"]["contact_lead_intent"]
          locale?: string | null
          name?: string
          niche?: Database["public"]["Enums"]["contact_lead_niche"]
          source?: string
          whatsapp?: string
        }
        Relationships: []
      }
      content_comments: {
        Row: {
          audio_storage_path: string | null
          audio_url: string | null
          body: string
          content_id: string
          created_at: string
          i18n: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_storage_path?: string | null
          audio_url?: string | null
          body?: string
          content_id: string
          created_at?: string
          i18n?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_storage_path?: string | null
          audio_url?: string | null
          body?: string
          content_id?: string
          created_at?: string
          i18n?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_comments_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          archived_at: string | null
          calendar_block_id: string | null
          caption: string
          created_at: string
          created_by: string | null
          cta: string
          current_version: number
          format: Database["public"]["Enums"]["content_format"]
          funnel_stage: string | null
          hashtags: string
          height_cm: number | null
          i18n: Json
          id: string
          locucao: string
          material_type: string | null
          media_overlays: Json
          media_url: string | null
          media_urls: string[]
          performance_note: string
          performance_reach: string
          performance_retention: string
          production_notes: string
          project_id: string
          repeat_format: boolean
          roteiro: string
          scheduled_at: string | null
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          theme: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          width_cm: number | null
        }
        Insert: {
          archived_at?: string | null
          calendar_block_id?: string | null
          caption?: string
          created_at?: string
          created_by?: string | null
          cta?: string
          current_version?: number
          format?: Database["public"]["Enums"]["content_format"]
          funnel_stage?: string | null
          hashtags?: string
          height_cm?: number | null
          i18n?: Json
          id?: string
          locucao?: string
          material_type?: string | null
          media_overlays?: Json
          media_url?: string | null
          media_urls?: string[]
          performance_note?: string
          performance_reach?: string
          performance_retention?: string
          production_notes?: string
          project_id: string
          repeat_format?: boolean
          roteiro?: string
          scheduled_at?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          theme?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          width_cm?: number | null
        }
        Update: {
          archived_at?: string | null
          calendar_block_id?: string | null
          caption?: string
          created_at?: string
          created_by?: string | null
          cta?: string
          current_version?: number
          format?: Database["public"]["Enums"]["content_format"]
          funnel_stage?: string | null
          hashtags?: string
          height_cm?: number | null
          i18n?: Json
          id?: string
          locucao?: string
          material_type?: string | null
          media_overlays?: Json
          media_url?: string | null
          media_urls?: string[]
          performance_note?: string
          performance_reach?: string
          performance_retention?: string
          production_notes?: string
          project_id?: string
          repeat_format?: boolean
          roteiro?: string
          scheduled_at?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          theme?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_items_calendar_block_id_fkey"
            columns: ["calendar_block_id"]
            isOneToOne: false
            referencedRelation: "calendar_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_versions: {
        Row: {
          caption: string
          change_note: string | null
          content_id: string
          created_at: string
          created_by: string | null
          cta: string
          format: Database["public"]["Enums"]["content_format"]
          hashtags: string
          height_cm: number | null
          i18n: Json
          id: string
          locucao: string
          material_type: string | null
          media_url: string | null
          media_urls: string[]
          production_notes: string
          roteiro: string
          thumbnail_url: string | null
          version_number: number
          width_cm: number | null
        }
        Insert: {
          caption?: string
          change_note?: string | null
          content_id: string
          created_at?: string
          created_by?: string | null
          cta?: string
          format?: Database["public"]["Enums"]["content_format"]
          hashtags?: string
          height_cm?: number | null
          i18n?: Json
          id?: string
          locucao?: string
          material_type?: string | null
          media_url?: string | null
          media_urls?: string[]
          production_notes?: string
          roteiro?: string
          thumbnail_url?: string | null
          version_number: number
          width_cm?: number | null
        }
        Update: {
          caption?: string
          change_note?: string | null
          content_id?: string
          created_at?: string
          created_by?: string | null
          cta?: string
          format?: Database["public"]["Enums"]["content_format"]
          hashtags?: string
          height_cm?: number | null
          i18n?: Json
          id?: string
          locucao?: string
          material_type?: string | null
          media_url?: string | null
          media_urls?: string[]
          production_notes?: string
          roteiro?: string
          thumbnail_url?: string | null
          version_number?: number
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_versions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      design_templates: {
        Row: {
          aspect_ratio: string
          client_id: string
          created_at: string
          created_by: string | null
          file_size: number | null
          file_url: string
          format: Database["public"]["Enums"]["design_template_format"]
          id: string
          mime_type: string | null
          name: string
          storage_path: string | null
        }
        Insert: {
          aspect_ratio?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          file_url: string
          format: Database["public"]["Enums"]["design_template_format"]
          id?: string
          mime_type?: string | null
          name: string
          storage_path?: string | null
        }
        Update: {
          aspect_ratio?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          file_url?: string
          format?: Database["public"]["Enums"]["design_template_format"]
          id?: string
          mime_type?: string | null
          name?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "design_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_rate_limits: {
        Row: {
          hit_count: number
          rate_key: string
          window_started_at: string
        }
        Insert: {
          hit_count?: number
          rate_key: string
          window_started_at?: string
        }
        Update: {
          hit_count?: number
          rate_key?: string
          window_started_at?: string
        }
        Relationships: []
      }
      help_requests: {
        Row: {
          attachment_file_name: string | null
          attachment_mime_type: string | null
          attachment_storage_path: string | null
          client_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["help_request_kind"]
          locale: string | null
          message: string
          recipient_user_id: string
          sender_email: string
          sender_user_id: string
        }
        Insert: {
          attachment_file_name?: string | null
          attachment_mime_type?: string | null
          attachment_storage_path?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["help_request_kind"]
          locale?: string | null
          message: string
          recipient_user_id: string
          sender_email: string
          sender_user_id: string
        }
        Update: {
          attachment_file_name?: string | null
          attachment_mime_type?: string | null
          attachment_storage_path?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["help_request_kind"]
          locale?: string | null
          message?: string
          recipient_user_id?: string
          sender_email?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      library_assets: {
        Row: {
          category: Database["public"]["Enums"]["library_category"]
          client_id: string
          created_at: string
          created_by: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          i18n: Json
          id: string
          mime_type: string | null
          name: string
          notes: string | null
          storage_path: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["library_category"]
          client_id: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          i18n?: Json
          id?: string
          mime_type?: string | null
          name: string
          notes?: string | null
          storage_path?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["library_category"]
          client_id?: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          i18n?: Json
          id?: string
          mime_type?: string | null
          name?: string
          notes?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_agendas: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          project_id: string
          scheduled_at: string | null
          topics: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          project_id: string
          scheduled_at?: string | null
          topics?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string
          scheduled_at?: string | null
          topics?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agendas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string
          full_name: string | null
          i18n: Json
          id: string
          locale: string
          logo_url: string | null
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          i18n?: Json
          id: string
          locale?: string
          logo_url?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          i18n?: Json
          id?: string
          locale?: string
          logo_url?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      project_site: {
        Row: {
          briefing_answers: Json
          briefing_status: string
          briefing_template: Json
          created_at: string
          manager_notes: string | null
          prd_generated_at: string | null
          prd_markdown: string | null
          project_id: string
          prototype_change_requests: string | null
          prototype_notes: string | null
          prototype_status: string
          prototype_url: string | null
          schedule: Json
          updated_at: string
        }
        Insert: {
          briefing_answers?: Json
          briefing_status?: string
          briefing_template?: Json
          created_at?: string
          manager_notes?: string | null
          prd_generated_at?: string | null
          prd_markdown?: string | null
          project_id: string
          prototype_change_requests?: string | null
          prototype_notes?: string | null
          prototype_status?: string
          prototype_url?: string | null
          schedule?: Json
          updated_at?: string
        }
        Update: {
          briefing_answers?: Json
          briefing_status?: string
          briefing_template?: Json
          created_at?: string
          manager_notes?: string | null
          prd_generated_at?: string | null
          prd_markdown?: string | null
          project_id?: string
          prototype_change_requests?: string | null
          prototype_notes?: string | null
          prototype_status?: string
          prototype_url?: string | null
          schedule?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_site_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          categories: string[]
          client_id: string
          created_at: string
          created_by: string | null
          cta_presets: string[]
          description: string | null
          hashtag_presets: string[]
          i18n: Json
          id: string
          name: string
          status: string
          theme_presets: string[]
          updated_at: string
        }
        Insert: {
          categories?: string[]
          client_id: string
          created_at?: string
          created_by?: string | null
          cta_presets?: string[]
          description?: string | null
          hashtag_presets?: string[]
          i18n?: Json
          id?: string
          name: string
          status?: string
          theme_presets?: string[]
          updated_at?: string
        }
        Update: {
          categories?: string[]
          client_id?: string
          created_at?: string
          created_by?: string | null
          cta_presets?: string[]
          description?: string | null
          hashtag_presets?: string[]
          i18n?: Json
          id?: string
          name?: string
          status?: string
          theme_presets?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          event_type: string
          id: string
          processed_at: string
        }
        Insert: {
          event_type: string
          id: string
          processed_at?: string
        }
        Update: {
          event_type?: string
          id?: string
          processed_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          email: string
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          source: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          email: string
          id?: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          source?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          email?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          source?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      team_memberships: {
        Row: {
          created_at: string
          id: string
          member_user_id: string
          owner_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_user_id: string
          owner_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_user_id?: string
          owner_user_id?: string
        }
        Relationships: []
      }
      theme_references: {
        Row: {
          created_at: string
          id: string
          links: string[]
          project_id: string
          recommendations: string
          sort_order: number
          theme: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          links?: string[]
          project_id: string
          recommendations?: string
          sort_order?: number
          theme?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          links?: string[]
          project_id?: string
          recommendations?: string
          sort_order?: number
          theme?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "theme_references_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      active_subscription_plan: {
        Args: { _user_id?: string }
        Returns: Database["public"]["Enums"]["subscription_plan"]
      }
      auth_user_id_by_email: { Args: { _email: string }; Returns: string }
      can_access_client: { Args: { _client_id: string }; Returns: boolean }
      can_access_commercial_proposal: {
        Args: { _proposal_id: string }
        Returns: boolean
      }
      can_access_content: { Args: { _content_id: string }; Returns: boolean }
      can_access_library_storage: {
        Args: { object_name: string }
        Returns: boolean
      }
      can_access_project: { Args: { _project_id: string }; Returns: boolean }
      can_manage_client: { Args: { _client_id: string }; Returns: boolean }
      can_manage_content: { Args: { _content_id: string }; Returns: boolean }
      can_manage_library_storage: {
        Args: { object_name: string }
        Returns: boolean
      }
      can_manage_project: { Args: { _project_id: string }; Returns: boolean }
      claim_client_access: { Args: { _access_token: string }; Returns: string }
      client_logo_storage_client_id: {
        Args: { object_name: string }
        Returns: string
      }
      comment_audio_project_id: {
        Args: { object_name: string }
        Returns: string
      }
      comment_audio_user_id: { Args: { object_name: string }; Returns: string }
      consume_edge_rate_limit: {
        Args: { _key: string; _max_hits: number; _window_seconds: number }
        Returns: boolean
      }
      content_storage_project_id: {
        Args: { object_name: string }
        Returns: string
      }
      gestor_logo_storage_user_id: {
        Args: { object_name: string }
        Returns: string
      }
      get_client_gestor_contact: { Args: { _client_id: string }; Returns: Json }
      get_client_platform_login: {
        Args: { _client_id: string }
        Returns: string
      }
      get_share_preview: {
        Args: { _access_token: string; _client_id: string; _project_id: string }
        Returns: {
          client_id: string
          client_name: string
          logo_url: string
          project_id: string
          project_name: string
        }[]
      }
      get_team_owner_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_master: { Args: never; Returns: boolean }
      is_client_member: { Args: { _client_id: string }; Returns: boolean }
      is_client_owner: { Args: { _client_id: string }; Returns: boolean }
      is_team_owner: { Args: never; Returns: boolean }
      latest_client_updates: {
        Args: { _client_ids: string[] }
        Returns: {
          client_id: string
          created_at: string
        }[]
      }
      library_storage_project_id: {
        Args: { object_name: string }
        Returns: string
      }
      library_storage_scope_id: {
        Args: { object_name: string }
        Returns: string
      }
      plan_max_clients: {
        Args: { _plan: Database["public"]["Enums"]["subscription_plan"] }
        Returns: number
      }
      plan_max_users: {
        Args: { _plan: Database["public"]["Enums"]["subscription_plan"] }
        Returns: number
      }
      proposal_cover_storage_user_id: {
        Args: { object_name: string }
        Returns: string
      }
      save_client_content_version: {
        Args: {
          _caption?: string
          _change_note?: string
          _content_id: string
          _cta?: string
          _format?: Database["public"]["Enums"]["content_format"]
          _hashtags?: string
          _locucao?: string
          _roteiro?: string
          _theme?: string
          _title?: string
        }
        Returns: {
          calendar_block_id: string | null
          caption: string
          created_at: string
          created_by: string | null
          cta: string
          current_version: number
          format: Database["public"]["Enums"]["content_format"]
          funnel_stage: string | null
          hashtags: string
          height_cm: number | null
          i18n: Json
          id: string
          locucao: string
          material_type: string | null
          media_overlays: Json
          media_url: string | null
          media_urls: string[]
          performance_note: string
          performance_reach: string
          performance_retention: string
          production_notes: string
          project_id: string
          repeat_format: boolean
          roteiro: string
          scheduled_at: string | null
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          theme: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          width_cm: number | null
        }
        SetofOptions: {
          from: "*"
          to: "content_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_gestor_content_version: {
        Args: { _change_note?: string; _content_id: string; _patch: Json }
        Returns: {
          calendar_block_id: string | null
          caption: string
          created_at: string
          created_by: string | null
          cta: string
          current_version: number
          format: Database["public"]["Enums"]["content_format"]
          funnel_stage: string | null
          hashtags: string
          height_cm: number | null
          i18n: Json
          id: string
          locucao: string
          material_type: string | null
          media_overlays: Json
          media_url: string | null
          media_urls: string[]
          performance_note: string
          performance_reach: string
          performance_retention: string
          production_notes: string
          project_id: string
          repeat_format: boolean
          roteiro: string
          scheduled_at: string | null
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          theme: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          width_cm: number | null
        }
        SetofOptions: {
          from: "*"
          to: "content_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      subscription_grants_access: {
        Args: { _period_end: string; _status: string }
        Returns: boolean
      }
      try_consume_platform_ai_quota: {
        Args: { _daily_max?: number; _units?: number; _user_id: string }
        Returns: boolean
      }
      update_client_contact: {
        Args: {
          _brand_colors?: Json
          _brand_fonts?: Json
          _brand_guidance?: string
          _client_id: string
          _email?: string
          _instagram?: string
          _logo_url?: string
          _name: string
          _notes?: string
          _phone?: string
          _website?: string
          _whatsapp?: string
        }
        Returns: {
          access_token: string
          brand_colors: Json
          brand_fonts: Json
          brand_guidance: string | null
          created_at: string
          created_by: string | null
          email: string | null
          i18n: Json
          id: string
          instagram: string | null
          logo_url: string | null
          monthly_fee: number | null
          name: string
          notes: string | null
          payment_day: number | null
          phone: string | null
          pix_holder: string | null
          pix_key: string | null
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        SetofOptions: {
          from: "*"
          to: "clients"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      activity_type:
        | "client_created"
        | "project_created"
        | "content_created"
        | "content_updated"
        | "version_created"
        | "submitted_for_review"
        | "approved"
        | "changes_requested"
        | "published"
        | "comment_added"
        | "meeting_agenda_created"
        | "meeting_agenda_updated"
        | "meeting_agenda_deleted"
      app_role: "admin" | "client"
      brand_briefing_status: "draft" | "in_progress" | "completed"
      client_member_role: "owner" | "member"
      commercial_proposal_status: "draft" | "ready"
      contact_lead_intent: "trial" | "human"
      contact_lead_niche: "agency" | "social_media" | "brand_owner"
      content_format:
        | "static_feed"
        | "reels"
        | "stories"
        | "carousel"
        | "recorded_video"
        | "youtube_short"
        | "print_material"
      content_status:
        | "draft"
        | "review"
        | "approved"
        | "changes"
        | "published"
        | "waiting_material"
        | "changes_done"
      design_template_format:
        | "static_feed"
        | "carousel"
        | "stories"
        | "reels"
        | "recorded_video"
        | "youtube_short"
        | "print_material"
      help_request_kind: "gestor_platform" | "client_gestor"
      library_category:
        | "brand"
        | "pdfs"
        | "images"
        | "videos"
        | "references"
        | "documents"
        | "spreadsheets"
        | "generated_arts"
      subscription_plan: "solo" | "studio" | "agency" | "courtesy"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      activity_type: [
        "client_created",
        "project_created",
        "content_created",
        "content_updated",
        "version_created",
        "submitted_for_review",
        "approved",
        "changes_requested",
        "published",
        "comment_added",
        "meeting_agenda_created",
        "meeting_agenda_updated",
        "meeting_agenda_deleted",
      ],
      app_role: ["admin", "client"],
      brand_briefing_status: ["draft", "in_progress", "completed"],
      client_member_role: ["owner", "member"],
      commercial_proposal_status: ["draft", "ready"],
      contact_lead_intent: ["trial", "human"],
      contact_lead_niche: ["agency", "social_media", "brand_owner"],
      content_format: [
        "static_feed",
        "reels",
        "stories",
        "carousel",
        "recorded_video",
        "youtube_short",
        "print_material",
      ],
      content_status: [
        "draft",
        "review",
        "approved",
        "changes",
        "published",
        "waiting_material",
        "changes_done",
      ],
      design_template_format: [
        "static_feed",
        "carousel",
        "stories",
        "reels",
        "recorded_video",
        "youtube_short",
        "print_material",
      ],
      help_request_kind: ["gestor_platform", "client_gestor"],
      library_category: [
        "brand",
        "pdfs",
        "images",
        "videos",
        "references",
        "documents",
        "spreadsheets",
        "generated_arts",
      ],
      subscription_plan: ["solo", "studio", "agency", "courtesy"],
    },
  },
} as const
