export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          scratchpad: string | null
          theme: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          scratchpad?: string | null
          theme?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          scratchpad?: string | null
          theme?: string
          created_at?: string
          updated_at?: string
        }
      }
      subjects: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      chapters: {
        Row: {
          id: string
          subject_id: string
          name: string
          description: string | null
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          subject_id: string
          name: string
          description?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          subject_id?: string
          name?: string
          description?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      topics: {
        Row: {
          id: string
          chapter_id: string
          name: string
          description: string | null
          is_completed: boolean
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          chapter_id: string
          name: string
          description?: string | null
          is_completed?: boolean
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          chapter_id?: string
          name?: string
          description?: string | null
          is_completed?: boolean
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      topic_notes: {
        Row: {
          id: string
          topic_id: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          topic_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          topic_id?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
      }
      chapter_attachments: {
        Row: {
          id: string
          chapter_id: string
          file_name: string
          storage_path: string
          file_type: string | null
          file_size: number | null
          created_at: string
        }
        Insert: {
          id?: string
          chapter_id: string
          file_name: string
          storage_path: string
          file_type?: string | null
          file_size?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          chapter_id?: string
          file_name?: string
          storage_path?: string
          file_type?: string | null
          file_size?: number | null
          created_at?: string
        }
      }
      topic_attachments: {
        Row: {
          id: string
          topic_id: string
          file_name: string
          storage_path: string
          file_type: string | null
          file_size: number | null
          created_at: string
        }
        Insert: {
          id?: string
          topic_id: string
          file_name: string
          storage_path: string
          file_type?: string | null
          file_size?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          topic_id?: string
          file_name?: string
          storage_path?: string
          file_type?: string | null
          file_size?: number | null
          created_at?: string
        }
      }
      journal_entries: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string
          mood: string | null
          sticker: string | null
          entry_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          content: string
          mood?: string | null
          sticker?: string | null
          entry_date?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          content?: string
          mood?: string | null
          sticker?: string | null
          entry_date?: string
          created_at?: string
          updated_at?: string
        }
      }
      study_sessions: {
        Row: {
          id: string
          user_id: string
          topic_id: string
          started_at: string
          ended_at: string | null
          duration_seconds: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          topic_id: string
          started_at?: string
          ended_at?: string | null
          duration_seconds?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          topic_id?: string
          started_at?: string
          ended_at?: string | null
          duration_seconds?: number | null
          created_at?: string
        }
      }
      activity_log: {
        Row: {
          id: string
          user_id: string
          action_type: string
          entity_type: string
          entity_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action_type: string
          entity_type: string
          entity_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action_type?: string
          entity_type?: string
          entity_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
    }
  }
}
