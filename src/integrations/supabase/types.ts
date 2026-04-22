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
          id: string
          industry: string | null
          is_live: boolean
          pricing_notes: string | null
          primary_goal: string | null
          services: string | null
          source_url: string | null
          tone: string | null
          updated_at: string
          user_id: string
          voice_id: string | null
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
          id?: string
          industry?: string | null
          is_live?: boolean
          pricing_notes?: string | null
          primary_goal?: string | null
          services?: string | null
          source_url?: string | null
          tone?: string | null
          updated_at?: string
          user_id: string
          voice_id?: string | null
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
          id?: string
          industry?: string | null
          is_live?: boolean
          pricing_notes?: string | null
          primary_goal?: string | null
          services?: string | null
          source_url?: string | null
          tone?: string | null
          updated_at?: string
          user_id?: string
          voice_id?: string | null
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
          created_at: string
          email: string | null
          id: string
          name: string | null
          notes: string | null
          phone: string | null
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
