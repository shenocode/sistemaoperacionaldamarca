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
      brand_briefings: {
        Row: {
          answers: Json
          client_id: string
          completed_at: string | null
          created_at: string
          guide: Json | null
          guide_markdown: string | null
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
      calendar_blocks: {
        Row: {
          created_at: string
          id: string
          project_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
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
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          access_token?: string
          brand_colors?: Json
          brand_fonts?: Json
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          access_token?: string
          brand_colors?: Json
          brand_fonts?: Json
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      content_comments: {
        Row: {
          body: string
          content_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          content_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          content_id?: string
          created_at?: string
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
          calendar_block_id: string | null
          caption: string
          created_at: string
          created_by: string | null
          cta: string
          current_version: number
          format: Database["public"]["Enums"]["content_format"]
          hashtags: string
          id: string
          locucao: string
          media_url: string | null
          media_urls: string[]
          project_id: string
          roteiro: string
          scheduled_at: string | null
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          theme: string | null
          title: string
          updated_at: string
        }
        Insert: {
          calendar_block_id?: string | null
          caption?: string
          created_at?: string
          created_by?: string | null
          cta?: string
          current_version?: number
          format?: Database["public"]["Enums"]["content_format"]
          hashtags?: string
          id?: string
          locucao?: string
          media_url?: string | null
          media_urls?: string[]
          project_id: string
          roteiro?: string
          scheduled_at?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          theme?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          calendar_block_id?: string | null
          caption?: string
          created_at?: string
          created_by?: string | null
          cta?: string
          current_version?: number
          format?: Database["public"]["Enums"]["content_format"]
          hashtags?: string
          id?: string
          locucao?: string
          media_url?: string | null
          media_urls?: string[]
          project_id?: string
          roteiro?: string
          scheduled_at?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          theme?: string | null
          title?: string
          updated_at?: string
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
          id: string
          locucao: string
          media_url: string | null
          media_urls: string[]
          roteiro: string
          version_number: number
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
          id?: string
          locucao?: string
          media_url?: string | null
          media_urls?: string[]
          roteiro?: string
          version_number: number
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
          id?: string
          locucao?: string
          media_url?: string | null
          media_urls?: string[]
          roteiro?: string
          version_number?: number
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
          created_at: string
          created_by: string | null
          file_size: number | null
          file_url: string
          format: Database["public"]["Enums"]["design_template_format"]
          id: string
          mime_type: string | null
          name: string
          project_id: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          file_url: string
          format: Database["public"]["Enums"]["design_template_format"]
          id?: string
          mime_type?: string | null
          name: string
          project_id: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          file_url?: string
          format?: Database["public"]["Enums"]["design_template_format"]
          id?: string
          mime_type?: string | null
          name?: string
          project_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "design_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      library_assets: {
        Row: {
          category: Database["public"]["Enums"]["library_category"]
          created_at: string
          created_by: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          mime_type: string | null
          name: string
          notes: string | null
          project_id: string
          storage_path: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["library_category"]
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          name: string
          notes?: string | null
          project_id: string
          storage_path?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["library_category"]
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          notes?: string | null
          project_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_assets_project_id_fkey"
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
          created_at: string
          full_name: string | null
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          cta_presets: string[]
          description: string | null
          hashtag_presets: string[]
          id: string
          name: string
          status: string
          theme_presets: string[]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          cta_presets?: string[]
          description?: string | null
          hashtag_presets?: string[]
          id?: string
          name: string
          status?: string
          theme_presets?: string[]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          cta_presets?: string[]
          description?: string | null
          hashtag_presets?: string[]
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
      can_access_client: { Args: { _client_id: string }; Returns: boolean }
      can_access_content: { Args: { _content_id: string }; Returns: boolean }
      can_access_project: { Args: { _project_id: string }; Returns: boolean }
      can_manage_client: { Args: { _client_id: string }; Returns: boolean }
      can_manage_content: { Args: { _content_id: string }; Returns: boolean }
      can_manage_project: { Args: { _project_id: string }; Returns: boolean }
      claim_client_access: { Args: { _access_token: string }; Returns: string }
      client_logo_storage_client_id: {
        Args: { object_name: string }
        Returns: string
      }
      content_storage_project_id: {
        Args: { object_name: string }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_client_member: { Args: { _client_id: string }; Returns: boolean }
      is_client_owner: { Args: { _client_id: string }; Returns: boolean }
      library_storage_project_id: {
        Args: { object_name: string }
        Returns: string
      }
      save_client_content_version: {
        Args: {
          _caption: string
          _change_note?: string
          _content_id: string
          _cta: string
          _hashtags: string
        }
        Returns: {
          calendar_block_id: string | null
          caption: string
          created_at: string
          created_by: string | null
          cta: string
          current_version: number
          format: Database["public"]["Enums"]["content_format"]
          hashtags: string
          id: string
          locucao: string
          media_url: string | null
          media_urls: string[]
          project_id: string
          roteiro: string
          scheduled_at: string | null
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          theme: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "content_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_client_contact: {
        Args: {
          _brand_colors?: Json
          _brand_fonts?: Json
          _client_id: string
          _email?: string
          _instagram?: string
          _logo_url?: string
          _name: string
          _notes?: string
          _phone?: string
          _whatsapp?: string
        }
        Returns: {
          access_token: string
          brand_colors: Json
          brand_fonts: Json
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
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
      app_role: "admin" | "client"
      brand_briefing_status: "draft" | "in_progress" | "completed"
      client_member_role: "owner" | "member"
      content_format:
        | "static_feed"
        | "reels"
        | "stories"
        | "carousel"
        | "recorded_video"
      content_status:
        | "draft"
        | "review"
        | "approved"
        | "changes"
        | "published"
        | "waiting_material"
      design_template_format: "static_feed" | "carousel"
      library_category:
        | "brand"
        | "pdfs"
        | "images"
        | "videos"
        | "references"
        | "documents"
        | "spreadsheets"
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
      ],
      app_role: ["admin", "client"],
      brand_briefing_status: ["draft", "in_progress", "completed"],
      client_member_role: ["owner", "member"],
      content_format: [
        "static_feed",
        "reels",
        "stories",
        "carousel",
        "recorded_video",
      ],
      content_status: [
        "draft",
        "review",
        "approved",
        "changes",
        "published",
        "waiting_material",
      ],
      design_template_format: ["static_feed", "carousel"],
      library_category: [
        "brand",
        "pdfs",
        "images",
        "videos",
        "references",
        "documents",
        "spreadsheets",
      ],
    },
  },
} as const
