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
      agent_google_calendar: {
        Row: {
          access_token: string
          agent_id: string
          booking_buffer_minutes: number
          business_hours: Json
          calendar_id: string
          calendar_name: string | null
          created_at: string
          default_event_duration_minutes: number
          google_email: string
          google_user_id: string | null
          id: string
          refresh_token: string
          scope: string | null
          timezone: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          agent_id: string
          booking_buffer_minutes?: number
          business_hours?: Json
          calendar_id?: string
          calendar_name?: string | null
          created_at?: string
          default_event_duration_minutes?: number
          google_email: string
          google_user_id?: string | null
          id?: string
          refresh_token: string
          scope?: string | null
          timezone?: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          agent_id?: string
          booking_buffer_minutes?: number
          business_hours?: Json
          calendar_id?: string
          calendar_name?: string | null
          created_at?: string
          default_event_duration_minutes?: number
          google_email?: string
          google_user_id?: string | null
          id?: string
          refresh_token?: string
          scope?: string | null
          timezone?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agents: {
        Row: {
          answer_mode: string
          assistant_name: string | null
          booking_link: string | null
          business_name: string
          created_at: string
          elevenlabs_agent_id: string | null
          emergency_number: string | null
          escalation_triggers: string | null
          faqs: string | null
          faqs_structured: Json
          id: string
          industry: string | null
          is_live: boolean
          onboarding_completed: boolean
          pricing_notes: string | null
          primary_goal: string | null
          services: string | null
          sms_followup_enabled: boolean
          source_url: string | null
          tone: string | null
          updated_at: string
          user_id: string
          voice_id: string | null
          widget_color: string | null
          widget_greeting: string | null
          widget_position: string
        }
        Insert: {
          answer_mode?: string
          assistant_name?: string | null
          booking_link?: string | null
          business_name: string
          created_at?: string
          elevenlabs_agent_id?: string | null
          emergency_number?: string | null
          escalation_triggers?: string | null
          faqs?: string | null
          faqs_structured?: Json
          id?: string
          industry?: string | null
          is_live?: boolean
          onboarding_completed?: boolean
          pricing_notes?: string | null
          primary_goal?: string | null
          services?: string | null
          sms_followup_enabled?: boolean
          source_url?: string | null
          tone?: string | null
          updated_at?: string
          user_id: string
          voice_id?: string | null
          widget_color?: string | null
          widget_greeting?: string | null
          widget_position?: string
        }
        Update: {
          answer_mode?: string
          assistant_name?: string | null
          booking_link?: string | null
          business_name?: string
          created_at?: string
          elevenlabs_agent_id?: string | null
          emergency_number?: string | null
          escalation_triggers?: string | null
          faqs?: string | null
          faqs_structured?: Json
          id?: string
          industry?: string | null
          is_live?: boolean
          onboarding_completed?: boolean
          pricing_notes?: string | null
          primary_goal?: string | null
          services?: string | null
          sms_followup_enabled?: boolean
          source_url?: string | null
          tone?: string | null
          updated_at?: string
          user_id?: string
          voice_id?: string | null
          widget_color?: string | null
          widget_greeting?: string | null
          widget_position?: string
        }
        Relationships: []
      }
      calendar_bookings: {
        Row: {
          agent_id: string
          conversation_id: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          ends_at: string
          google_event_id: string | null
          id: string
          reason: string | null
          source: string
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          conversation_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          ends_at: string
          google_event_id?: string | null
          id?: string
          reason?: string | null
          source?: string
          starts_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          conversation_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          ends_at?: string
          google_event_id?: string | null
          id?: string
          reason?: string | null
          source?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          agent_id: string | null
          duration_seconds: number
          elevenlabs_conversation_id: string | null
          ended_at: string | null
          id: string
          message_count: number
          recording_url: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          duration_seconds?: number
          elevenlabs_conversation_id?: string | null
          ended_at?: string | null
          id?: string
          message_count?: number
          recording_url?: string | null
          started_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          duration_seconds?: number
          elevenlabs_conversation_id?: string | null
          ended_at?: string | null
          id?: string
          message_count?: number
          recording_url?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          agent_id: string | null
          conversation_id: string | null
          created_at: string
          email: string | null
          id: string
          last_message_at: string | null
          name: string | null
          notes: string | null
          phone: string | null
          source: string | null
          status: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          conversation_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_message_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          conversation_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_message_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_numbers: {
        Row: {
          agent_id: string | null
          capabilities: Json
          country: string
          created_at: string
          friendly_name: string | null
          id: string
          locality: string | null
          monthly_price: number | null
          phone_number: string
          postal_code: string | null
          region: string | null
          status: string
          twilio_sid: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          capabilities?: Json
          country?: string
          created_at?: string
          friendly_name?: string | null
          id?: string
          locality?: string | null
          monthly_price?: number | null
          phone_number: string
          postal_code?: string | null
          region?: string | null
          status?: string
          twilio_sid: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          capabilities?: Json
          country?: string
          created_at?: string
          friendly_name?: string | null
          id?: string
          locality?: string | null
          monthly_price?: number | null
          phone_number?: string
          postal_code?: string | null
          region?: string | null
          status?: string
          twilio_sid?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
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
      voice_audio_cache: {
        Row: {
          created_at: string
          id: string
          text: string
          voice_id: string | null
        }
        Insert: {
          created_at?: string
          id: string
          text: string
          voice_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          text?: string
          voice_id?: string | null
        }
        Relationships: []
      }
      widget_conversations: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          page_url: string | null
          session_token: string
          updated_at: string
          user_agent: string | null
          user_id: string
          visitor_email: string | null
          visitor_name: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          page_url?: string | null
          session_token: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
          visitor_email?: string | null
          visitor_name?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          page_url?: string | null
          session_token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
          visitor_email?: string | null
          visitor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "widget_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "widget_conversations"
            referencedColumns: ["id"]
          },
        ]
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
