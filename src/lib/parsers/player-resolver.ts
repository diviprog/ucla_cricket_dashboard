import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { Player, PlayerAlias, MatchPlayerOverride } from '@/types/models'

// Cache for player lookups
let playerCache: Map<string, Player> | null = null // player_id -> player
let aliasCache: Map<string, string> | null = null // alias -> player_id

/**
 * Initialize caches from database
 */
export async function initializePlayerCache(): Promise<void> {
  const supabase = getSupabaseAdmin()
  // Load all players
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
  
  if (playersError) {
    console.error('Error loading players:', playersError)
    return
  }
  
  playerCache = new Map()
  players?.forEach(player => {
    playerCache!.set(player.id, player)
  })
  
  // Load all aliases
  const { data: aliases, error: aliasesError } = await supabase
    .from('player_aliases')
    .select('*')
  
  if (aliasesError) {
    console.error('Error loading aliases:', aliasesError)
    return
  }
  
  aliasCache = new Map()
  aliases?.forEach(alias => {
    aliasCache!.set(alias.alias.toLowerCase(), alias.player_id)
  })
}

/**
 * Clear caches (call after adding new players/aliases)
 */
export function clearPlayerCache(): void {
  playerCache = null
  aliasCache = null
}

/**
 * Normalize a player name (remove symbols, extra spaces, etc.)
 */
export function normalizePlayerName(rawName: string): string {
  return rawName
    .replace(/[*†‡]/g, '') // Remove special symbols
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .trim()
}

/**
 * Resolve a player name to a player ID
 * Takes into account aliases and match-specific overrides
 */
export async function resolvePlayerName(
  rawName: string,
  matchId?: string
): Promise<{ playerId: string; playerName: string } | null> {
  const supabase = getSupabaseAdmin()
  // Ensure caches are initialized
  if (!playerCache || !aliasCache) {
    await initializePlayerCache()
  }
  
  const normalizedName = normalizePlayerName(rawName)
  
  // 1. Check for match-specific override first
  if (matchId) {
    const { data: override } = await supabase
      .from('match_player_overrides')
      .select('actual_player_id')
      .eq('match_id', matchId)
      .eq('displayed_name', normalizedName)
      .single()
    
    if (override) {
      const player = playerCache!.get(override.actual_player_id)
      if (player) {
        return { playerId: override.actual_player_id, playerName: player.name }
      }
    }
  }
  
  // 2-4. Alias, exact name, first name + last initial
  return matchPlayerName(normalizedName, Array.from(playerCache!.values()), aliasCache!)
}

/**
 * Pure name matcher (no DB). Order:
 * 1. exact alias (case-insensitive)
 * 2. exact canonical name (case-insensitive)
 * 3. first name + last initial ("Naman S" -> "Naman Satija"), only if exactly one player matches
 * Anything else returns null; the caller creates a new player rather than guessing.
 */
export function matchPlayerName(
  rawName: string,
  players: Player[],
  aliasToPlayerId: Map<string, string>
): { playerId: string; playerName: string } | null {
  const lowerName = normalizePlayerName(rawName).toLowerCase()
  if (!lowerName) return null
  
  // 1. Exact alias
  const aliasPlayerId = aliasToPlayerId.get(lowerName)
  if (aliasPlayerId) {
    const player = players.find(p => p.id === aliasPlayerId)
    if (player) {
      return { playerId: player.id, playerName: player.name }
    }
  }
  
  // 2. Exact canonical name
  const directMatch = players.find(p => normalizePlayerName(p.name).toLowerCase() === lowerName)
  if (directMatch) {
    return { playerId: directMatch.id, playerName: directMatch.name }
  }
  
  // 3. First name + last initial (e.g., "Naman S" or "Naman S.")
  const lastInitialMatch = lowerName.match(/^(\S+)\s+(\w)\.?$/)
  if (lastInitialMatch) {
    const [, first, lastInit] = lastInitialMatch
    const candidates = players.filter(p => {
      const parts = normalizePlayerName(p.name).toLowerCase().split(' ')
      return parts.length > 1 &&
             parts[0] === first &&
             parts[parts.length - 1].startsWith(lastInit)
    })
    if (candidates.length === 1) {
      return { playerId: candidates[0].id, playerName: candidates[0].name }
    }
  }
  
  return null
}

/**
 * Create a new player if not found
 */
export async function createPlayerIfNotExists(name: string): Promise<string> {
  const supabase = getSupabaseAdmin()
  const normalizedName = normalizePlayerName(name)
  
  // Check if player exists
  const resolved = await resolvePlayerName(normalizedName)
  if (resolved) {
    return resolved.playerId
  }
  
  // Create new player
  const { data, error } = await supabase
    .from('players')
    .insert({ name: normalizedName })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating player:', error)
    throw error
  }
  
  // Also add the original name as an alias if different from normalized
  if (name !== normalizedName) {
    await addPlayerAlias(data.id, name)
  }
  
  // Clear cache to include new player
  clearPlayerCache()
  
  return data.id
}

/**
 * Add an alias for a player
 */
export async function addPlayerAlias(playerId: string, alias: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const normalizedAlias = normalizePlayerName(alias)
  
  const { error } = await supabase
    .from('player_aliases')
    .insert({ player_id: playerId, alias: normalizedAlias })
    .select()
  
  if (error && !error.message.includes('duplicate')) {
    console.error('Error adding alias:', error)
  }
  
  // Clear cache
  clearPlayerCache()
}

/**
 * Add a match-specific override (Player A played under Player B's name)
 */
export async function addMatchPlayerOverride(
  matchId: string,
  displayedName: string,
  actualPlayerId: string,
  notes?: string
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('match_player_overrides')
    .insert({
      match_id: matchId,
      displayed_name: normalizePlayerName(displayedName),
      actual_player_id: actualPlayerId,
      notes,
    })
  
  if (error) {
    console.error('Error adding override:', error)
    throw error
  }
}

/**
 * Get all players with their aliases
 */
export async function getAllPlayersWithAliases(): Promise<(Player & { aliases: string[] })[]> {
  const supabase = getSupabaseAdmin()
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .order('name')
  
  if (playersError || !players) {
    console.error('Error loading players:', playersError)
    return []
  }
  
  const { data: aliases, error: aliasesError } = await supabase
    .from('player_aliases')
    .select('*')
  
  if (aliasesError) {
    console.error('Error loading aliases:', aliasesError)
  }
  
  // Group aliases by player
  const aliasMap = new Map<string, string[]>()
  aliases?.forEach(alias => {
    if (!aliasMap.has(alias.player_id)) {
      aliasMap.set(alias.player_id, [])
    }
    aliasMap.get(alias.player_id)!.push(alias.alias)
  })
  
  return players.map(player => ({
    ...player,
    aliases: aliasMap.get(player.id) || [],
  }))
}

