import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database type definitions for Supabase
export type Database = {
  public: {
    Tables: {
      seasons: {
        Row: {
          id: string
          name: string
          start_date: string
          end_date: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['seasons']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['seasons']['Insert']>
      }
      players: {
        Row: {
          id: string
          name: string
          photo_url: string | null
          contact_info: Record<string, unknown> | null
          year: string | null
          major: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['players']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['players']['Insert']>
      }
      player_aliases: {
        Row: {
          id: string
          player_id: string
          alias: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['player_aliases']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['player_aliases']['Insert']>
      }
      matches: {
        Row: {
          id: string
          season_id: string
          date: string
          opponent: string
          venue: string | null
          match_type: string
          competition_name: string | null
          result: string
          our_team_name: string | null
          our_score: string | null
          opponent_score: string | null
          home_away: string | null
          weather: string | null
          pitch_type: string | null
          importance: number | null
          notes: string | null
          raw_html_hash: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['matches']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['matches']['Insert']>
      }
      batting_performances: {
        Row: {
          id: string
          match_id: string
          player_id: string
          runs: number
          balls: number
          fours: number
          sixes: number
          not_out: boolean
          bowled_lbw: boolean
          dismissal_text: string | null
          batting_position: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['batting_performances']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['batting_performances']['Insert']>
      }
      player_season_stats: {
        Row: {
          id: string
          player_id: string
          season_id: string
          matches_played: number
          total_runs: number
          total_balls: number
          dismissals: number
          not_outs: number
          fours: number
          sixes: number
          bowled_lbw: number
          average: number
          strike_rate: number
          boundary_rate: number
          boundary_percentage: number
          bowled_lbw_percentage: number
          last_updated: string
        }
        Insert: Omit<Database['public']['Tables']['player_season_stats']['Row'], 'id' | 'last_updated'>
        Update: Partial<Database['public']['Tables']['player_season_stats']['Insert']>
      }
      import_history: {
        Row: {
          id: string
          match_id: string
          filename: string
          content_hash: string
          imported_at: string
        }
        Insert: Omit<Database['public']['Tables']['import_history']['Row'], 'id' | 'imported_at'>
        Update: Partial<Database['public']['Tables']['import_history']['Insert']>
      }
      match_player_overrides: {
        Row: {
          id: string
          match_id: string
          displayed_name: string
          actual_player_id: string
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['match_player_overrides']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['match_player_overrides']['Insert']>
      }
    }
  }
}

