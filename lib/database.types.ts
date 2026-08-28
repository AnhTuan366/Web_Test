// Sinh tự động từ schema Supabase (dự án CongDuHoc) — không sửa tay.
// Chạy lại: dùng Supabase MCP `generate_typescript_types` rồi dán đè file này.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      chat_conversations: {
        Row: {
          channel: string
          id: string
          last_message_at: string
          session_token: string
          started_at: string
        }
        Insert: {
          channel?: string
          id?: string
          last_message_at?: string
          session_token: string
          started_at?: string
        }
        Update: {
          channel?: string
          id?: string
          last_message_at?: string
          session_token?: string
          started_at?: string
        }
        Relationships: []
      }
      chat_leads: {
        Row: {
          availability: string | null
          conversation_id: string
          country: string | null
          education_level: string | null
          email: string | null
          extracted_at: string
          has_booked_consultation: boolean
          id: string
          major: string | null
          name: string | null
          notes: string | null
          phone: string | null
          quality: string
          updated_at: string
        }
        Insert: {
          availability?: string | null
          conversation_id: string
          country?: string | null
          education_level?: string | null
          email?: string | null
          extracted_at?: string
          has_booked_consultation?: boolean
          id?: string
          major?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          quality: string
          updated_at?: string
        }
        Update: {
          availability?: string | null
          conversation_id?: string
          country?: string | null
          education_level?: string | null
          email?: string | null
          extracted_at?: string
          has_booked_consultation?: boolean
          id?: string
          major?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          quality?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_leads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_documents: {
        Row: {
          doc_type: string
          extracted: Json
          file_name: string
          id: string
          mime_type: string
          profile_id: string
          reason: string | null
          status: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          doc_type: string
          extracted?: Json
          file_name: string
          id?: string
          mime_type: string
          profile_id: string
          reason?: string | null
          status: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          doc_type?: string
          extracted?: Json
          file_name?: string
          id?: string
          mime_type?: string
          profile_id?: string
          reason?: string | null
          status?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "portal_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_profiles: {
        Row: {
          created_at: string
          id: string
          session_token: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_token: string
        }
        Update: {
          created_at?: string
          id?: string
          session_token?: string
        }
        Relationships: []
      }
      quote_requests: {
        Row: {
          country: string
          created_at: string
          education_level: string
          email: string
          id: string
          phone: string
          price: number
          service_package: string
          status: string
        }
        Insert: {
          country: string
          created_at?: string
          education_level: string
          email: string
          id?: string
          phone: string
          price: number
          service_package: string
          status?: string
        }
        Update: {
          country?: string
          created_at?: string
          education_level?: string
          email?: string
          id?: string
          phone?: string
          price?: number
          service_package?: string
          status?: string
        }
        Relationships: []
      }
      scholarships: {
        Row: {
          created_at: string
          id: string
          min_gpa: number | null
          min_ielts: number | null
          name: string
          school_id: string
          support: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_gpa?: number | null
          min_ielts?: number | null
          name: string
          school_id: string
          support: string
        }
        Update: {
          created_at?: string
          id?: string
          min_gpa?: number | null
          min_ielts?: number | null
          name?: string
          school_id?: string
          support?: string
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          country: string
          created_at: string
          id: string
          min_gpa: number
          min_ielts: number
          name: string
        }
        Insert: {
          country: string
          created_at?: string
          id?: string
          min_gpa: number
          min_ielts: number
          name: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          min_gpa?: number
          min_ielts?: number
          name?: string
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
