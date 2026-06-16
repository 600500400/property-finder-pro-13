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
      ai_analyses: {
        Row: {
          created_at: string
          model: string
          payload: Json
          url: string
          url_hash: string
        }
        Insert: {
          created_at?: string
          model: string
          payload: Json
          url: string
          url_hash: string
        }
        Update: {
          created_at?: string
          model?: string
          payload?: Json
          url?: string
          url_hash?: string
        }
        Relationships: []
      }
      email_log: {
        Row: {
          created_at: string
          error: string | null
          id: string
          listings_count: number
          search_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          listings_count?: number
          search_id?: string | null
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          listings_count?: number
          search_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          area_m2: number | null
          city: string | null
          deal_type: string | null
          description_snippet: string | null
          external_id: string
          first_seen_at: string
          id: string
          image_url: string | null
          is_active: boolean
          kraj: string | null
          last_seen_at: string
          ownership: string | null
          ownership_confidence: string | null
          price: number | null
          price_per_m2: number | null
          property_type: string | null
          raw_data: Json
          source: string
          title: string | null
          url: string
        }
        Insert: {
          area_m2?: number | null
          city?: string | null
          deal_type?: string | null
          description_snippet?: string | null
          external_id: string
          first_seen_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          kraj?: string | null
          last_seen_at?: string
          ownership?: string | null
          ownership_confidence?: string | null
          price?: number | null
          price_per_m2?: number | null
          property_type?: string | null
          raw_data?: Json
          source: string
          title?: string | null
          url: string
        }
        Update: {
          area_m2?: number | null
          city?: string | null
          deal_type?: string | null
          description_snippet?: string | null
          external_id?: string
          first_seen_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          kraj?: string | null
          last_seen_at?: string
          ownership?: string | null
          ownership_confidence?: string | null
          price?: number | null
          price_per_m2?: number | null
          property_type?: string | null
          raw_data?: Json
          source?: string
          title?: string | null
          url?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      saved_filters: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          frequency: string
          id: string
          is_active: boolean
          last_notified_at: string | null
          min_yield: number | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters: Json
          frequency: string
          id?: string
          is_active?: boolean
          last_notified_at?: string | null
          min_yield?: number | null
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          frequency?: string
          id?: string
          is_active?: boolean
          last_notified_at?: string | null
          min_yield?: number | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      scan_results: {
        Row: {
          count: number
          created_at: string
          emailed: boolean
          id: string
          meta: Json | null
          results: Json
          scheduled_scan_id: string
          user_id: string
        }
        Insert: {
          count: number
          created_at?: string
          emailed?: boolean
          id?: string
          meta?: Json | null
          results: Json
          scheduled_scan_id: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          emailed?: boolean
          id?: string
          meta?: Json | null
          results?: Json
          scheduled_scan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_results_scheduled_scan_id_fkey"
            columns: ["scheduled_scan_id"]
            isOneToOne: false
            referencedRelation: "scheduled_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_scans: {
        Row: {
          created_at: string
          email: string
          enabled: boolean
          filters: Json
          frequency_per_day: number
          id: string
          last_run_at: string | null
          max_per_email: number
          saved_filter_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          enabled?: boolean
          filters: Json
          frequency_per_day?: number
          id?: string
          last_run_at?: string | null
          max_per_email?: number
          saved_filter_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          enabled?: boolean
          filters?: Json
          frequency_per_day?: number
          id?: string
          last_run_at?: string | null
          max_per_email?: number
          saved_filter_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_scans_saved_filter_id_fkey"
            columns: ["saved_filter_id"]
            isOneToOne: false
            referencedRelation: "saved_filters"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_runs: {
        Row: {
          deal_type: string | null
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          items_deactivated: number
          items_found: number
          items_new: number
          items_updated: number
          property_type: string | null
          source: string
          started_at: string
          status: string
        }
        Insert: {
          deal_type?: string | null
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_deactivated?: number
          items_found?: number
          items_new?: number
          items_updated?: number
          property_type?: string | null
          source: string
          started_at?: string
          status?: string
        }
        Update: {
          deal_type?: string | null
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_deactivated?: number
          items_found?: number
          items_new?: number
          items_updated?: number
          property_type?: string | null
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
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
          cancel_at_period_end?: boolean
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
          cancel_at_period_end?: boolean
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_premium: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
